import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  MIN_STRIPE_WITHDRAWAL,
  STRIPE_PAYOUT_CURRENCY,
  STRIPE_WITHDRAWAL_FEE,
} from "../_shared/stripe-payout-config.ts";
import {
  ensureManualPayoutSchedule,
  syncConnectedAccountState,
} from "../_shared/stripe-connect.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-STRIPE-PAYOUT] ${step}${detailsStr}`);
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function formatFunctionError(result: { success?: boolean; error?: string } | null) {
  if (!result) {
    return "Unexpected Stripe payout state";
  }

  return typeof result.error === "string" && result.error ? result.error : "Unexpected Stripe payout state";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const missingEnv = [
      !stripeKey ? "STRIPE_SECRET_KEY" : null,
      !supabaseUrl ? "SUPABASE_URL" : null,
      !serviceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : null,
    ].filter((value): value is string => Boolean(value));

    if (missingEnv.length > 0) {
      return jsonResponse(
        {
          error: "Sistema pagamenti non configurato. Contatta il supporto.",
          details: `Missing environment variables: ${missingEnv.join(", ")}`,
          code: "STRIPE_CONFIG_MISSING",
        },
        503
      );
    }

    if (!stripeKey.startsWith("sk_live_") && !stripeKey.startsWith("sk_test_")) {
      return jsonResponse(
        {
          error: "Configurazione Stripe non valida. Contatta il supporto.",
          details: "STRIPE_SECRET_KEY must be a Stripe secret key (sk_live_ or sk_test_).",
          code: "INVALID_KEY_TYPE",
        },
        503
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const supabase = createClient(supabaseUrl!, serviceRoleKey!);

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return jsonResponse({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized", details: authError?.message ?? null, code: "UNAUTHORIZED" }, 401);
    }

    const body = await req.json();
    const requestedAmount = Number.parseFloat(String(body?.amount ?? ""));
    const amount = Number.isFinite(requestedAmount)
      ? Math.round(requestedAmount * 100) / 100
      : NaN;

    if (!Number.isFinite(amount) || amount < MIN_STRIPE_WITHDRAWAL) {
      return jsonResponse({ error: `Minimo prelievo: €${MIN_STRIPE_WITHDRAWAL}`, code: "STRIPE_WITHDRAWAL_MINIMUM" }, 400);
    }

    const { data: connectedAccount, error: accountError } = await supabase
      .from("stripe_connected_accounts")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (accountError || !connectedAccount?.stripe_account_id) {
      return jsonResponse(
        {
          error: "Completa la configurazione Stripe prima di richiedere un payout.",
          details: accountError?.message ?? null,
          code: "STRIPE_ACCOUNT_MISSING",
        },
        400
      );
    }

    const stripeAccountId = connectedAccount.stripe_account_id;
    try {
      await ensureManualPayoutSchedule(stripe, stripeAccountId);
    } catch (scheduleError) {
      logStep("Unable to enforce manual payout schedule before payout", {
        stripeAccountId,
        error: scheduleError instanceof Error ? scheduleError.message : "Unknown schedule error",
      });
    }

    const liveAccount = await stripe.accounts.retrieve(stripeAccountId, {
      expand: ["external_accounts"],
    });

    const syncedAccount = await syncConnectedAccountState(supabase, user.id, liveAccount);

    if (!syncedAccount.external_account_present) {
      return jsonResponse(
        {
          error: "Aggiungi prima un conto bancario o una carta di debito supportata nel dashboard Stripe.",
          code: "STRIPE_EXTERNAL_ACCOUNT_MISSING",
        },
        400
      );
    }

    if (!syncedAccount.payouts_enabled) {
      return jsonResponse(
        {
          error: "Il tuo account Stripe non e' ancora pronto ai payout. Completa i requisiti richiesti da Stripe.",
          code: "STRIPE_PAYOUTS_DISABLED",
        },
        400
      );
    }

    const reserveResult = await supabase.rpc("create_stripe_withdrawal_request", {
      p_user_id: user.id,
      p_amount: amount,
      p_fee_amount: STRIPE_WITHDRAWAL_FEE,
      p_currency: STRIPE_PAYOUT_CURRENCY,
      p_payment_details: stripeAccountId,
      p_destination_snapshot: syncedAccount.external_snapshot ?? {},
    });

    if (reserveResult.error) {
      throw reserveResult.error;
    }

    const reservePayload = reserveResult.data as {
      success?: boolean;
      error?: string;
      withdrawal_id?: string;
      new_balance?: number;
    } | null;

    if (!reservePayload?.success || !reservePayload.withdrawal_id) {
      return jsonResponse(
        {
          error: formatFunctionError(reservePayload),
          code: "STRIPE_WITHDRAWAL_RESERVE_FAILED",
        },
        400
      );
    }

    const withdrawalId = reservePayload.withdrawal_id;
    let transfer: Stripe.Transfer | null = null;
    let payout: Stripe.Payout | null = null;

    try {
      transfer = await stripe.transfers.create(
        {
          amount: Math.round(amount * 100),
          currency: STRIPE_PAYOUT_CURRENCY,
          destination: stripeAccountId,
          metadata: {
            user_id: user.id,
            withdrawal_request_id: withdrawalId,
          },
        },
        {
          idempotencyKey: `withdrawal:${withdrawalId}:transfer`,
        }
      );

      payout = await stripe.payouts.create(
        {
          amount: Math.round(amount * 100),
          currency: STRIPE_PAYOUT_CURRENCY,
          metadata: {
            user_id: user.id,
            withdrawal_request_id: withdrawalId,
            stripe_transfer_id: transfer.id,
          },
        },
        {
          stripeAccount: stripeAccountId,
          idempotencyKey: `withdrawal:${withdrawalId}:payout`,
        }
      );

      const syncResult = await supabase.rpc("sync_stripe_withdrawal_request", {
        p_withdrawal_id: withdrawalId,
        p_status: "processing",
        p_restore_funds: false,
        p_stripe_transfer_id: transfer.id,
        p_stripe_payout_id: payout.id,
      });

      if (syncResult.error) {
        throw syncResult.error;
      }

      return jsonResponse({
        success: true,
        withdrawalId,
        stripeTransferId: transfer.id,
        stripePayoutId: payout.id,
        amount,
        fee: STRIPE_WITHDRAWAL_FEE,
        status: "processing",
        newBalance: reservePayload.new_balance,
      });
    } catch (payoutError: unknown) {
      const errorMessage = payoutError instanceof Error ? payoutError.message : "Unknown payout error";
      const typedPayoutError = payoutError as { code?: string };
      let transferReversalId: string | null = null;
      let restoreFunds = false;

      if (transfer?.id) {
        try {
          const reversal = await stripe.transfers.createReversal(
            transfer.id,
            {
              metadata: {
                withdrawal_request_id: withdrawalId,
                cause: "payout_creation_failed",
              },
            },
            {
              idempotencyKey: `withdrawal:${withdrawalId}:reversal`,
            }
          );

          transferReversalId = reversal.id;
          restoreFunds = true;
        } catch (reversalError) {
          const reversalMessage = reversalError instanceof Error ? reversalError.message : "Unknown reversal error";
          logStep("Transfer reversal failed", {
            withdrawalId,
            transferId: transfer.id,
            error: reversalMessage,
          });
        }
      } else {
        restoreFunds = true;
      }

      const syncResult = await supabase.rpc("sync_stripe_withdrawal_request", {
        p_withdrawal_id: withdrawalId,
        p_status: "failed",
        p_restore_funds: restoreFunds,
        p_stripe_transfer_id: transfer?.id ?? null,
        p_stripe_payout_id: payout?.id ?? null,
        p_stripe_transfer_reversal_id: transferReversalId,
        p_error_code: typedPayoutError.code ?? null,
        p_error_message: restoreFunds
          ? errorMessage
          : `${errorMessage}. Transfer reversal failed and requires manual review.`,
      });

      if (syncResult.error) {
        logStep("Failed to sync failed withdrawal request", { withdrawalId, error: syncResult.error });
      }

      const userMessage = restoreFunds
        ? "Payout non riuscito. I fondi sono stati rimessi nel wallet."
        : "Payout non riuscito. Il tentativo di storno automatico non e' riuscito e serve una verifica manuale.";

      return jsonResponse(
        {
          error: userMessage,
          details: errorMessage,
          code: typedPayoutError.code ?? "STRIPE_PAYOUT_FAILED",
          stripeRequestId: (payoutError as { requestId?: string }).requestId ?? null,
          withdrawalId,
          stripeTransferId: transfer?.id ?? null,
          stripePayoutId: payout?.id ?? null,
        },
        500
      );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const stripeError = error as { requestId?: string; code?: string };

    logStep("ERROR", {
      message: errorMessage,
      requestId: stripeError.requestId,
      code: stripeError.code,
    });

    let userMessage = "Impossibile completare il payout. Riprova piu' tardi.";
    if (errorMessage.includes("insufficient")) {
      userMessage = "Saldo piattaforma Stripe insufficiente per completare il payout.";
    } else if (errorMessage.includes("external")) {
      userMessage = "Configura o aggiorna il tuo metodo payout nel dashboard Stripe prima di riprovare.";
    }

    return jsonResponse(
      {
        error: userMessage,
        details: errorMessage,
        code: stripeError.code || "STRIPE_PAYOUT_UNEXPECTED",
        stripeRequestId: stripeError.requestId || null,
      },
      500
    );
  }
});

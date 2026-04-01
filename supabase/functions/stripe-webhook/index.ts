import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  buildExternalAccountSnapshot,
  getStripePayoutStatus,
  listExternalAccountTypes,
} from "../_shared/stripe-payout-config.ts";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

async function syncConnectedAccountState(
  supabase: ReturnType<typeof createClient>,
  account: Stripe.Account
) {
  const externalSnapshot = buildExternalAccountSnapshot(account);
  const externalAccountPresent = externalSnapshot !== null;
  const payload = {
    country: account.country ?? null,
    onboarding_complete: (account.payouts_enabled ?? false) && externalAccountPresent,
    charges_enabled: account.charges_enabled ?? false,
    payouts_enabled: account.payouts_enabled ?? false,
    details_submitted: account.details_submitted ?? false,
    payouts_status: getStripePayoutStatus(account, externalAccountPresent),
    requirements_due: account.requirements?.currently_due ?? [],
    requirements_pending_verification: account.requirements?.pending_verification ?? [],
    external_account_present: externalAccountPresent,
    external_account_types: listExternalAccountTypes(account),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("stripe_connected_accounts")
    .update(payload)
    .eq("stripe_account_id", account.id);

  if (error) {
    logStep("Error updating connected account", { accountId: account.id, error });
    throw error;
  }
}

async function findWithdrawalRequest(
  supabase: ReturnType<typeof createClient>,
  payout: Stripe.Payout
) {
  const withdrawalId = payout.metadata?.withdrawal_request_id;

  if (withdrawalId) {
    const result = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("id", withdrawalId)
      .maybeSingle();

    if (result.error) {
      throw result.error;
    }

    if (result.data) {
      return result.data;
    }
  }

  const fallbackResult = await supabase
    .from("withdrawal_requests")
    .select("*")
    .eq("stripe_payout_id", payout.id)
    .maybeSingle();

  if (fallbackResult.error) {
    throw fallbackResult.error;
  }

  return fallbackResult.data;
}

serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature || !webhookSecret) {
    return new Response("Missing signature or webhook secret", { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    logStep("Webhook signature verification failed", { error: errorMessage });
    return new Response(`Webhook Error: ${errorMessage}`, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );

  logStep("Event received", { type: event.type, id: event.id, account: event.account ?? null });

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const coins = parseFloat(session.metadata?.coins || "0");

      if (!userId || !coins) {
        return new Response("Missing metadata", { status: 400 });
      }

      const { data: existingTx } = await supabase
        .from("transactions")
        .select("id")
        .eq("stripe_session_id", session.id)
        .maybeSingle();

      if (!existingTx) {
        const { data: wallet, error: walletError } = await supabase
          .from("wallets")
          .select("*")
          .eq("user_id", userId)
          .single();

        if (walletError || !wallet) {
          throw walletError || new Error("Wallet not found");
        }

        const newBalance = (wallet.balance || 0) + coins;

        const { error: updateError } = await supabase
          .from("wallets")
          .update({ balance: newBalance })
          .eq("user_id", userId);

        if (updateError) {
          throw updateError;
        }

        const { error: txError } = await supabase
          .from("transactions")
          .insert({
            user_id: userId,
            type: "deposit",
            amount: coins,
            description: `Purchased ${coins} Coins via Stripe`,
            stripe_session_id: session.id,
            provider: "stripe",
            status: "completed",
          });

        if (txError) {
          throw txError;
        }
      }
    }

    if (event.type === "account.updated" || event.type === "account.external_account.updated") {
      const stripeAccountId = event.account || (event.type === "account.updated" ? (event.data.object as Stripe.Account).id : null);

      if (stripeAccountId) {
        const account = await stripe.accounts.retrieve(stripeAccountId, {
          expand: ["external_accounts"],
        });

        await syncConnectedAccountState(supabase, account);
      }
    }

    if (event.type === "payout.paid") {
      const payout = event.data.object as Stripe.Payout;
      const withdrawalRequest = await findWithdrawalRequest(supabase, payout);

      if (withdrawalRequest) {
        const { error } = await supabase.rpc("sync_stripe_withdrawal_request", {
          p_withdrawal_id: withdrawalRequest.id,
          p_status: "completed",
          p_restore_funds: false,
          p_stripe_transfer_id: payout.metadata?.stripe_transfer_id ?? withdrawalRequest.stripe_transfer_id ?? null,
          p_stripe_payout_id: payout.id,
        });

        if (error) {
          throw error;
        }
      }
    }

    if (event.type === "payout.failed" || event.type === "payout.canceled") {
      const payout = event.data.object as Stripe.Payout;
      const withdrawalRequest = await findWithdrawalRequest(supabase, payout);

      if (!withdrawalRequest) {
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      if (withdrawalRequest.status === "failed") {
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      const transferId = withdrawalRequest.stripe_transfer_id || payout.metadata?.stripe_transfer_id || null;
      let reversalId: string | null = withdrawalRequest.stripe_transfer_reversal_id || null;

      if (transferId && !reversalId) {
        try {
          const reversal = await stripe.transfers.createReversal(
            transferId,
            {
              metadata: {
                withdrawal_request_id: withdrawalRequest.id,
                source_payout_id: payout.id,
                cause: event.type,
              },
            },
            {
              idempotencyKey: `withdrawal:${withdrawalRequest.id}:reversal`,
            }
          );

          reversalId = reversal.id;
        } catch (reversalError) {
          const reversalMessage = reversalError instanceof Error ? reversalError.message : "Unknown reversal error";
          logStep("Transfer reversal failed during payout failure handling", {
            withdrawalId: withdrawalRequest.id,
            transferId,
            payoutId: payout.id,
            error: reversalMessage,
          });

          return new Response("Transfer reversal failed", { status: 500 });
        }
      }

      const { error } = await supabase.rpc("sync_stripe_withdrawal_request", {
        p_withdrawal_id: withdrawalRequest.id,
        p_status: "failed",
        p_restore_funds: true,
        p_stripe_transfer_id: transferId,
        p_stripe_payout_id: payout.id,
        p_stripe_transfer_reversal_id: reversalId,
        p_error_code: payout.failure_code || event.type,
        p_error_message: payout.failure_message || `Stripe reported ${event.type}`,
      });

      if (error) {
        throw error;
      }
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = charge.payment_intent as string;

      if (paymentIntentId) {
        const sessions = await stripe.checkout.sessions.list({
          payment_intent: paymentIntentId,
          limit: 1,
        });

        if (sessions.data.length > 0) {
          const session = sessions.data[0];
          const userId = session.metadata?.user_id;
          const refundedAmount = charge.amount_refunded / 100;

          if (userId) {
            const { data: existingRefund } = await supabase
              .from("transactions")
              .select("id")
              .eq("stripe_session_id", `refund_${charge.id}`)
              .maybeSingle();

            if (!existingRefund) {
              const { data: wallet } = await supabase
                .from("wallets")
                .select("balance")
                .eq("user_id", userId)
                .single();

              if (wallet) {
                await supabase
                  .from("wallets")
                  .update({ balance: Math.max(0, (wallet.balance || 0) - refundedAmount) })
                  .eq("user_id", userId);
              }

              await supabase
                .from("transactions")
                .insert({
                  user_id: userId,
                  type: "refund",
                  amount: -refundedAmount,
                  description: `Refund: ${refundedAmount} Coins`,
                  stripe_session_id: `refund_${charge.id}`,
                  provider: "stripe",
                  status: "completed",
                });
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("Webhook processing failed", { type: event.type, error: errorMessage });
    return new Response(`Webhook processing error: ${errorMessage}`, { status: 500 });
  }
});

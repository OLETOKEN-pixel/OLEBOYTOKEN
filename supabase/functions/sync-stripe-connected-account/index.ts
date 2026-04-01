import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
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
  console.log(`[SYNC-STRIPE-CONNECTED-ACCOUNT] ${step}${detailsStr}`);
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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

    if (!stripeKey!.startsWith("sk_live_") && !stripeKey!.startsWith("sk_test_")) {
      return jsonResponse(
        {
          error: "Configurazione Stripe non valida. Contatta il supporto.",
          details: "STRIPE_SECRET_KEY must be a Stripe secret key (sk_live_ or sk_test_).",
          code: "INVALID_KEY_TYPE",
        },
        503
      );
    }

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return jsonResponse({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
    }

    const stripe = new Stripe(stripeKey!, { apiVersion: "2023-10-16" });
    const supabase = createClient(supabaseUrl!, serviceRoleKey!);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse(
        { error: "Unauthorized", details: authError?.message ?? null, code: "UNAUTHORIZED" },
        401
      );
    }

    const { data: connectedAccount, error: connectedAccountError } = await supabase
      .from("stripe_connected_accounts")
      .select("stripe_account_id, country")
      .eq("user_id", user.id)
      .maybeSingle();

    if (connectedAccountError || !connectedAccount?.stripe_account_id) {
      return jsonResponse(
        {
          error: "Configura prima il tuo account payout Stripe.",
          details: connectedAccountError?.message ?? null,
          code: "STRIPE_ACCOUNT_MISSING",
        },
        400
      );
    }

    try {
      await ensureManualPayoutSchedule(stripe, connectedAccount.stripe_account_id);
    } catch (scheduleError) {
      logStep("Unable to refresh manual payout schedule during sync", {
        stripeAccountId: connectedAccount.stripe_account_id,
        error: scheduleError instanceof Error ? scheduleError.message : "Unknown schedule error",
      });
    }

    const liveAccount = await stripe.accounts.retrieve(connectedAccount.stripe_account_id, {
      expand: ["external_accounts"],
    });

    const synced = await syncConnectedAccountState(
      supabase,
      user.id,
      liveAccount,
      connectedAccount.country
    );

    return jsonResponse({
      success: true,
      stripeAccountId: synced.stripe_account_id,
      country: synced.country,
      payoutsStatus: synced.payouts_status,
      payoutsEnabled: synced.payouts_enabled,
      detailsSubmitted: synced.details_submitted,
      externalAccountPresent: synced.external_account_present,
      externalAccountTypes: synced.external_account_types,
      requirementsDue: synced.requirements_due,
      requirementsPendingVerification: synced.requirements_pending_verification,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const stripeError = error as { code?: string; requestId?: string };

    logStep("ERROR", {
      message: errorMessage,
      code: stripeError.code,
      requestId: stripeError.requestId,
    });

    return jsonResponse(
      {
        error: "Impossibile aggiornare lo stato Stripe in questo momento.",
        details: errorMessage,
        code: stripeError.code || "STRIPE_SYNC_FAILED",
        stripeRequestId: stripeError.requestId || null,
      },
      500
    );
  }
});

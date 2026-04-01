import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveRequestOrigin } from "../_shared/app-url.ts";
import {
  buildExternalAccountSnapshot,
  getStripePayoutStatus,
  isSupportedStripePayoutCountry,
  listExternalAccountTypes,
  normalizeStripeCountryCode,
} from "../_shared/stripe-payout-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-STRIPE-CONNECT] ${step}${detailsStr}`);
};

async function ensureManualPayoutSchedule(stripe: Stripe, stripeAccountId: string) {
  await stripe.accounts.update(stripeAccountId, {
    settings: {
      payouts: {
        schedule: {
          interval: "manual",
        },
      },
    },
  });
}

async function syncConnectedAccountState(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  account: Stripe.Account,
  fallbackCountry?: string | null
) {
  const externalSnapshot = buildExternalAccountSnapshot(account);
  const externalAccountPresent = externalSnapshot !== null;
  const country = normalizeStripeCountryCode(account.country) ?? normalizeStripeCountryCode(fallbackCountry);
  const payoutsStatus = getStripePayoutStatus(account, externalAccountPresent);
  const onboardingComplete = (account.payouts_enabled ?? false) && externalAccountPresent;

  const payload = {
    user_id: userId,
    stripe_account_id: account.id,
    country,
    onboarding_complete: onboardingComplete,
    charges_enabled: account.charges_enabled ?? false,
    payouts_enabled: account.payouts_enabled ?? false,
    details_submitted: account.details_submitted ?? false,
    payouts_status: payoutsStatus,
    requirements_due: account.requirements?.currently_due ?? [],
    requirements_pending_verification: account.requirements?.pending_verification ?? [],
    external_account_present: externalAccountPresent,
    external_account_types: listExternalAccountTypes(account),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("stripe_connected_accounts")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    logStep("Failed to sync Stripe connected account", { userId, error });
  }

  return {
    ...payload,
    external_snapshot: externalSnapshot,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: "Sistema pagamenti non configurato. Contatta il supporto." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!stripeKey.startsWith("sk_live_") && !stripeKey.startsWith("sk_test_")) {
      return new Response(
        JSON.stringify({ error: "Configurazione Stripe non valida. Contatta il supporto.", code: "INVALID_KEY_TYPE" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      logStep("Auth error", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const requestedCountry = normalizeStripeCountryCode(body?.country);

    const { data: existingAccount, error: fetchError } = await supabase
      .from("stripe_connected_accounts")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError) {
      logStep("Error fetching existing account", fetchError);
    }

    let stripeAccountId = existingAccount?.stripe_account_id ?? null;
    let effectiveCountry = normalizeStripeCountryCode(existingAccount?.country) ?? requestedCountry;

    if (stripeAccountId && existingAccount?.country && requestedCountry && existingAccount.country !== requestedCountry) {
      return new Response(
        JSON.stringify({
          error: "Il paese payout e' bloccato dopo la creazione dell'account Stripe. Se hai scelto il paese sbagliato, contatta il supporto per ricreare l'account.",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!stripeAccountId) {
      if (!effectiveCountry || !isSupportedStripePayoutCountry(effectiveCountry)) {
        return new Response(
          JSON.stringify({ error: "Seleziona un paese payout supportato prima di iniziare l'onboarding Stripe." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      logStep("Creating new Express account", { country: effectiveCountry, userId: user.id });
      const account = await stripe.accounts.create({
        type: "express",
        country: effectiveCountry,
        email: user.email,
        capabilities: {
          transfers: { requested: true },
        },
        metadata: {
          supabase_user_id: user.id,
          payout_country: effectiveCountry,
        },
      });

      stripeAccountId = account.id;
      try {
        await ensureManualPayoutSchedule(stripe, stripeAccountId);
      } catch (scheduleError) {
        logStep("Unable to preconfigure manual payout schedule", {
          stripeAccountId,
          error: scheduleError instanceof Error ? scheduleError.message : "Unknown schedule error",
        });
      }

      const hydratedAccount = await stripe.accounts.retrieve(stripeAccountId, {
        expand: ["external_accounts"],
      });

      await syncConnectedAccountState(supabase, user.id, hydratedAccount, effectiveCountry);
    } else {
      try {
        await ensureManualPayoutSchedule(stripe, stripeAccountId);
      } catch (scheduleError) {
        logStep("Unable to refresh manual payout schedule", {
          stripeAccountId,
          error: scheduleError instanceof Error ? scheduleError.message : "Unknown schedule error",
        });
      }

      const hydratedAccount = await stripe.accounts.retrieve(stripeAccountId, {
        expand: ["external_accounts"],
      });

      const syncedAccount = await syncConnectedAccountState(
        supabase,
        user.id,
        hydratedAccount,
        effectiveCountry
      );

      effectiveCountry = syncedAccount.country;

      if (syncedAccount.payouts_enabled && syncedAccount.external_account_present) {
        return new Response(
          JSON.stringify({
            success: true,
            alreadyConnected: true,
            payouts_enabled: true,
            country: effectiveCountry,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const origin = resolveRequestOrigin(req.headers.get("origin"));
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${origin}/wallet?stripe_refresh=true`,
      return_url: `${origin}/wallet?stripe_onboarding=complete`,
      type: "account_onboarding",
    });

    logStep("Account link created", { stripeAccountId, country: effectiveCountry });

    return new Response(
      JSON.stringify({
        url: accountLink.url,
        stripeAccountId,
        country: effectiveCountry,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const stripeError = error as { type?: string; code?: string; requestId?: string };

    logStep("ERROR", {
      message: errorMessage,
      type: stripeError.type,
      code: stripeError.code,
      requestId: stripeError.requestId,
    });

    let userMessage = "Impossibile avviare la verifica Stripe. Riprova piu' tardi.";

    if (errorMessage.includes("country")) {
      userMessage = "Il paese payout selezionato non e' disponibile per questo setup Stripe.";
    } else if (errorMessage.includes("Invalid API Key")) {
      userMessage = "Chiave API Stripe non valida. Contatta il supporto.";
    } else if (errorMessage.includes("capabilities")) {
      userMessage = "Account Stripe non abilitato ai trasferimenti. Contatta il supporto.";
    }

    return new Response(
      JSON.stringify({
        error: userMessage,
        details: errorMessage,
        stripeRequestId: stripeError.requestId || null,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

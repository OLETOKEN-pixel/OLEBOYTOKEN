import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveRequestOrigin } from "../_shared/app-url.ts";
import {
  isSupportedStripePayoutCountry,
  normalizeStripeCountryCode,
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
  console.log(`[CREATE-STRIPE-CONNECT] ${step}${detailsStr}`);
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function buildPaymentsUrl(origin: string, params: Record<string, string>) {
  const url = new URL("/profile", origin);
  url.searchParams.set("tab", "payments");

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

function classifyStripeConnectError(error: unknown) {
  const stripeError = error as {
    type?: string;
    code?: string;
    requestId?: string;
    message?: string;
  };
  const details = error instanceof Error ? error.message : "Unknown error";
  const normalized = details.toLowerCase();
  let message = "Impossibile avviare la verifica Stripe. Riprova piu' tardi.";
  let code = stripeError.code || "STRIPE_CONNECT_SETUP_FAILED";

  if (normalized.includes("connect") && normalized.includes("enable")) {
    message = "Stripe Connect non e' ancora abilitato o il profilo piattaforma live non e' completo.";
    code = stripeError.code || "STRIPE_CONNECT_NOT_ENABLED";
  } else if (normalized.includes("invalid api key") || normalized.includes("api key provided")) {
    message = "Chiave API Stripe non valida o non autorizzata. Contatta il supporto.";
    code = stripeError.code || "STRIPE_INVALID_API_KEY";
  } else if (normalized.includes("capabilities") || normalized.includes("transfers")) {
    message = "Account Stripe non abilitato ai trasferimenti per questo paese o setup.";
    code = stripeError.code || "STRIPE_CAPABILITY_ERROR";
  } else if (normalized.includes("country")) {
    message = "Il paese payout selezionato non e' disponibile per questo setup Stripe.";
    code = stripeError.code || "STRIPE_UNSUPPORTED_COUNTRY";
  } else if (normalized.includes("account link")) {
    message = "Stripe non e' riuscito a generare il link di onboarding. Riprova tra poco.";
    code = stripeError.code || "STRIPE_ACCOUNT_LINK_ERROR";
  }

  return {
    error: message,
    details,
    code,
    stripeRequestId: stripeError.requestId || null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const canonicalUrl = Deno.env.get("APP_CANONICAL_URL");
    const missingEnv = [
      !stripeKey ? "STRIPE_SECRET_KEY" : null,
      !supabaseUrl ? "SUPABASE_URL" : null,
      !serviceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : null,
      !canonicalUrl ? "APP_CANONICAL_URL" : null,
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
      logStep("Auth error", authError);
      return jsonResponse({ error: "Unauthorized", details: authError?.message ?? null, code: "UNAUTHORIZED" }, 401);
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
      return jsonResponse(
        {
          error: "Il paese payout e' bloccato dopo la creazione dell'account Stripe. Se hai scelto il paese sbagliato, contatta il supporto per ricreare l'account.",
          code: "STRIPE_COUNTRY_LOCKED",
        },
        409
      );
    }

    if (!stripeAccountId) {
      if (!effectiveCountry || !isSupportedStripePayoutCountry(effectiveCountry)) {
        return jsonResponse(
          {
            error: "Seleziona un paese payout supportato prima di iniziare l'onboarding Stripe.",
            code: "STRIPE_COUNTRY_REQUIRED",
          },
          400
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
        return jsonResponse({
          success: true,
          alreadyConnected: true,
          payouts_enabled: true,
          country: effectiveCountry,
        });
      }
    }

    const origin = resolveRequestOrigin(req.headers.get("origin"));
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: buildPaymentsUrl(origin, { stripe_refresh: "true" }),
      return_url: buildPaymentsUrl(origin, { stripe_onboarding: "complete" }),
      type: "account_onboarding",
    });

    logStep("Account link created", { stripeAccountId, country: effectiveCountry });

    return jsonResponse({
      url: accountLink.url,
      stripeAccountId,
      country: effectiveCountry,
    });
  } catch (error: unknown) {
    const payload = classifyStripeConnectError(error);

    logStep("ERROR", payload);

    return jsonResponse(payload, 500);
  }
});

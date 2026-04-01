import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-STRIPE-LOGIN-LINK] ${step}${detailsStr}`);
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

    const { data: connectedAccount, error: accountError } = await supabase
      .from("stripe_connected_accounts")
      .select("stripe_account_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (accountError || !connectedAccount?.stripe_account_id) {
      logStep("No connected account found", { userId: user.id, accountError });
      return jsonResponse(
        {
          error: "Configura prima il tuo account payout Stripe.",
          details: accountError?.message ?? null,
          code: "STRIPE_ACCOUNT_MISSING",
        },
        400
      );
    }

    const loginLink = await stripe.accounts.createLoginLink(connectedAccount.stripe_account_id);

    return jsonResponse({ url: loginLink.url });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const stripeError = error as { code?: string; requestId?: string };
    logStep("ERROR", { error: errorMessage, code: stripeError.code, requestId: stripeError.requestId });
    return jsonResponse(
      {
        error: "Impossibile aprire il dashboard Stripe.",
        details: errorMessage,
        code: stripeError.code || "STRIPE_LOGIN_LINK_FAILED",
        stripeRequestId: stripeError.requestId || null,
      },
      500
    );
  }
});

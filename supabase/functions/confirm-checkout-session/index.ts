import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CONFIRM-CHECKOUT] ${step}${detailsStr}`);
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseCoins(value: string | null | undefined) {
  const coins = Number.parseFloat(value ?? "");
  return Number.isFinite(coins) && coins > 0 ? coins : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return jsonResponse({ error: "Payment system not configured." }, 503);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "No authorization header" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse({ error: "Invalid token" }, 401);
    }

    const payload = await req.json().catch(() => ({}));
    const sessionId = typeof payload?.sessionId === "string" ? payload.sessionId.trim() : "";
    if (!sessionId || !sessionId.startsWith("cs_")) {
      return jsonResponse({ error: "Invalid Stripe session id." }, 400);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const sessionUserId = session.metadata?.user_id;
    const coins = parseCoins(session.metadata?.coins);

    if (sessionUserId !== user.id) {
      logStep("Session user mismatch", { sessionId, authUserId: user.id, sessionUserId });
      return jsonResponse({ error: "This payment belongs to a different user." }, 403);
    }

    if (!coins) {
      return jsonResponse({ error: "Missing checkout coin metadata." }, 400);
    }

    if (session.status !== "complete" || session.payment_status !== "paid") {
      logStep("Session not paid yet", {
        sessionId,
        status: session.status,
        paymentStatus: session.payment_status,
      });
      return jsonResponse({
        success: true,
        credited: false,
        pending: true,
        status: session.status,
        paymentStatus: session.payment_status,
      });
    }

    const { data, error } = await supabase.rpc("credit_stripe_checkout_session", {
      p_user_id: user.id,
      p_session_id: session.id,
      p_coins: coins,
      p_description: `Purchased ${coins} Coins via Stripe`,
    });

    if (error) {
      logStep("Credit RPC failed", { sessionId, error });
      throw error;
    }

    logStep("Checkout confirmed", { sessionId, result: data });
    return jsonResponse({ success: true, ...(data && typeof data === "object" ? data : {}) });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("ERROR", { message: errorMessage });
    return jsonResponse({ error: errorMessage }, 500);
  }
});

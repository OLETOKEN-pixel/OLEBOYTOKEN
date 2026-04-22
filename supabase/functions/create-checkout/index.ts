import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveRequestOrigin } from "../_shared/app-url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

const PROCESSING_FEE = 0.50; // Fixed EUR 0.50 fee
const COIN_PACKAGES = [
  { id: "pack-3", coins: 3, price: 3 },
  { id: "pack-5", coins: 5, price: 5 },
  { id: "pack-10", coins: 10, price: 10 },
  { id: "pack-15", coins: 15, price: 15 },
  { id: "pack-25", coins: 25, price: 25 },
  { id: "pack-50", coins: 50, price: 50 },
] as const;

function resolveCoinPackage(body: { packageId?: string; amount?: number }) {
  if (body.packageId) {
    return COIN_PACKAGES.find((pack) => pack.id === body.packageId) ?? null;
  }

  if (typeof body.amount === "number") {
    return COIN_PACKAGES.find((pack) => pack.coins === body.amount) ?? null;
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      logStep("CRITICAL: STRIPE_SECRET_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Payment system not configured. Contact support." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isLiveMode = stripeKey.startsWith("sk_live_");
    logStep(`Mode: ${isLiveMode ? "LIVE" : "TEST"}`);

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("No authorization header");
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      logStep("Auth error", authError);
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("User authenticated", { userId: user.id, email: user.email });

    const payload = await req.json();
    const coinPackage = resolveCoinPackage(payload);

    if (!coinPackage) {
      logStep("Invalid package", { packageId: payload?.packageId, amount: payload?.amount });
      return new Response(
        JSON.stringify({ error: "Invalid coin package." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const origin = resolveRequestOrigin(req.headers.get("origin"));
    const totalAmount = coinPackage.price + PROCESSING_FEE;

    logStep("Creating checkout session", {
      packageId: coinPackage.id,
      coins: coinPackage.coins,
      fee: PROCESSING_FEE,
      total: totalAmount,
      origin,
    });

    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      // Dynamic payment methods: Stripe shows every enabled compatible method
      // from the Dashboard (cards, wallets, PayPal, Amazon Pay, etc.).
      automatic_payment_methods: { enabled: true },
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `${coinPackage.coins} Coins`,
              description: "OLEBOY TOKEN Gaming Coins",
            },
            unit_amount: Math.round(coinPackage.price * 100),
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "Commissione di servizio",
              description: "Processing fee",
            },
            unit_amount: Math.round(PROCESSING_FEE * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/payment/success?provider=stripe&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/buy?canceled=true`,
      metadata: {
        user_id: user.id,
        package_id: coinPackage.id,
        coins: coinPackage.coins.toString(),
        fee: PROCESSING_FEE.toString(),
      },
    });

    logStep("Checkout session created", {
      sessionId: session.id,
      mode: isLiveMode ? "LIVE" : "TEST",
      packageId: coinPackage.id,
      dynamicPaymentMethods: true,
    });

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

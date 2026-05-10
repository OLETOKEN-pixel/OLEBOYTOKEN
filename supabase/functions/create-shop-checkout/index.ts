import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveRequestOrigin } from "../_shared/app-url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-SHOP-CHECKOUT] ${step}${detailsStr}`);
};

type ShopItemRow = {
  id: string;
  slug: string;
  kind: "coin_pack" | "vip_membership" | "physical_product" | "physical_reward" | "action_card";
  title: string;
  subtitle: string;
  description: string;
  image_path: string;
  coin_amount: number | null;
};

type ShopPriceRow = {
  amount_minor: number;
  audience: "base" | "vip";
  currency: "eur" | "coins";
};

type ShopSurfaceSlotRow = {
  item_id: string;
};

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function extractTrailingNumber(value: string) {
  const match = value.match(/(\d+)(?!.*\d)/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildCatalogImageUrl(origin: string, supabaseUrl: string, imagePath: string) {
  if (!imagePath) return `${origin}/coin.png`;
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) return imagePath;
  if (imagePath.startsWith("/")) return `${origin}${imagePath}`;
  return `${supabaseUrl}/storage/v1/object/public/shop-catalog/${imagePath}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!stripeKey || !supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Checkout is not configured." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const user = authData.user;

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload = await req.json().catch(() => ({}));
    const requestedItemId = typeof payload?.itemId === "string" ? payload.itemId.trim() : "";
    const requestedSlotId = typeof payload?.slotId === "string" ? payload.slotId.trim() : "";
    const requestedSlug = typeof payload?.slug === "string" ? payload.slug.trim() : "";
    const requestedKind = typeof payload?.kind === "string" ? payload.kind.trim() : "";
    const requestedCoinAmount =
      typeof payload?.coinAmount === "number" && Number.isFinite(payload.coinAmount)
        ? payload.coinAmount
        : extractTrailingNumber(requestedItemId || requestedSlug);

    if (!requestedItemId && !requestedSlotId && !requestedSlug && !requestedCoinAmount) {
      return new Response(
        JSON.stringify({ error: "itemId is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let itemData: ShopItemRow | null = null;
    const lookupErrors: unknown[] = [];

    if (requestedItemId && looksLikeUuid(requestedItemId)) {
      const response = await supabase
        .from("shop_items")
        .select("id, slug, kind, title, subtitle, description, image_path, coin_amount")
        .eq("id", requestedItemId)
        .eq("is_active", true)
        .maybeSingle();
      itemData = (response.data as ShopItemRow | null) ?? null;
      if (response.error) lookupErrors.push(response.error);
    }

    const slugCandidates = Array.from(
      new Set(
        [requestedSlug, looksLikeUuid(requestedItemId) ? "" : requestedItemId]
          .map((entry) => entry.trim())
          .filter(Boolean),
      ),
    );

    for (const slugCandidate of slugCandidates) {
      if (itemData) break;
      const response = await supabase
        .from("shop_items")
        .select("id, slug, kind, title, subtitle, description, image_path, coin_amount")
        .eq("slug", slugCandidate)
        .eq("is_active", true)
        .maybeSingle();
      itemData = (response.data as ShopItemRow | null) ?? null;
      if (response.error) lookupErrors.push(response.error);
    }

    if (!itemData && requestedSlotId && looksLikeUuid(requestedSlotId)) {
      const slotResponse = await supabase
        .from("shop_surface_slots")
        .select("item_id")
        .eq("id", requestedSlotId)
        .eq("is_active", true)
        .maybeSingle();

      const slot = (slotResponse.data as ShopSurfaceSlotRow | null) ?? null;
      if (slotResponse.error) lookupErrors.push(slotResponse.error);

      if (slot?.item_id) {
        const itemResponse = await supabase
          .from("shop_items")
          .select("id, slug, kind, title, subtitle, description, image_path, coin_amount")
          .eq("id", slot.item_id)
          .eq("is_active", true)
          .maybeSingle();
        itemData = (itemResponse.data as ShopItemRow | null) ?? null;
        if (itemResponse.error) lookupErrors.push(itemResponse.error);
      }
    }

    if (!itemData && requestedCoinAmount && (!requestedKind || requestedKind === "coin_pack")) {
      const response = await supabase
        .from("shop_items")
        .select("id, slug, kind, title, subtitle, description, image_path, coin_amount")
        .eq("kind", "coin_pack")
        .eq("coin_amount", requestedCoinAmount)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      itemData = (response.data as ShopItemRow | null) ?? null;
      if (response.error) lookupErrors.push(response.error);
    }

    if (!itemData) {
      logStep("LOOKUP_FAILED", {
        requestedItemId: requestedItemId || null,
        requestedSlotId: requestedSlotId || null,
        requestedSlug: requestedSlug || null,
        requestedKind: requestedKind || null,
        requestedCoinAmount: requestedCoinAmount ?? null,
        lookupErrors,
      });
      return new Response(
        JSON.stringify({
          error: "Shop item not found.",
          requestedItemId: requestedItemId || null,
          requestedSlotId: requestedSlotId || null,
          requestedSlug: requestedSlug || null,
          requestedKind: requestedKind || null,
          requestedCoinAmount: requestedCoinAmount ?? null,
          lookupErrors,
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const item = itemData as ShopItemRow;

    if (item.kind !== "coin_pack" && item.kind !== "physical_product") {
      return new Response(
        JSON.stringify({ error: "This item cannot be purchased with Stripe checkout." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: vipData } = await supabase.rpc("check_vip_status", { p_user_id: user.id });
    const isVip = Boolean((vipData as { is_vip?: boolean } | null)?.is_vip);
    const preferredAudience = isVip ? "vip" : "base";

    const { data: priceRows, error: priceError } = await supabase
      .from("shop_item_prices")
      .select("amount_minor, audience, currency")
      .eq("item_id", item.id)
      .eq("is_active", true)
      .eq("currency", "eur");

    if (priceError) {
      return new Response(
        JSON.stringify({ error: "Unable to load shop pricing." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const prices = (priceRows ?? []) as ShopPriceRow[];
    const price = prices.find((entry) => entry.audience === preferredAudience) ?? prices.find((entry) => entry.audience === "base");

    if (!price) {
      return new Response(
        JSON.stringify({ error: "No EUR price configured for this item." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const origin = resolveRequestOrigin(req.headers.get("origin"));
    const imageUrl = buildCatalogImageUrl(origin, supabaseUrl, item.image_path);
    const description =
      item.kind === "coin_pack" && item.coin_amount
        ? `${item.coin_amount} OBC coins`
        : item.description || item.subtitle || item.title;

    logStep("Creating checkout session", {
      itemId: item.id,
      slug: item.slug,
      kind: item.kind,
      audience: price.audience,
      priceMinor: price.amount_minor,
      isVip,
    });

    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: item.title,
              description,
              images: [imageUrl],
            },
            unit_amount: price.amount_minor,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/payment/success?provider=stripe&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/shop?canceled=true`,
      metadata: {
        user_id: user.id,
        shop_item_id: item.id,
        shop_item_slug: item.slug,
        shop_item_kind: item.kind,
        audience: price.audience,
      },
    });

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

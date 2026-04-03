import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CANONICAL_APP_URL = "https://www.oleboytoken.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  console.log(`[TWITCH-AUTH-START] ${step}`, details ? JSON.stringify(details) : "");
};

function getRedirectUri(): string {
  const envUri = Deno.env.get("TWITCH_REDIRECT_URI");
  if (envUri) {
    return envUri;
  }
  return `${CANONICAL_APP_URL}/auth/twitch/callback`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const clientId = Deno.env.get("TWITCH_CLIENT_ID");
    const redirectUri = getRedirectUri();

    if (!clientId) {
      logStep("Missing Twitch credentials", { hasClientId: !!clientId });
      return new Response(
        JSON.stringify({ error: "Twitch OAuth not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("Missing auth header");
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      logStep("Auth error", { error: authError?.message });
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("User authenticated", { userId: user.id });

    // Generate random state for CSRF protection
    const state = crypto.randomUUID();

    // Clean up any existing states for this user first
    await supabaseAdmin
      .from("twitch_oauth_states")
      .delete()
      .eq("user_id", user.id);

    // Insert new state
    const { error: stateError } = await supabaseAdmin
      .from("twitch_oauth_states")
      .insert({
        user_id: user.id,
        state,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

    if (stateError) {
      logStep("State insert error", { error: stateError.message });
      return new Response(
        JSON.stringify({ error: `Twitch OAuth state setup failed: ${stateError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("State saved", { state: state.substring(0, 8) + "..." });

    // Build Twitch authorization URL
    const authUrl = new URL("https://id.twitch.tv/oauth2/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", "user:read:email");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("force_verify", "true");

    logStep("Authorization URL built", {
      url: authUrl.toString().replace(clientId, "***"),
      redirectUri,
    });

    return new Response(
      JSON.stringify({ authUrl: authUrl.toString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("Error", { error: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CANONICAL_APP_URL = "https://www.oleboytoken.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  console.log(`[TWITTER-AUTH-START] ${step}`, details ? JSON.stringify(details) : "");
};

function getRedirectUri(): string {
  const envUri = Deno.env.get("TWITTER_REDIRECT_URI");
  if (envUri) {
    return envUri;
  }
  return `${CANONICAL_APP_URL}/auth/twitter/callback`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const clientId = Deno.env.get("TWITTER_CLIENT_ID");
    const redirectUri = getRedirectUri();

    if (!clientId) {
      logStep("Missing Twitter credentials", { hasClientId: !!clientId });
      return new Response(
        JSON.stringify({ error: "Twitter OAuth not configured" }),
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

    // Generate PKCE code_verifier and code_challenge
    const verifierBytes = new Uint8Array(32);
    crypto.getRandomValues(verifierBytes);
    const codeVerifier = btoa(String.fromCharCode(...verifierBytes))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const challengeBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(codeVerifier)
    );
    const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(challengeBuffer)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    // Generate random state for CSRF protection
    const state = crypto.randomUUID();

    // Clean up any existing states for this user first
    await supabaseAdmin
      .from("twitter_oauth_states")
      .delete()
      .eq("user_id", user.id);

    // Insert new state with code_verifier
    const { error: stateError } = await supabaseAdmin
      .from("twitter_oauth_states")
      .insert({
        user_id: user.id,
        state,
        code_verifier: codeVerifier,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

    if (stateError) {
      logStep("State insert error", { error: stateError.message });
      return new Response(
        JSON.stringify({ error: `Twitter OAuth state setup failed: ${stateError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("State saved", { state: state.substring(0, 8) + "..." });

    // Build Twitter authorization URL (OAuth 2.0 with PKCE)
    const authUrl = new URL("https://twitter.com/i/oauth2/authorize");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", "tweet.read users.read");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

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

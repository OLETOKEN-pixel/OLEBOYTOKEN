import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CANONICAL_APP_URL = "https://www.oleboytoken.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  console.log(`[TWITTER-AUTH-CALLBACK] ${step}`, details ? JSON.stringify(details) : "");
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
    const clientSecret = Deno.env.get("TWITTER_CLIENT_SECRET");
    const redirectUri = getRedirectUri();

    if (!clientId || !clientSecret) {
      logStep("Missing Twitter credentials");
      return new Response(
        JSON.stringify({ error: "Twitter OAuth not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { code, state } = await req.json();

    if (!code || !state) {
      logStep("Missing code or state", { hasCode: !!code, hasState: !!state });
      return new Response(
        JSON.stringify({ error: "Missing authorization code or state" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Received callback", { state: state.substring(0, 8) + "..." });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Validate state and get user_id + code_verifier
    const { data: stateRecord, error: stateError } = await supabase
      .from("twitter_oauth_states")
      .select("*")
      .eq("state", state)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (stateError || !stateRecord) {
      logStep("Invalid or expired state", { error: stateError?.message });
      return new Response(
        JSON.stringify({ error: "Invalid or expired authorization state. Please try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = stateRecord.user_id;
    const codeVerifier = stateRecord.code_verifier;
    logStep("State validated", { userId });

    // Delete state immediately (one-time use)
    await supabase.from("twitter_oauth_states").delete().eq("id", stateRecord.id);

    // Exchange code for access token (Twitter OAuth 2.0 with PKCE)
    const tokenUrl = "https://api.twitter.com/2/oauth2/token";
    const credentials = btoa(`${clientId}:${clientSecret}`);

    logStep("Exchanging code for token");

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    const tokenText = await tokenResponse.text();
    let tokenData;
    try {
      tokenData = JSON.parse(tokenText);
    } catch {
      logStep("Token response not JSON", { status: tokenResponse.status, body: tokenText.substring(0, 500) });
      return new Response(
        JSON.stringify({ error: "Invalid response from Twitter token endpoint" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tokenResponse.ok || !tokenData.access_token) {
      logStep("Token exchange failed", {
        status: tokenResponse.status,
        error: tokenData.error,
        errorDescription: tokenData.error_description,
      });
      return new Response(
        JSON.stringify({ error: tokenData.error_description || tokenData.error || "Failed to exchange code for token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Token received");

    // Fetch user info from Twitter API v2
    const userInfoResponse = await fetch("https://api.twitter.com/2/users/me", {
      headers: {
        "Authorization": `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      logStep("User info fetch failed", { status: userInfoResponse.status });
      return new Response(
        JSON.stringify({ error: "Could not retrieve Twitter account information" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userInfoData = await userInfoResponse.json();
    const twitterAccountId = userInfoData.data?.id;
    const twitterUsername = userInfoData.data?.username;

    logStep("Twitter account info", { twitterAccountId, twitterUsername });

    if (!twitterAccountId) {
      logStep("Could not retrieve Twitter account ID");
      return new Response(
        JSON.stringify({ error: "Could not retrieve Twitter account information" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if this Twitter account is already linked to another user
    const { data: existingLink } = await supabase
      .from("profiles")
      .select("user_id, username")
      .eq("twitter_account_id", twitterAccountId)
      .neq("user_id", userId)
      .maybeSingle();

    if (existingLink) {
      logStep("Twitter account already linked to another user", { existingUserId: existingLink.user_id });
      return new Response(
        JSON.stringify({
          error: `This X (Twitter) account is already linked to another user (${existingLink.username}).`,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update user profile with Twitter info
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        twitter_account_id: twitterAccountId,
        twitter_username: twitterUsername,
        twitter_linked_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (updateError) {
      logStep("Profile update failed", { error: updateError.message, code: updateError.code });

      if (updateError.code === "23505") {
        return new Response(
          JSON.stringify({ error: "This X (Twitter) account is already linked to another user." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw updateError;
    }

    logStep("Profile updated successfully", { userId, twitterUsername });

    return new Response(
      JSON.stringify({
        success: true,
        twitterUsername,
        twitterAccountId,
      }),
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

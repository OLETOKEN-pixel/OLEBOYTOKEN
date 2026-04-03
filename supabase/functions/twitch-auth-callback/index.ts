import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CANONICAL_APP_URL = "https://www.oleboytoken.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  console.log(`[TWITCH-AUTH-CALLBACK] ${step}`, details ? JSON.stringify(details) : "");
};

function getClientSecret(): string | undefined {
  return Deno.env.get("TWITCH_CLIENT_SECRET") ?? Deno.env.get("TWITCH_SECRET") ?? undefined;
}

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
    const clientSecret = getClientSecret();
    const redirectUri = getRedirectUri();

    if (!clientId || !clientSecret) {
      logStep("Missing Twitch credentials", {
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
      });
      return new Response(
        JSON.stringify({ error: "Twitch OAuth not configured" }),
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

    // Validate state and get user_id
    const { data: stateRecord, error: stateError } = await supabase
      .from("twitch_oauth_states")
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
    logStep("State validated", { userId });

    // Delete state immediately (one-time use)
    await supabase.from("twitch_oauth_states").delete().eq("id", stateRecord.id);

    // Exchange code for access token
    // Twitch takes client_id and client_secret in the body (NOT Basic auth header)
    const tokenUrl = "https://id.twitch.tv/oauth2/token";

    logStep("Exchanging code for token");

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const tokenText = await tokenResponse.text();
    let tokenData;
    try {
      tokenData = JSON.parse(tokenText);
    } catch {
      logStep("Token response not JSON", { status: tokenResponse.status, body: tokenText.substring(0, 500) });
      return new Response(
        JSON.stringify({ error: "Invalid response from Twitch token endpoint" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tokenResponse.ok || !tokenData.access_token) {
      logStep("Token exchange failed", {
        status: tokenResponse.status,
        error: tokenData.error,
        errorDescription: tokenData.message,
      });
      return new Response(
        JSON.stringify({ error: tokenData.message || tokenData.error || "Failed to exchange code for token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Token received");

    // Fetch user info from Twitch Helix API (requires Client-Id header)
    const userInfoResponse = await fetch("https://api.twitch.tv/helix/users", {
      headers: {
        "Authorization": `Bearer ${tokenData.access_token}`,
        "Client-Id": clientId,
      },
    });

    if (!userInfoResponse.ok) {
      logStep("User info fetch failed", { status: userInfoResponse.status });
      return new Response(
        JSON.stringify({ error: "Could not retrieve Twitch account information" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userInfoData = await userInfoResponse.json();
    const twitchUser = userInfoData.data?.[0];
    const twitchAccountId = twitchUser?.id;
    const twitchUsername = twitchUser?.display_name || twitchUser?.login;

    logStep("Twitch account info", { twitchAccountId, twitchUsername });

    if (!twitchAccountId) {
      logStep("Could not retrieve Twitch account ID");
      return new Response(
        JSON.stringify({ error: "Could not retrieve Twitch account information" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if this Twitch account is already linked to another user
    const { data: existingLink } = await supabase
      .from("profiles")
      .select("user_id, username")
      .eq("twitch_account_id", twitchAccountId)
      .neq("user_id", userId)
      .maybeSingle();

    if (existingLink) {
      logStep("Twitch account already linked to another user", { existingUserId: existingLink.user_id });
      return new Response(
        JSON.stringify({
          error: `This Twitch account is already linked to another user (${existingLink.username}).`,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update user profile with Twitch info
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        twitch_account_id: twitchAccountId,
        twitch_username: twitchUsername,
        twitch_linked_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (updateError) {
      logStep("Profile update failed", { error: updateError.message, code: updateError.code });

      if (updateError.code === "23505") {
        return new Response(
          JSON.stringify({ error: "This Twitch account is already linked to another user." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw updateError;
    }

    logStep("Profile updated successfully", { userId, twitchUsername });

    return new Response(
      JSON.stringify({
        success: true,
        twitchUsername,
        twitchAccountId,
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

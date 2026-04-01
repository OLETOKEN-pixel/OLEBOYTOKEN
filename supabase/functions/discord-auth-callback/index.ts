import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CANONICAL_APP_URL = "https://www.oleboytoken.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  console.log(`[DISCORD-AUTH-CALLBACK] ${step}`, details ? JSON.stringify(details) : "");
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function getRedirectUri(): string {
  const envUri = Deno.env.get("DISCORD_REDIRECT_URI");
  if (envUri) {
    return envUri;
  }
  return `${CANONICAL_APP_URL}/auth/discord/callback`;
}

// Generate a deterministic password for Discord users
async function generateUserPassword(discordId: string, serviceKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`discord-auth-${discordId}-${serviceKey}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashBase64 = btoa(String.fromCharCode(...hashArray));
  return hashBase64.slice(0, 32);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const { code, state } = await req.json();

    if (!code || !state) {
      return jsonResponse(
        {
          error: "Missing code or state parameter.",
          code: "DISCORD_CALLBACK_PARAMS_MISSING",
        },
        400
      );
    }

    logStep("Received callback", { state: state.substring(0, 8) + "..." });

    const clientId = Deno.env.get("DISCORD_CLIENT_ID");
    const clientSecret = Deno.env.get("DISCORD_CLIENT_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const redirectUri = getRedirectUri();
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    const guildId = Deno.env.get("DISCORD_GUILD_ID");
    const missingEnv = [
      !clientId ? "DISCORD_CLIENT_ID" : null,
      !clientSecret ? "DISCORD_CLIENT_SECRET" : null,
      !supabaseUrl ? "SUPABASE_URL" : null,
      !serviceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : null,
    ].filter((value): value is string => Boolean(value));

    if (missingEnv.length > 0) {
      logStep("Missing Discord credentials", { missingEnv, hasRedirectUri: !!redirectUri });
      return jsonResponse(
        {
          error: "Discord OAuth non configurato correttamente.",
          details: `Missing environment variables: ${missingEnv.join(", ")}`,
          code: "DISCORD_CONFIG_MISSING",
        },
        500
      );
    }

    const supabaseAdmin = createClient(supabaseUrl!, serviceRoleKey!);

    const { data: stateRecord, error: stateError } = await supabaseAdmin
      .from("discord_oauth_states")
      .select("*")
      .eq("state", state)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (stateError || !stateRecord) {
      logStep("Invalid or expired state", { error: stateError?.message });
      return jsonResponse(
        {
          error: "Invalid or expired state. Please try again.",
          details: stateError?.message ?? null,
          code: "DISCORD_STATE_INVALID",
        },
        400
      );
    }

    logStep("State validated", { redirectAfter: stateRecord.redirect_after });

    await supabaseAdmin
      .from("discord_oauth_states")
      .delete()
      .eq("id", stateRecord.id);

    logStep("Exchanging code for token");
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      logStep("Token exchange failed", { status: tokenResponse.status, error: errorText });
      return jsonResponse(
        {
          error: "Failed to exchange authorization code.",
          details: errorText,
          code: "DISCORD_TOKEN_EXCHANGE_FAILED",
        },
        400
      );
    }

    const tokenData = await tokenResponse.json();
    logStep("Token received", { tokenType: tokenData.token_type, scope: tokenData.scope });

    logStep("Fetching Discord user profile");
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      logStep("User fetch failed", { status: userResponse.status, error: errorText });
      return jsonResponse(
        {
          error: "Failed to fetch Discord user profile.",
          details: errorText,
          code: "DISCORD_PROFILE_FETCH_FAILED",
        },
        400
      );
    }

    const discordUser = await userResponse.json();
    logStep("Discord user fetched", {
      id: discordUser.id,
      username: discordUser.username,
      globalName: discordUser.global_name,
      hasEmail: !!discordUser.email,
    });

    const discordAvatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=256`
      : null;

    const userPassword = await generateUserPassword(discordUser.id, serviceRoleKey!);

    let existingProfile = null;

    const { data: profileByDiscord } = await supabaseAdmin
      .from("profiles")
      .select("user_id, email")
      .eq("discord_user_id", discordUser.id)
      .maybeSingle();

    if (profileByDiscord) {
      existingProfile = profileByDiscord;
      logStep("Found existing profile by discord_user_id", { userId: existingProfile.user_id });
    } else if (discordUser.email) {
      const { data: profileByEmail } = await supabaseAdmin
        .from("profiles")
        .select("user_id, email")
        .eq("email", discordUser.email)
        .maybeSingle();

      if (profileByEmail) {
        existingProfile = profileByEmail;
        logStep("Found existing profile by email", { userId: existingProfile.user_id });
      }
    }

    let userId: string;
    let userEmail: string;

    if (!discordUser.email) {
      return jsonResponse(
        {
          error: "Email is required. Please authorize email access on Discord.",
          code: "DISCORD_EMAIL_REQUIRED",
        },
        400
      );
    }

    userEmail = discordUser.email;
    const displayName =
      (discordUser.global_name || discordUser.username).replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20) || "user";

    if (existingProfile) {
      userId = existingProfile.user_id;

      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({
          username: displayName,
          discord_user_id: discordUser.id,
          discord_username: discordUser.username,
          discord_display_name: discordUser.global_name || discordUser.username,
          discord_avatar_url: discordAvatarUrl,
          discord_linked_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (updateError) {
        logStep("Profile update error", { error: updateError.message });
        throw updateError;
      }

      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: userPassword,
      });

      logStep("Profile updated with Discord data", { userId });
    } else {
      const { data: { users: existingAuthUsers } } = await supabaseAdmin.auth.admin.listUsers();
      const matchingAuthUser = existingAuthUsers.find((candidate) => candidate.email === discordUser.email);

      if (matchingAuthUser) {
        userId = matchingAuthUser.id;
        logStep("Found auth user without profile, creating profile", { userId, email: userEmail });

        const { error: insertError } = await supabaseAdmin
          .from("profiles")
          .insert({
            user_id: userId,
            email: discordUser.email,
            username: displayName,
            discord_user_id: discordUser.id,
            discord_username: discordUser.username,
            discord_display_name: discordUser.global_name || discordUser.username,
            discord_avatar_url: discordAvatarUrl,
            discord_linked_at: new Date().toISOString(),
          });

        if (insertError) {
          logStep("Profile insert error", { error: insertError.message });
          throw insertError;
        }

        await supabaseAdmin
          .from("wallets")
          .upsert({ user_id: userId, balance: 0, locked_balance: 0 }, { onConflict: "user_id" });

        await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: userPassword,
        });

        logStep("Created profile for existing auth user", { userId });
      } else {
        logStep("Creating new user");

        let baseUsername = discordUser.username.replace(/[^a-zA-Z0-9_]/g, "");
        if (baseUsername.length < 3) {
          baseUsername = "user" + discordUser.id.substring(0, 6);
        }

        let finalUsername = baseUsername;
        let counter = 1;
        while (true) {
          const { data: existingUsername } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("username", finalUsername)
            .maybeSingle();

          if (!existingUsername) break;
          finalUsername = `${baseUsername}${counter}`;
          counter++;
          if (counter > 100) {
            finalUsername = `${baseUsername}${Date.now().toString().slice(-6)}`;
            break;
          }
        }

        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: discordUser.email,
          password: userPassword,
          email_confirm: true,
          user_metadata: {
            discord_id: discordUser.id,
            discord_username: discordUser.username,
          },
        });

        if (authError) {
          logStep("Auth user creation error", { error: authError.message });
          throw authError;
        }

        userId = authUser.user.id;

        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .insert({
            user_id: userId,
            username: finalUsername,
            email: discordUser.email,
            discord_user_id: discordUser.id,
            discord_username: discordUser.username,
            discord_display_name: discordUser.global_name || discordUser.username,
            discord_avatar_url: discordAvatarUrl,
            discord_linked_at: new Date().toISOString(),
          });

        if (profileError) {
          logStep("Profile creation error", { error: profileError.message });
          throw profileError;
        }

        await supabaseAdmin
          .from("wallets")
          .insert({ user_id: userId, balance: 0, locked_balance: 0 });

        logStep("New user created", { userId, username: finalUsername });
      }
    }

    if (botToken && guildId) {
      logStep("Attempting auto-join to Discord server");
      try {
        const joinResponse = await fetch(
          `https://discord.com/api/guilds/${guildId}/members/${discordUser.id}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bot ${botToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              access_token: tokenData.access_token,
            }),
          }
        );

        if (joinResponse.status === 201) {
          logStep("User added to Discord server");
        } else if (joinResponse.status === 204) {
          logStep("User already a member of Discord server");
        } else {
          const errorText = await joinResponse.text();
          logStep("Auto-join failed", { status: joinResponse.status, error: errorText });
        }
      } catch (joinError) {
        logStep("Auto-join error", { error: joinError instanceof Error ? joinError.message : "Unknown" });
      }
    } else {
      logStep("Skipping auto-join - bot token or guild ID not configured");
    }

    logStep("Generating persistent session with password sign-in");
    const { data: sessionData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: userEmail,
      password: userPassword,
    });

    if (signInError || !sessionData.session) {
      logStep("Session sign-in error", { error: signInError?.message });
      return jsonResponse(
        {
          error: "Failed to create session. Please try again.",
          details: signInError?.message ?? null,
          code: "DISCORD_SESSION_CREATE_FAILED",
        },
        500
      );
    }

    logStep("Login successful with persistent session", { userId, redirectTo: stateRecord.redirect_after });

    return jsonResponse({
      success: true,
      redirectTo: stateRecord.redirect_after || "/",
      accessToken: sessionData.session.access_token,
      refreshToken: sessionData.session.refresh_token,
      userId,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("Error", { error: errorMessage });
    return jsonResponse(
      {
        error: "Discord login failed while finalizing your account.",
        details: errorMessage,
        code: "DISCORD_CALLBACK_FAILED",
      },
      500
    );
  }
});

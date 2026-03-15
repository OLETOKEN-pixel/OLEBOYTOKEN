import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseDiscordError(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body);
    const code = parsed.code;
    const message = parsed.message || "";

    if (status === 401) return `Invalid bot token`;
    if (status === 403) return `Bot missing permissions (needs CREATE_INSTANT_INVITE). Discord: ${message}`;
    if (status === 404) return `Guild not found — check DISCORD_GUILD_ID`;
    if (code === 30001) return `Maximum members reached`;
    if (code === 40007) return `User is banned from this guild`;

    return `Discord API error ${status} (code: ${code}): ${message}`;
  } catch {
    return `Discord API error ${status}: ${body.substring(0, 200)}`;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    const guildId = Deno.env.get("DISCORD_GUILD_ID");

    if (!botToken || !guildId) {
      const missing = [];
      if (!botToken) missing.push("DISCORD_BOT_TOKEN");
      if (!guildId) missing.push("DISCORD_GUILD_ID");
      console.warn(`[DISCORD-AUTO-JOIN] Skipped — missing secrets: ${missing.join(", ")}`);
      return new Response(
        JSON.stringify({ skipped: true, reason: `Missing: ${missing.join(", ")}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[DISCORD-AUTO-JOIN] Config OK — guild: ${guildId}`);

    const { providerToken } = await req.json();

    if (!providerToken) {
      console.warn("[DISCORD-AUTO-JOIN] No provider token in request body");
      return new Response(
        JSON.stringify({ error: "Missing provider token", detail: "OAuth provider_token was not passed to this function" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Discord user ID from the provider token
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${providerToken}` },
    });

    if (!userResponse.ok) {
      const errorBody = await userResponse.text();
      console.error(`[DISCORD-AUTO-JOIN] Failed to fetch Discord user: ${userResponse.status} ${errorBody}`);
      return new Response(
        JSON.stringify({ error: "Failed to fetch Discord user", detail: `Token may be expired or invalid (${userResponse.status})` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const discordUser = await userResponse.json();
    console.log(`[DISCORD-AUTO-JOIN] User: ${discordUser.id} (${discordUser.username}) → guild ${guildId}`);

    // Add user to guild using bot token
    const joinResponse = await fetch(
      `https://discord.com/api/guilds/${guildId}/members/${discordUser.id}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          access_token: providerToken,
        }),
      }
    );

    if (joinResponse.status === 201) {
      console.log(`[DISCORD-AUTO-JOIN] ✓ User ${discordUser.username} added to server`);
      return new Response(
        JSON.stringify({ success: true, action: "added" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (joinResponse.status === 204) {
      console.log(`[DISCORD-AUTO-JOIN] ✓ User ${discordUser.username} already a member`);
      return new Response(
        JSON.stringify({ success: true, action: "already_member" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const errorBody = await joinResponse.text();
      const errorDetail = parseDiscordError(joinResponse.status, errorBody);
      console.error(`[DISCORD-AUTO-JOIN] ✗ Failed to add ${discordUser.username}: ${errorDetail}`);
      return new Response(
        JSON.stringify({ error: "Failed to add user to server", detail: errorDetail, status: joinResponse.status }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[DISCORD-AUTO-JOIN] Unhandled error: ${errorMessage}`);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

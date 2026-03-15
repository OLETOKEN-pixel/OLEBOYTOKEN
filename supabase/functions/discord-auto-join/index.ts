import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    const guildId = Deno.env.get("DISCORD_GUILD_ID");

    if (!botToken || !guildId) {
      console.log("[DISCORD-AUTO-JOIN] Skipped — bot token or guild ID not configured");
      return new Response(
        JSON.stringify({ skipped: true, reason: "Not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { providerToken } = await req.json();

    if (!providerToken) {
      return new Response(
        JSON.stringify({ error: "Missing provider token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Discord user ID from the provider token
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${providerToken}` },
    });

    if (!userResponse.ok) {
      console.log("[DISCORD-AUTO-JOIN] Failed to fetch Discord user");
      return new Response(
        JSON.stringify({ error: "Failed to fetch Discord user" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const discordUser = await userResponse.json();
    console.log(`[DISCORD-AUTO-JOIN] Adding user ${discordUser.id} (${discordUser.username}) to guild`);

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
      console.log("[DISCORD-AUTO-JOIN] User added to server");
      return new Response(
        JSON.stringify({ success: true, action: "added" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (joinResponse.status === 204) {
      console.log("[DISCORD-AUTO-JOIN] User already a member");
      return new Response(
        JSON.stringify({ success: true, action: "already_member" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const errorText = await joinResponse.text();
      console.log(`[DISCORD-AUTO-JOIN] Failed: ${joinResponse.status} ${errorText}`);
      return new Response(
        JSON.stringify({ error: "Failed to add user to server", status: joinResponse.status }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.log(`[DISCORD-AUTO-JOIN] Error: ${errorMessage}`);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

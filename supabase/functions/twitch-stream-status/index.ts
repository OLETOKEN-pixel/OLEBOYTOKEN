import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getClientSecret(): string | undefined {
  return Deno.env.get("TWITCH_CLIENT_SECRET") ?? Deno.env.get("TWITCH_SECRET") ?? undefined;
}

type TwitchUser = {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
  offline_image_url: string;
};

type TwitchStream = {
  user_id: string;
  viewer_count: number;
  thumbnail_url: string;
};

async function getAppAccessToken(clientId: string, clientSecret: string) {
  const response = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.access_token) {
    throw new Error(payload?.message || payload?.error || "Failed to authenticate with Twitch");
  }

  return payload.access_token as string;
}

async function fetchTwitchUser(clientId: string, accessToken: string, login: string) {
  const response = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Client-Id": clientId,
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message || "Failed to fetch Twitch user");
  }

  return (payload?.data?.[0] ?? null) as TwitchUser | null;
}

async function fetchTwitchStream(clientId: string, accessToken: string, userId: string) {
  const response = await fetch(`https://api.twitch.tv/helix/streams?user_id=${encodeURIComponent(userId)}`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Client-Id": clientId,
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message || "Failed to fetch Twitch stream");
  }

  return (payload?.data?.[0] ?? null) as TwitchStream | null;
}

function resolveThumbnailUrl(template: string | null | undefined) {
  if (!template) return null;
  return template.replace("{width}", "1048").replace("{height}", "590");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const clientId = Deno.env.get("TWITCH_CLIENT_ID");
    const clientSecret = getClientSecret();

    if (!clientId || !clientSecret) {
      return jsonResponse({ error: "Twitch API not configured" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const rawUsername = typeof body?.twitch_username === "string" ? body.twitch_username : "";
    const twitchUsername = rawUsername.trim().replace(/^@+/, "");

    if (!twitchUsername) {
      return jsonResponse({ error: "Missing twitch_username" }, 400);
    }

    const accessToken = await getAppAccessToken(clientId, clientSecret);
    const user = await fetchTwitchUser(clientId, accessToken, twitchUsername);

    if (!user) {
      return jsonResponse({ error: "Twitch channel not found" }, 404);
    }

    const stream = await fetchTwitchStream(clientId, accessToken, user.id);

    return jsonResponse({
      success: true,
      twitchUsername: user.login,
      displayName: user.display_name || user.login,
      channelUrl: `https://www.twitch.tv/${encodeURIComponent(user.login)}`,
      isLive: Boolean(stream),
      viewerCount: stream?.viewer_count ?? null,
      thumbnailUrl: resolveThumbnailUrl(stream?.thumbnail_url),
      offlineImageUrl: user.offline_image_url || null,
      profileImageUrl: user.profile_image_url || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});

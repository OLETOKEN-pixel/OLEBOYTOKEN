CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = on) AS
  SELECT
    p.id,
    p.user_id,
    p.username,
    CASE
      WHEN p.discord_avatar_url IS NOT NULL THEN p.discord_avatar_url
      WHEN p.avatar_url ILIKE 'https://cdn.discordapp.com/%'
        OR p.avatar_url ILIKE 'https://media.discordapp.net/%'
      THEN p.avatar_url
      ELSE NULL
    END AS avatar_url,
    p.epic_username,
    p.twitch_username,
    p.preferred_region,
    p.preferred_platform,
    p.created_at,
    CASE
      WHEN p.discord_avatar_url IS NOT NULL THEN p.discord_avatar_url
      WHEN p.avatar_url ILIKE 'https://cdn.discordapp.com/%'
        OR p.avatar_url ILIKE 'https://media.discordapp.net/%'
      THEN p.avatar_url
      ELSE NULL
    END AS discord_avatar_url,
    p.discord_display_name
  FROM public.profiles p;

GRANT SELECT ON public.profiles_public TO anon, authenticated;

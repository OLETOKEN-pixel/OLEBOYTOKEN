-- Backfill discord_avatar_url for users whose Discord avatar was stored in avatar_url
-- (accounts created before discord_avatar_url was tracked separately).
-- profiles_public.avatar_url now aliases discord_avatar_url, so without this fix
-- those users show gray circles in match cards and leaderboard.

UPDATE public.profiles
SET discord_avatar_url = avatar_url
WHERE discord_avatar_url IS NULL
  AND avatar_url IS NOT NULL
  AND (
    avatar_url ILIKE 'https://cdn.discordapp.com/%'
    OR avatar_url ILIKE 'https://media.discordapp.net/%'
  );

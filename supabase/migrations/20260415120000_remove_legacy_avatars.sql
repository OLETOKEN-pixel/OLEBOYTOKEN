-- Remove legacy avatar shop/default profile art.
-- Discord remains the only accepted profile image source.

DROP TRIGGER IF EXISTS trg_assign_default_avatar ON public.profiles;

DROP FUNCTION IF EXISTS public.assign_default_avatar();
DROP FUNCTION IF EXISTS public.purchase_avatar(uuid);
DROP FUNCTION IF EXISTS public.equip_avatar(uuid);
DROP FUNCTION IF EXISTS public.get_avatar_shop();
DROP FUNCTION IF EXISTS public.get_user_avatars();

UPDATE public.profiles
SET
  avatar_url = CASE
    WHEN avatar_url ILIKE '/avatars/%'
      OR avatar_url ILIKE '%/src/assets/avatars/%'
      OR (
        avatar_url ILIKE '%/avatars/%'
        AND avatar_url NOT ILIKE 'https://cdn.discordapp.com/%'
        AND avatar_url NOT ILIKE 'https://media.discordapp.net/%'
      )
    THEN NULL
    ELSE avatar_url
  END,
  discord_avatar_url = CASE
    WHEN discord_avatar_url ILIKE '/avatars/%'
      OR discord_avatar_url ILIKE '%/src/assets/avatars/%'
      OR (
        discord_avatar_url ILIKE '%/avatars/%'
        AND discord_avatar_url NOT ILIKE 'https://cdn.discordapp.com/%'
        AND discord_avatar_url NOT ILIKE 'https://media.discordapp.net/%'
      )
    THEN NULL
    ELSE discord_avatar_url
  END
WHERE
  avatar_url ILIKE '/avatars/%'
  OR avatar_url ILIKE '%/src/assets/avatars/%'
  OR (
    avatar_url ILIKE '%/avatars/%'
    AND avatar_url NOT ILIKE 'https://cdn.discordapp.com/%'
    AND avatar_url NOT ILIKE 'https://media.discordapp.net/%'
  )
  OR discord_avatar_url ILIKE '/avatars/%'
  OR discord_avatar_url ILIKE '%/src/assets/avatars/%'
  OR (
    discord_avatar_url ILIKE '%/avatars/%'
    AND discord_avatar_url NOT ILIKE 'https://cdn.discordapp.com/%'
    AND discord_avatar_url NOT ILIKE 'https://media.discordapp.net/%'
  );

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_avatar_id_fkey;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS avatar_id;

DROP TABLE IF EXISTS public.user_avatars;
DROP TABLE IF EXISTS public.avatars;

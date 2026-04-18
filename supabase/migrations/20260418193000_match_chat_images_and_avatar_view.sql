-- Match chat images and Discord avatar hydration.

ALTER TABLE public.match_chat_messages
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_type text;

ALTER TABLE public.match_chat_messages
  ALTER COLUMN message SET DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'match_chat_messages_attachment_type_check'
  ) THEN
    ALTER TABLE public.match_chat_messages
      ADD CONSTRAINT match_chat_messages_attachment_type_check
      CHECK (attachment_type IS NULL OR attachment_type = 'image');
  END IF;
END $$;

UPDATE public.profiles
SET discord_avatar_url = avatar_url
WHERE discord_avatar_url IS NULL
  AND avatar_url IS NOT NULL
  AND (
    avatar_url ILIKE 'https://cdn.discordapp.com/%'
    OR avatar_url ILIKE 'https://media.discordapp.net/%'
  );

CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker=on) AS
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

DROP VIEW IF EXISTS public.match_chat_messages_view;

CREATE VIEW public.match_chat_messages_view
WITH (security_invoker = true)
AS
SELECT
  m.id,
  m.match_id,
  m.user_id,
  m.message,
  m.is_system,
  m.created_at,
  m.attachment_path,
  m.attachment_type,
  CASE
    WHEN public.has_role(m.user_id, 'admin'::public.app_role) THEN 'ADMIN'
    ELSE COALESCE(p.username, 'Unknown')
  END AS display_name,
  p.avatar_url,
  p.discord_avatar_url
FROM public.match_chat_messages m
LEFT JOIN public.profiles_public p
  ON p.user_id = m.user_id;

GRANT SELECT ON public.match_chat_messages_view TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'match-chat-images',
  'match-chat-images',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Match chat images visible to participants" ON storage.objects;
DROP POLICY IF EXISTS "Match chat images uploadable by participants" ON storage.objects;

CREATE POLICY "Match chat images visible to participants"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'match-chat-images'
  AND (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.match_participants mp
      WHERE mp.match_id = (storage.foldername(name))[1]::uuid
        AND mp.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Match chat images uploadable by participants"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'match-chat-images'
  AND auth.uid()::text = (storage.foldername(name))[2]
  AND (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.match_participants mp
      JOIN public.matches m ON m.id = mp.match_id
      WHERE mp.match_id = (storage.foldername(name))[1]::uuid
        AND mp.user_id = auth.uid()
        AND m.status IN ('ready_check', 'in_progress', 'result_pending', 'disputed', 'full')
    )
  )
);

CREATE OR REPLACE FUNCTION public.get_match_details(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_is_allowed boolean;
  v_is_admin boolean;
  v_match jsonb;
  v_creator jsonb;
  v_participants jsonb;
  v_result jsonb;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  v_is_admin := public.is_admin();

  SELECT (v_is_admin OR public.is_match_participant(p_match_id, v_caller_id))
    INTO v_is_allowed;

  IF NOT COALESCE(v_is_allowed, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;

  SELECT to_jsonb(m.*) INTO v_match
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;

  SELECT to_jsonb(row)
  INTO v_creator
  FROM (
    SELECT
      p.user_id,
      p.username,
      CASE
        WHEN p.discord_avatar_url IS NOT NULL THEN p.discord_avatar_url
        WHEN p.avatar_url ILIKE 'https://cdn.discordapp.com/%'
          OR p.avatar_url ILIKE 'https://media.discordapp.net/%'
        THEN p.avatar_url
        ELSE NULL
      END AS avatar_url,
      CASE
        WHEN p.discord_avatar_url IS NOT NULL THEN p.discord_avatar_url
        WHEN p.avatar_url ILIKE 'https://cdn.discordapp.com/%'
          OR p.avatar_url ILIKE 'https://media.discordapp.net/%'
        THEN p.avatar_url
        ELSE NULL
      END AS discord_avatar_url,
      p.epic_username,
      p.discord_display_name
    FROM public.profiles p
    WHERE p.user_id = (v_match->>'creator_id')::uuid
  ) row;

  SELECT COALESCE(jsonb_agg(to_jsonb(row) ORDER BY (row.joined_at)), '[]'::jsonb)
  INTO v_participants
  FROM (
    SELECT
      mp.*,
      (
        SELECT to_jsonb(pp)
        FROM (
          SELECT
            p.user_id,
            p.username,
            CASE
              WHEN p.discord_avatar_url IS NOT NULL THEN p.discord_avatar_url
              WHEN p.avatar_url ILIKE 'https://cdn.discordapp.com/%'
                OR p.avatar_url ILIKE 'https://media.discordapp.net/%'
              THEN p.avatar_url
              ELSE NULL
            END AS avatar_url,
            CASE
              WHEN p.discord_avatar_url IS NOT NULL THEN p.discord_avatar_url
              WHEN p.avatar_url ILIKE 'https://cdn.discordapp.com/%'
                OR p.avatar_url ILIKE 'https://media.discordapp.net/%'
              THEN p.avatar_url
              ELSE NULL
            END AS discord_avatar_url,
            p.epic_username,
            p.discord_display_name
          FROM public.profiles p
          WHERE p.user_id = mp.user_id
        ) pp
      ) AS profile
    FROM public.match_participants mp
    WHERE mp.match_id = p_match_id
  ) row;

  SELECT to_jsonb(r.*)
  INTO v_result
  FROM public.match_results r
  WHERE r.match_id = p_match_id
  LIMIT 1;

  RETURN jsonb_build_object(
    'success', true,
    'match', v_match || jsonb_build_object(
      'creator', v_creator,
      'participants', v_participants,
      'result', v_result
    )
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_match_details(uuid) TO authenticated;

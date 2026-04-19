-- Allow high quality screenshots in match chat.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'match-chat-images',
  'match-chat-images',
  false,
  52428800,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
    'image/heic',
    'image/heif'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Participants and admins can send match chat" ON public.match_chat_messages;

CREATE POLICY "Participants and admins can send match chat"
ON public.match_chat_messages
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    EXISTS (
      SELECT 1
      FROM public.match_participants
      WHERE match_id = match_chat_messages.match_id
        AND user_id = auth.uid()
    )
    OR public.is_admin()
  )
  AND EXISTS (
    SELECT 1
    FROM public.matches
    WHERE id = match_chat_messages.match_id
      AND status IN ('open', 'joined', 'ready_check', 'in_progress', 'result_pending', 'disputed', 'full', 'started')
  )
);

DROP POLICY IF EXISTS "Match chat images uploadable by participants" ON storage.objects;
DROP POLICY IF EXISTS "Match chat images removable by uploaders" ON storage.objects;

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
        AND m.status IN ('open', 'joined', 'ready_check', 'in_progress', 'result_pending', 'disputed', 'full', 'started')
    )
  )
);

CREATE POLICY "Match chat images removable by uploaders"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'match-chat-images'
  AND (
    public.is_admin()
    OR auth.uid()::text = (storage.foldername(name))[2]
  )
);

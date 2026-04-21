-- Metadata for the Figma HLS page and curated highlight rows.
ALTER TABLE public.highlights
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS is_curated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS base_vote_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS author_name text,
  ADD COLUMN IF NOT EXISTS author_avatar_url text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS sort_order integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'highlights_user_required_for_uploads'
      AND conrelid = 'public.highlights'::regclass
  ) THEN
    ALTER TABLE public.highlights
      ADD CONSTRAINT highlights_user_required_for_uploads
      CHECK (is_curated OR user_id IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'highlights_base_vote_count_nonnegative'
      AND conrelid = 'public.highlights'::regclass
  ) THEN
    ALTER TABLE public.highlights
      ADD CONSTRAINT highlights_base_vote_count_nonnegative
      CHECK (base_vote_count >= 0);
  END IF;
END $$;

INSERT INTO public.highlights (
  id,
  user_id,
  youtube_url,
  youtube_video_id,
  title,
  is_curated,
  base_vote_count,
  author_name,
  author_avatar_url,
  thumbnail_url,
  sort_order,
  created_at,
  updated_at
) VALUES
  (
    '00000000-0000-4000-8000-000000000102',
    NULL,
    'https://youtu.be/HxRTrHyWB0Y?si=VdsoQIswI9eOlHG5',
    'HxRTrHyWB0Y',
    'IL MIGLIOR HIGHLIGHTS...',
    true,
    655,
    'Piz',
    NULL,
    '/showreel/highlight-video-1.png',
    20,
    '2026-04-21 12:00:02+00',
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000103',
    NULL,
    'https://youtu.be/CtK-fV6TsBY?si=6zOsv5SjhmzvPEHJ',
    'CtK-fV6TsBY',
    'Never Change | Clix',
    true,
    1200,
    'Clix',
    NULL,
    'https://i.ytimg.com/vi/CtK-fV6TsBY/hqdefault.jpg',
    30,
    '2026-04-21 12:00:03+00',
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000104',
    NULL,
    'https://youtu.be/K5MZeXFPsGc?si=axxBNUHOC5f-Ty1f',
    'K5MZeXFPsGc',
    '1st FNCS GRAND FINALS...',
    true,
    5300,
    'Peterbot',
    NULL,
    'https://i.ytimg.com/vi/K5MZeXFPsGc/hqdefault.jpg',
    40,
    '2026-04-21 12:00:04+00',
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000105',
    NULL,
    'https://youtu.be/4xv3O_VrW0M?si=KE0tHu7KU0qFt0ov',
    '4xv3O_VrW0M',
    'Pricey | Eomzo Highlig...',
    true,
    973,
    'Eomzo',
    NULL,
    'https://i.ytimg.com/vi/4xv3O_VrW0M/hqdefault.jpg',
    50,
    '2026-04-21 12:00:05+00',
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000106',
    NULL,
    'https://youtu.be/CtK-fV6TsBY?si=6zOsv5SjhmzvPEHJ',
    'CtK-fV6TsBY',
    'Malibuca | Highlights #2',
    true,
    802,
    'Malibuca',
    NULL,
    'https://i.ytimg.com/vi/CtK-fV6TsBY/hqdefault.jpg',
    60,
    '2026-04-21 12:00:06+00',
    now()
  )
ON CONFLICT (id) DO UPDATE SET
  youtube_url = EXCLUDED.youtube_url,
  youtube_video_id = EXCLUDED.youtube_video_id,
  title = EXCLUDED.title,
  is_curated = EXCLUDED.is_curated,
  base_vote_count = EXCLUDED.base_vote_count,
  author_name = EXCLUDED.author_name,
  author_avatar_url = EXCLUDED.author_avatar_url,
  thumbnail_url = EXCLUDED.thumbnail_url,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

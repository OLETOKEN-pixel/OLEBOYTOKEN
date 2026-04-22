-- =============================================
-- Add missing highlights columns + seed 6 curated videos
-- Fixes FK error on vote_highlight RPC (highlight_votes_highlight_id_fkey)
-- =============================================

-- 1. Make user_id nullable (curated videos have no owner)
ALTER TABLE public.highlights ALTER COLUMN user_id DROP NOT NULL;

-- 2. Add missing columns used by frontend
ALTER TABLE public.highlights
  ADD COLUMN IF NOT EXISTS is_curated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS base_vote_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS author_name text,
  ADD COLUMN IF NOT EXISTS author_avatar_url text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS sort_order integer;

-- 3. Seed 6 curated highlights matching CURATED_HIGHLIGHTS in src/pages/Highlights.tsx
-- NULL user_id (no owner). author_name + is_curated=true are enough for the normalizer
-- to look up avatar/thumbnail assets via getCuratedAvatarUrl/getCuratedThumbnailUrl.
INSERT INTO public.highlights (
  id, user_id, youtube_url, youtube_video_id, title,
  is_curated, base_vote_count, author_name, sort_order
) VALUES
  ('00000000-0000-4000-8000-000000000101', NULL,
   'https://youtu.be/JWlBCQIQags?si=-6gGHkedcxMRwoF-', 'JWlBCQIQags',
   'Godzilla', true, 273, 'Dodoeu', 10),
  ('00000000-0000-4000-8000-000000000102', NULL,
   'https://youtu.be/HxRTrHyWB0Y?si=VdsoQIswI9eOlHG5', 'HxRTrHyWB0Y',
   'IL MIGLIOR HIGHLIGHTS...', true, 655, 'Piz', 20),
  ('00000000-0000-4000-8000-000000000103', NULL,
   'https://youtu.be/CtK-fV6TsBY?si=6zOsv5SjhmzvPEHJ', 'CtK-fV6TsBY',
   'Never Change | Clix', true, 1200, 'Clix', 30),
  ('00000000-0000-4000-8000-000000000104', NULL,
   'https://youtu.be/K5MZeXFPsGc?si=axxBNUHOC5f-Ty1f', 'K5MZeXFPsGc',
   '1st FNCS GRAND FINALS...', true, 5300, 'Peterbot', 40),
  ('00000000-0000-4000-8000-000000000105', NULL,
   'https://youtu.be/4xv3O_VrW0M?si=KE0tHu7KU0qFt0ov', '4xv3O_VrW0M',
   'Pricey | Eomzo Highlig...', true, 973, 'Eomzo', 50),
  ('00000000-0000-4000-8000-000000000106', NULL,
   'https://youtu.be/CtK-fV6TsBY?si=6zOsv5SjhmzvPEHJ', 'CtK-fV6TsBY',
   'Malibuca | Highlights #2', true, 802, 'Malibuca', 60)
ON CONFLICT (id) DO UPDATE SET
  is_curated = EXCLUDED.is_curated,
  base_vote_count = EXCLUDED.base_vote_count,
  author_name = EXCLUDED.author_name,
  sort_order = EXCLUDED.sort_order,
  title = EXCLUDED.title;

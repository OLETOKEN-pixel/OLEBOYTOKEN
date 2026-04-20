-- Fix leaderboard: add discord_avatar_url to view and get_leaderboard() RPC
-- The DB view was missing this column, causing grey circles in the leaderboard UI.

-- 1. Recreate leaderboard view with discord_avatar_url added
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
  p.id,
  p.user_id,
  p.username,
  p.avatar_url,
  p.discord_avatar_url,
  COALESCE(w.wins, 0) AS wins,
  COALESCE(tm.total_matches, 0) AS total_matches,
  COALESCE(te.total_earnings, 0) AS total_earnings
FROM public.profiles p
LEFT JOIN (
  SELECT mr.winner_user_id AS user_id, COUNT(*) AS wins
  FROM public.match_results mr
  WHERE mr.status = 'confirmed' AND mr.winner_user_id IS NOT NULL
  GROUP BY mr.winner_user_id
) w ON w.user_id = p.user_id
LEFT JOIN (
  SELECT mp.user_id, COUNT(DISTINCT mp.match_id) AS total_matches
  FROM public.match_participants mp
  JOIN public.matches m ON m.id = mp.match_id AND m.status = 'finished'
  GROUP BY mp.user_id
) tm ON tm.user_id = p.user_id
LEFT JOIN (
  SELECT mr.winner_user_id AS user_id, SUM(m.entry_fee * 1.9) AS total_earnings
  FROM public.match_results mr
  JOIN public.matches m ON m.id = mr.match_id
  WHERE mr.status = 'confirmed' AND mr.winner_user_id IS NOT NULL
  GROUP BY mr.winner_user_id
) te ON te.user_id = p.user_id
WHERE p.is_banned = false
ORDER BY COALESCE(te.total_earnings, 0) DESC, COALESCE(w.wins, 0) DESC;

GRANT SELECT ON public.leaderboard TO anon, authenticated;

-- 2. Recreate get_leaderboard() to include discord_avatar_url in return type
DROP FUNCTION IF EXISTS public.get_leaderboard(integer, integer);

CREATE FUNCTION public.get_leaderboard(
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id                 uuid,
  user_id            uuid,
  username           text,
  avatar_url         text,
  discord_avatar_url text,
  total_matches      bigint,
  wins               bigint,
  total_earnings     numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    lb.id,
    lb.user_id,
    lb.username,
    lb.avatar_url,
    lb.discord_avatar_url,
    lb.total_matches,
    lb.wins,
    lb.total_earnings
  FROM public.leaderboard lb
  ORDER BY lb.total_earnings DESC, lb.wins DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard(integer, integer) TO anon, authenticated;

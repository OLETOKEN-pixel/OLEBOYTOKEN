-- Fix leaderboard: add wins/total_matches to weekly view+RPC, fix security_invoker chain, add grants

-- 1. Recreate leaderboard_weekly view
--    - Query profiles directly (avoid profiles_public security_invoker chain)
--    - Add wins + total_matches so win rate can be displayed
--    - Use CTE JOIN so only earners appear (replaces HAVING)
DROP VIEW IF EXISTS public.leaderboard_weekly;
CREATE VIEW public.leaderboard_weekly AS
WITH weekly_earners AS (
  SELECT t.user_id, SUM(t.amount) AS weekly_earned
  FROM public.transactions t
  WHERE t.type = 'payout' AND t.amount > 0
    AND t.created_at >= date_trunc('week', now())
  GROUP BY t.user_id
),
all_time_wins AS (
  SELECT mr.winner_user_id AS user_id, COUNT(*) AS wins
  FROM public.match_results mr
  WHERE mr.status = 'confirmed' AND mr.winner_user_id IS NOT NULL
  GROUP BY mr.winner_user_id
),
all_time_matches AS (
  SELECT mp.user_id, COUNT(DISTINCT mp.match_id) AS total_matches
  FROM public.match_participants mp
  JOIN public.matches m ON m.id = mp.match_id AND m.status = 'finished'
  GROUP BY mp.user_id
)
SELECT
  p.user_id,
  p.username,
  p.discord_avatar_url AS avatar_url,
  p.discord_avatar_url,
  we.weekly_earned,
  COALESCE(w.wins, 0)           AS wins,
  COALESCE(tm.total_matches, 0) AS total_matches
FROM public.profiles p
JOIN  weekly_earners   we ON we.user_id = p.user_id
LEFT JOIN all_time_wins    w  ON w.user_id  = p.user_id
LEFT JOIN all_time_matches tm ON tm.user_id = p.user_id
WHERE p.is_banned = false
ORDER BY we.weekly_earned DESC
LIMIT 10;

GRANT SELECT ON public.leaderboard_weekly TO anon, authenticated;

-- 2. Recreate get_leaderboard_weekly RPC with wins + total_matches in return type
DROP FUNCTION IF EXISTS public.get_leaderboard_weekly(integer);

CREATE FUNCTION public.get_leaderboard_weekly(p_limit integer DEFAULT 10)
RETURNS TABLE (
  user_id            uuid,
  username           text,
  avatar_url         text,
  discord_avatar_url text,
  weekly_earned      numeric,
  wins               bigint,
  total_matches      bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.username,
    p.discord_avatar_url AS avatar_url,
    p.discord_avatar_url,
    COALESCE(SUM(CASE WHEN t.type = 'payout' AND t.amount > 0 THEN t.amount ELSE 0 END), 0) AS weekly_earned,
    COALESCE((
      SELECT COUNT(*)
      FROM public.match_results mr
      WHERE mr.winner_user_id = p.user_id AND mr.status = 'confirmed'
    ), 0) AS wins,
    COALESCE((
      SELECT COUNT(DISTINCT mp.match_id)
      FROM public.match_participants mp
      JOIN public.matches m ON m.id = mp.match_id AND m.status = 'finished'
      WHERE mp.user_id = p.user_id
    ), 0) AS total_matches
  FROM public.profiles p
  LEFT JOIN public.transactions t
    ON t.user_id = p.user_id
   AND t.created_at >= date_trunc('week', now())
   AND t.type = 'payout'
  WHERE p.is_banned = false
  GROUP BY p.user_id, p.username, p.discord_avatar_url
  HAVING COALESCE(SUM(CASE WHEN t.type = 'payout' AND t.amount > 0 THEN t.amount ELSE 0 END), 0) > 0
  ORDER BY weekly_earned DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard_weekly(integer) TO anon, authenticated;

-- 3. Ensure leaderboard all-time view has SELECT grants
GRANT SELECT ON public.leaderboard TO anon, authenticated;

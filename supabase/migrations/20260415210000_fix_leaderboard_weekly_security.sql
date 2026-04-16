-- Fix: leaderboard_weekly was using security_invoker=on, which applied per-user RLS
-- on the transactions table, causing each user to only see their own data.
-- Removing security_invoker=on (default=off) makes the view run with the view
-- owner's privileges, bypassing per-user RLS so it returns the true global ranking.

CREATE OR REPLACE VIEW public.leaderboard_weekly AS
  SELECT
    p.user_id,
    p.username,
    p.discord_avatar_url AS avatar_url,
    p.discord_avatar_url,
    COALESCE(
      sum(CASE WHEN t.type = 'payout' AND t.amount > 0 THEN t.amount ELSE 0 END),
      0
    ) AS weekly_earned
  FROM public.profiles_public p
  LEFT JOIN public.transactions t
    ON t.user_id = p.user_id
   AND t.created_at >= date_trunc('week', now())
   AND t.type = 'payout'
  GROUP BY p.user_id, p.username, p.discord_avatar_url
  HAVING COALESCE(
      sum(CASE WHEN t.type = 'payout' AND t.amount > 0 THEN t.amount ELSE 0 END),
      0
    ) > 0
  ORDER BY weekly_earned DESC
  LIMIT 10;

GRANT SELECT ON public.leaderboard_weekly TO anon, authenticated;

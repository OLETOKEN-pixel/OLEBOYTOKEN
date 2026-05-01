-- Public leaderboard RPCs for the standalone leaderboard page.
-- These return ranked, searchable datasets backed by real finalized match data.

DROP FUNCTION IF EXISTS public.get_player_leaderboard_metric(text, integer, integer, text);
DROP FUNCTION IF EXISTS public.get_team_leaderboard_earnings(integer, integer, text);

CREATE FUNCTION public.get_player_leaderboard_metric(
  p_metric text,
  p_limit integer DEFAULT 10,
  p_offset integer DEFAULT 0,
  p_query text DEFAULT NULL
)
RETURNS TABLE (
  rank integer,
  user_id uuid,
  username text,
  avatar_url text,
  discord_avatar_url text,
  wins integer,
  total_matches integer,
  total_earnings numeric,
  total_profit numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metric text := lower(trim(coalesce(p_metric, '')));
  v_limit integer := greatest(1, least(coalesce(p_limit, 10), 100));
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_query text := nullif(trim(coalesce(p_query, '')), '');
BEGIN
  IF v_metric NOT IN ('earnings', 'profit', 'wins') THEN
    v_metric := 'earnings';
  END IF;

  RETURN QUERY
  WITH eligible_profiles AS (
    SELECT
      p.user_id,
      coalesce(
        nullif(trim(coalesce(p.username, '')), ''),
        nullif(trim(coalesce(p.discord_display_name, '')), ''),
        'Player'
      ) AS username,
      trim(concat_ws(' ', coalesce(p.username, ''), coalesce(p.discord_display_name, ''))) AS search_text,
      p.avatar_url,
      p.discord_avatar_url
    FROM public.profiles p
    WHERE coalesce(p.is_banned, false) = false
  ),
  finalized_match_participants AS (
    SELECT DISTINCT
      mp.user_id,
      mp.match_id,
      mp.team_id,
      mp.team_side
    FROM public.match_participants mp
    JOIN public.matches m ON m.id = mp.match_id
    LEFT JOIN public.match_results mr ON mr.match_id = mp.match_id
    WHERE (
      m.status IN ('finished', 'completed', 'admin_resolved')
      OR mr.status IN ('confirmed', 'resolved')
    )
  ),
  match_stats AS (
    SELECT
      fmp.user_id,
      count(DISTINCT fmp.match_id)::integer AS total_matches,
      count(
        DISTINCT CASE
          WHEN mr.status IN ('confirmed', 'resolved')
            AND (
              mr.winner_user_id = fmp.user_id
              OR (mr.winner_team_id IS NOT NULL AND fmp.team_id = mr.winner_team_id)
              OR (mr.winner_team_id IS NOT NULL AND fmp.team_side = 'A' AND m.team_a_id = mr.winner_team_id)
              OR (mr.winner_team_id IS NOT NULL AND fmp.team_side = 'B' AND m.team_b_id = mr.winner_team_id)
            )
          THEN fmp.match_id
          ELSE NULL
        END
      )::integer AS wins
    FROM finalized_match_participants fmp
    JOIN public.matches m ON m.id = fmp.match_id
    LEFT JOIN public.match_results mr ON mr.match_id = fmp.match_id
    GROUP BY fmp.user_id
  ),
  match_token_rows AS (
    SELECT
      t.user_id,
      t.match_id,
      coalesce(sum(CASE WHEN t.type = 'payout' AND t.amount > 0 THEN t.amount ELSE 0 END), 0) AS payout_amount,
      coalesce(sum(CASE WHEN t.type = 'lock' THEN abs(t.amount) ELSE 0 END), 0) AS lock_amount,
      coalesce(sum(CASE WHEN t.type = 'fee' THEN abs(t.amount) ELSE 0 END), 0) AS fee_amount,
      coalesce(sum(CASE WHEN t.type = 'refund' THEN abs(t.amount) ELSE 0 END), 0) AS refund_amount
    FROM public.transactions t
    JOIN finalized_match_participants fmp
      ON fmp.user_id = t.user_id
     AND fmp.match_id = t.match_id
    WHERE t.match_id IS NOT NULL
      AND coalesce(t.status, 'completed') = 'completed'
      AND t.type IN ('payout', 'lock', 'fee', 'refund')
    GROUP BY t.user_id, t.match_id
  ),
  token_stats AS (
    SELECT
      mtr.user_id,
      coalesce(sum(mtr.payout_amount), 0) AS total_earnings,
      coalesce(
        sum(
          mtr.payout_amount - CASE
            WHEN mtr.lock_amount > 0 THEN greatest(mtr.lock_amount - mtr.refund_amount, 0)
            ELSE greatest(mtr.fee_amount - mtr.refund_amount, 0)
          END
        ),
        0
      ) AS total_profit
    FROM match_token_rows mtr
    GROUP BY mtr.user_id
  ),
  leaderboard_base AS (
    SELECT
      ep.user_id,
      ep.username,
      ep.search_text,
      ep.avatar_url,
      ep.discord_avatar_url,
      coalesce(ms.wins, 0)::integer AS wins,
      coalesce(ms.total_matches, 0)::integer AS total_matches,
      coalesce(ts.total_earnings, 0)::numeric AS total_earnings,
      coalesce(ts.total_profit, 0)::numeric AS total_profit
    FROM eligible_profiles ep
    LEFT JOIN match_stats ms ON ms.user_id = ep.user_id
    LEFT JOIN token_stats ts ON ts.user_id = ep.user_id
  ),
  ranked_rows AS (
    SELECT
      row_number() OVER (
        ORDER BY
          CASE WHEN v_metric = 'earnings' THEN lb.total_earnings ELSE NULL END DESC NULLS LAST,
          CASE WHEN v_metric = 'profit' THEN lb.total_profit ELSE NULL END DESC NULLS LAST,
          CASE WHEN v_metric = 'wins' THEN lb.wins::numeric ELSE NULL END DESC NULLS LAST,
          CASE WHEN v_metric = 'earnings' THEN lb.wins::numeric ELSE NULL END DESC NULLS LAST,
          CASE WHEN v_metric = 'profit' THEN lb.total_earnings ELSE NULL END DESC NULLS LAST,
          CASE WHEN v_metric = 'wins' THEN lb.total_earnings ELSE NULL END DESC NULLS LAST,
          lb.username ASC,
          lb.user_id ASC
      )::integer AS rank,
      lb.user_id,
      lb.username,
      lb.avatar_url,
      lb.discord_avatar_url,
      lb.wins,
      lb.total_matches,
      lb.total_earnings,
      lb.total_profit,
      lb.search_text
    FROM leaderboard_base lb
  )
  SELECT
    rr.rank,
    rr.user_id,
    rr.username,
    rr.avatar_url,
    rr.discord_avatar_url,
    rr.wins,
    rr.total_matches,
    rr.total_earnings,
    rr.total_profit
  FROM ranked_rows rr
  WHERE v_query IS NULL
     OR rr.search_text ILIKE '%' || v_query || '%'
  ORDER BY rr.rank ASC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

CREATE FUNCTION public.get_team_leaderboard_earnings(
  p_limit integer DEFAULT 10,
  p_offset integer DEFAULT 0,
  p_query text DEFAULT NULL
)
RETURNS TABLE (
  rank integer,
  team_id uuid,
  team_name text,
  team_tag text,
  logo_url text,
  owner_user_id uuid,
  owner_username text,
  owner_avatar_url text,
  owner_discord_avatar_url text,
  wins integer,
  total_matches integer,
  total_earnings numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := greatest(1, least(coalesce(p_limit, 10), 100));
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_query text := nullif(trim(coalesce(p_query, '')), '');
BEGIN
  RETURN QUERY
  WITH team_match_stats AS (
    SELECT
      team_match_rows.team_id,
      count(*)::integer AS total_matches,
      count(*) FILTER (WHERE team_match_rows.won)::integer AS wins
    FROM (
      SELECT
        m.team_a_id AS team_id,
        (mr.winner_team_id = m.team_a_id) AS won
      FROM public.matches m
      JOIN public.match_results mr ON mr.match_id = m.id
      WHERE m.team_a_id IS NOT NULL
        AND mr.status IN ('confirmed', 'resolved')
        AND m.status IN ('completed', 'finished', 'admin_resolved')

      UNION ALL

      SELECT
        m.team_b_id AS team_id,
        (mr.winner_team_id = m.team_b_id) AS won
      FROM public.matches m
      JOIN public.match_results mr ON mr.match_id = m.id
      WHERE m.team_b_id IS NOT NULL
        AND mr.status IN ('confirmed', 'resolved')
        AND m.status IN ('completed', 'finished', 'admin_resolved')
    ) AS team_match_rows
    WHERE team_match_rows.team_id IS NOT NULL
    GROUP BY team_match_rows.team_id
  ),
  team_payout_rows AS (
    SELECT
      mr.winner_team_id AS team_id,
      t.amount
    FROM public.match_results mr
    JOIN public.matches m ON m.id = mr.match_id
    JOIN (
      SELECT DISTINCT match_id, user_id, team_id, team_side
      FROM public.match_participants
    ) mp
      ON mp.match_id = m.id
    JOIN public.transactions t
      ON t.match_id = m.id
     AND t.user_id = mp.user_id
    WHERE mr.winner_team_id IS NOT NULL
      AND mr.status IN ('confirmed', 'resolved')
      AND m.status IN ('completed', 'finished', 'admin_resolved')
      AND t.type = 'payout'
      AND coalesce(t.status, 'completed') = 'completed'
      AND (
        mp.team_id = mr.winner_team_id
        OR (mp.team_id IS NULL AND mp.team_side = 'A' AND m.team_a_id = mr.winner_team_id)
        OR (mp.team_id IS NULL AND mp.team_side = 'B' AND m.team_b_id = mr.winner_team_id)
      )
  ),
  team_earnings AS (
    SELECT
      tpr.team_id,
      coalesce(sum(tpr.amount), 0)::numeric AS total_earnings
    FROM team_payout_rows tpr
    GROUP BY tpr.team_id
  ),
  leaderboard_base AS (
    SELECT
      t.id AS team_id,
      t.name AS team_name,
      t.tag AS team_tag,
      t.logo_url,
      t.owner_id AS owner_user_id,
      coalesce(
        nullif(trim(coalesce(p.username, '')), ''),
        nullif(trim(coalesce(p.discord_display_name, '')), ''),
        t.name
      ) AS owner_username,
      p.avatar_url AS owner_avatar_url,
      p.discord_avatar_url AS owner_discord_avatar_url,
      coalesce(tms.wins, 0)::integer AS wins,
      coalesce(tms.total_matches, 0)::integer AS total_matches,
      coalesce(te.total_earnings, 0)::numeric AS total_earnings
    FROM public.teams t
    LEFT JOIN public.profiles p ON p.user_id = t.owner_id
    LEFT JOIN team_match_stats tms ON tms.team_id = t.id
    LEFT JOIN team_earnings te ON te.team_id = t.id
  ),
  ranked_rows AS (
    SELECT
      row_number() OVER (
        ORDER BY
          lb.total_earnings DESC,
          lb.wins DESC,
          lb.total_matches DESC,
          lb.team_name ASC,
          lb.team_id ASC
      )::integer AS rank,
      lb.team_id,
      lb.team_name,
      lb.team_tag,
      lb.logo_url,
      lb.owner_user_id,
      lb.owner_username,
      lb.owner_avatar_url,
      lb.owner_discord_avatar_url,
      lb.wins,
      lb.total_matches,
      lb.total_earnings
    FROM leaderboard_base lb
  )
  SELECT
    rr.rank,
    rr.team_id,
    rr.team_name,
    rr.team_tag,
    rr.logo_url,
    rr.owner_user_id,
    rr.owner_username,
    rr.owner_avatar_url,
    rr.owner_discord_avatar_url,
    rr.wins,
    rr.total_matches,
    rr.total_earnings
  FROM ranked_rows rr
  WHERE v_query IS NULL
     OR rr.team_name ILIKE '%' || v_query || '%'
     OR rr.team_tag ILIKE '%' || v_query || '%'
  ORDER BY rr.rank ASC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.get_player_leaderboard_metric(text, integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_player_leaderboard_metric(text, integer, integer, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_team_leaderboard_earnings(integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_team_leaderboard_earnings(integer, integer, text) TO anon, authenticated;

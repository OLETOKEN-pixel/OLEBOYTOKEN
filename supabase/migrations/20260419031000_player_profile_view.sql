-- Public player profile payload used by the Figma profile tab in match lobbies.

DROP FUNCTION IF EXISTS public.get_player_profile_view(uuid);

CREATE FUNCTION public.get_player_profile_view(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_team_id uuid;
  v_team_name text;
  v_team_tag text;
  v_total_xp int := 0;
  v_level int := 0;
  v_rank int;
  v_total_matches int := 0;
  v_wins int := 0;
  v_losses int := 0;
  v_win_rate numeric := 0;
  v_total_earned numeric := 0;
  v_total_profit numeric := 0;
  v_avg_profit numeric := 0;
  v_avg_earnings numeric := 0;
  v_best_profit numeric := 0;
  v_history jsonb := '[]'::jsonb;
  v_best_streak int := 0;
  v_current_streak int := 0;
  v_run int := 0;
  v_row record;
BEGIN
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = p_user_id
    AND COALESCE(is_banned, false) = false;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  SELECT COALESCE(ux.total_xp, 0) INTO v_total_xp
  FROM public.user_xp ux
  WHERE ux.user_id = p_user_id;

  v_total_xp := COALESCE(v_total_xp, 0);
  v_level := public.xp_to_level(v_total_xp);

  BEGIN
    SELECT public.get_player_rank(p_user_id) INTO v_rank;
  EXCEPTION WHEN OTHERS THEN
    v_rank := NULL;
  END;

  SELECT t.id, t.name, t.tag
  INTO v_team_id, v_team_name, v_team_tag
  FROM public.team_members tm
  JOIN public.teams t ON t.id = tm.team_id
  WHERE tm.user_id = p_user_id
    AND tm.status = 'accepted'
  ORDER BY
    CASE
      WHEN t.owner_id = p_user_id THEN 0
      WHEN tm.role = 'captain' THEN 1
      ELSE 2
    END,
    tm.created_at DESC
  LIMIT 1;

  SELECT COUNT(DISTINCT mp.match_id) INTO v_total_matches
  FROM public.match_participants mp
  JOIN public.matches m ON m.id = mp.match_id
  LEFT JOIN public.match_results mr ON mr.match_id = mp.match_id
  WHERE mp.user_id = p_user_id
    AND (
      m.status IN ('finished', 'completed', 'admin_resolved')
      OR mr.status IN ('confirmed', 'resolved')
    );

  SELECT COUNT(DISTINCT mp.match_id) INTO v_wins
  FROM public.match_participants mp
  JOIN public.matches m ON m.id = mp.match_id
  JOIN public.match_results mr ON mr.match_id = mp.match_id
  WHERE mp.user_id = p_user_id
    AND mr.status IN ('confirmed', 'resolved')
    AND (
      mr.winner_user_id = p_user_id
      OR (mr.winner_team_id IS NOT NULL AND mp.team_id = mr.winner_team_id)
      OR (mr.winner_team_id IS NOT NULL AND mp.team_side = 'A' AND m.team_a_id = mr.winner_team_id)
      OR (mr.winner_team_id IS NOT NULL AND mp.team_side = 'B' AND m.team_b_id = mr.winner_team_id)
    );

  v_losses := GREATEST(0, COALESCE(v_total_matches, 0) - COALESCE(v_wins, 0));
  v_win_rate := CASE
    WHEN COALESCE(v_total_matches, 0) > 0
      THEN ROUND((v_wins::numeric / v_total_matches::numeric) * 100, 2)
    ELSE 0
  END;

  SELECT
    COALESCE(SUM(CASE WHEN t.type = 'payout' AND t.amount > 0 THEN t.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE
      WHEN t.type = 'payout' AND t.amount > 0 THEN t.amount
      WHEN t.type IN ('lock', 'fee') AND t.match_id IS NOT NULL THEN -ABS(t.amount)
      ELSE 0
    END), 0),
    COALESCE(MAX(CASE WHEN t.type = 'payout' AND t.amount > 0 THEN t.amount ELSE NULL END), 0)
  INTO v_total_earned, v_total_profit, v_best_profit
  FROM public.transactions t
  WHERE t.user_id = p_user_id
    AND COALESCE(t.status, 'completed') = 'completed';

  v_avg_profit := CASE
    WHEN COALESCE(v_total_matches, 0) > 0 THEN ROUND(v_total_profit / v_total_matches, 2)
    ELSE 0
  END;
  v_avg_earnings := CASE
    WHEN COALESCE(v_total_matches, 0) > 0 THEN ROUND(v_total_earned / v_total_matches, 2)
    ELSE 0
  END;

  WITH recent_matches AS (
    SELECT
      mp.match_id,
      COALESCE(m.finished_at, m.started_at, m.created_at) AS sort_at,
      CASE
        WHEN m.status = 'disputed' OR mr.status = 'disputed' THEN 'pending'
        WHEN mr.status IN ('confirmed', 'resolved') AND (
          mr.winner_user_id = p_user_id
          OR (mr.winner_team_id IS NOT NULL AND mp.team_id = mr.winner_team_id)
          OR (mr.winner_team_id IS NOT NULL AND mp.team_side = 'A' AND m.team_a_id = mr.winner_team_id)
          OR (mr.winner_team_id IS NOT NULL AND mp.team_side = 'B' AND m.team_b_id = mr.winner_team_id)
        ) THEN 'win'
        WHEN mr.status IN ('confirmed', 'resolved') THEN 'loss'
        ELSE 'pending'
      END AS status
    FROM public.match_participants mp
    JOIN public.matches m ON m.id = mp.match_id
    LEFT JOIN public.match_results mr ON mr.match_id = mp.match_id
    WHERE mp.user_id = p_user_id
    ORDER BY COALESCE(m.finished_at, m.started_at, m.created_at) DESC
    LIMIT 5
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'match_id', match_id,
        'status', status,
        'finished_at', sort_at
      )
      ORDER BY sort_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_history
  FROM recent_matches;

  FOR v_row IN
    SELECT
      CASE
        WHEN mr.winner_user_id = p_user_id THEN true
        WHEN mr.winner_team_id IS NOT NULL AND mp.team_id = mr.winner_team_id THEN true
        WHEN mr.winner_team_id IS NOT NULL AND mp.team_side = 'A' AND m.team_a_id = mr.winner_team_id THEN true
        WHEN mr.winner_team_id IS NOT NULL AND mp.team_side = 'B' AND m.team_b_id = mr.winner_team_id THEN true
        ELSE false
      END AS is_win
    FROM public.match_participants mp
    JOIN public.matches m ON m.id = mp.match_id
    JOIN public.match_results mr ON mr.match_id = mp.match_id
    WHERE mp.user_id = p_user_id
      AND mr.status IN ('confirmed', 'resolved')
    ORDER BY COALESCE(m.finished_at, m.started_at, m.created_at) ASC
  LOOP
    IF v_row.is_win THEN
      v_run := v_run + 1;
      v_best_streak := GREATEST(v_best_streak, v_run);
    ELSE
      v_run := 0;
    END IF;
  END LOOP;

  FOR v_row IN
    SELECT
      CASE
        WHEN mr.winner_user_id = p_user_id THEN true
        WHEN mr.winner_team_id IS NOT NULL AND mp.team_id = mr.winner_team_id THEN true
        WHEN mr.winner_team_id IS NOT NULL AND mp.team_side = 'A' AND m.team_a_id = mr.winner_team_id THEN true
        WHEN mr.winner_team_id IS NOT NULL AND mp.team_side = 'B' AND m.team_b_id = mr.winner_team_id THEN true
        ELSE false
      END AS is_win
    FROM public.match_participants mp
    JOIN public.matches m ON m.id = mp.match_id
    JOIN public.match_results mr ON mr.match_id = mp.match_id
    WHERE mp.user_id = p_user_id
      AND mr.status IN ('confirmed', 'resolved')
    ORDER BY COALESCE(m.finished_at, m.started_at, m.created_at) DESC
  LOOP
    IF v_row.is_win THEN
      v_current_streak := v_current_streak + 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'profile', jsonb_build_object(
      'user_id', v_profile.user_id,
      'username', v_profile.username,
      'display_name', COALESCE(v_profile.discord_display_name, v_profile.username),
      'avatar_url', v_profile.discord_avatar_url,
      'discord_avatar_url', v_profile.discord_avatar_url,
      'epic_username', v_profile.epic_username,
      'twitter_username', v_profile.twitter_username,
      'twitch_username', v_profile.twitch_username,
      'team_id', v_team_id,
      'team_name', v_team_name,
      'team_tag', v_team_tag,
      'total_xp', v_total_xp,
      'level', v_level,
      'rank', v_rank
    ),
    'stats', jsonb_build_object(
      'total_matches', COALESCE(v_total_matches, 0),
      'wins', COALESCE(v_wins, 0),
      'losses', COALESCE(v_losses, 0),
      'win_rate', COALESCE(v_win_rate, 0)
    ),
    'tokens', jsonb_build_object(
      'total_earned', COALESCE(v_total_earned, 0),
      'total_profit', COALESCE(v_total_profit, 0),
      'avg_profit_per_match', COALESCE(v_avg_profit, 0),
      'avg_earnings_per_match', COALESCE(v_avg_earnings, 0),
      'best_profit', COALESCE(v_best_profit, 0)
    ),
    'history', COALESCE(v_history, '[]'::jsonb),
    'streak', jsonb_build_object(
      'best', COALESCE(v_best_streak, 0),
      'current', COALESCE(v_current_streak, 0)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_profile_view(uuid) TO authenticated;

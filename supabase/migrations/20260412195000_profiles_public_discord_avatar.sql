CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker=on) AS
  SELECT
    p.id,
    p.user_id,
    p.username,
    p.discord_avatar_url AS avatar_url,
    p.epic_username,
    p.preferred_region,
    p.preferred_platform,
    p.created_at,
    p.discord_avatar_url,
    p.discord_display_name
  FROM public.profiles p;

GRANT SELECT ON public.profiles_public TO anon, authenticated;

CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
  p.id,
  p.user_id,
  p.username,
  p.discord_avatar_url AS avatar_url,
  COALESCE(w.wins, 0) AS wins,
  COALESCE(tm.total_matches, 0) AS total_matches,
  COALESCE(te.total_earnings, 0) AS total_earnings,
  p.discord_avatar_url
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
  SELECT t.user_id, SUM(t.amount) AS total_earnings
  FROM public.transactions t
  WHERE t.type = 'payout'
  GROUP BY t.user_id
) te ON te.user_id = p.user_id
WHERE p.is_banned = false;

DROP FUNCTION IF EXISTS public.get_leaderboard(integer, integer);

CREATE FUNCTION public.get_leaderboard(
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  username text,
  avatar_url text,
  total_matches bigint,
  wins bigint,
  total_earnings numeric,
  discord_avatar_url text
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
    lb.total_matches,
    lb.wins,
    lb.total_earnings,
    lb.discord_avatar_url
  FROM public.leaderboard lb
  ORDER BY lb.total_earnings DESC, lb.wins DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard(integer, integer) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.get_leaderboard_weekly(integer);

CREATE FUNCTION public.get_leaderboard_weekly(p_limit integer DEFAULT 10)
RETURNS TABLE (
  user_id uuid,
  username text,
  avatar_url text,
  weekly_earned numeric,
  discord_avatar_url text
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
    COALESCE(
      sum(
        CASE
          WHEN t.type = 'payout' AND t.amount > 0 THEN t.amount
          ELSE 0
        END
      ),
      0
    ) AS weekly_earned,
    p.discord_avatar_url
  FROM public.profiles p
  LEFT JOIN public.transactions t
    ON t.user_id = p.user_id
   AND t.created_at >= date_trunc('week', now())
   AND t.type = 'payout'
  WHERE p.is_banned = false
  GROUP BY p.user_id, p.username, p.discord_avatar_url
  HAVING COALESCE(
      sum(
        CASE
          WHEN t.type = 'payout' AND t.amount > 0 THEN t.amount
          ELSE 0
        END
      ),
      0
    ) > 0
  ORDER BY weekly_earned DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard_weekly(integer) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.search_players_public(text, uuid, integer);

CREATE FUNCTION public.search_players_public(
  p_query text,
  p_current_user_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  user_id uuid,
  username text,
  avatar_url text,
  rank bigint,
  discord_avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pp.user_id,
    pp.username,
    pp.discord_avatar_url AS avatar_url,
    COALESCE(
      (SELECT r.rn FROM (
        SELECT lb.user_id, ROW_NUMBER() OVER (ORDER BY lb.total_earnings DESC, lb.wins DESC) AS rn
        FROM public.leaderboard lb
      ) r WHERE r.user_id = pp.user_id),
      999999
    )::bigint AS rank,
    pp.discord_avatar_url
  FROM public.profiles_public pp
  WHERE
    pp.username ILIKE '%' || p_query || '%'
    AND (p_current_user_id IS NULL OR pp.user_id != p_current_user_id)
  ORDER BY
    CASE WHEN LOWER(pp.username) = LOWER(p_query) THEN 0 ELSE 1 END,
    LENGTH(pp.username)
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.search_players_public(text, uuid, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_team_members(p_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_members jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(to_jsonb(row) ORDER BY row.role, row.created_at), '[]'::jsonb)
  INTO v_members
  FROM (
    SELECT
      tm.user_id,
      tm.team_id,
      tm.role,
      tm.status,
      tm.created_at,
      p.username,
      p.discord_avatar_url,
      p.epic_username
    FROM public.team_members tm
    LEFT JOIN public.profiles p
      ON p.user_id = tm.user_id
    WHERE tm.team_id = p_team_id
  ) row;

  RETURN jsonb_build_object('success', true, 'members', v_members);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

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
  CASE
    WHEN public.has_role(m.user_id, 'admin'::public.app_role) THEN 'ADMIN'
    ELSE COALESCE(p.username, 'Unknown')
  END AS display_name,
  p.discord_avatar_url
FROM public.match_chat_messages m
LEFT JOIN public.profiles_public p
  ON p.user_id = m.user_id;

GRANT SELECT ON public.match_chat_messages_view TO authenticated;

CREATE OR REPLACE FUNCTION public.search_users_for_invite(
  p_team_id uuid,
  p_search_term text
)
RETURNS TABLE (
  user_id uuid,
  username text,
  epic_username text,
  avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF length(p_search_term) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    p.username,
    p.epic_username,
    p.discord_avatar_url AS avatar_url
  FROM public.profiles p
  WHERE (
    p.username ILIKE '%' || p_search_term || '%'
    OR p.epic_username ILIKE '%' || p_search_term || '%'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE tm.team_id = p_team_id
      AND tm.user_id = p.user_id
  )
  AND p.user_id != auth.uid()
  LIMIT 10;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_team_members_with_balance(
  p_team_id uuid
)
RETURNS TABLE (
  user_id uuid,
  username text,
  avatar_url text,
  role text,
  balance numeric,
  has_sufficient_balance boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    tm.user_id,
    p.username,
    p.discord_avatar_url AS avatar_url,
    tm.role,
    COALESCE(w.balance, 0) AS balance,
    true AS has_sufficient_balance
  FROM public.team_members tm
  JOIN public.profiles p
    ON p.user_id = tm.user_id
  LEFT JOIN public.wallets w
    ON w.user_id = tm.user_id
  WHERE tm.team_id = p_team_id
    AND tm.status = 'accepted'
  ORDER BY
    CASE tm.role
      WHEN 'owner' THEN 1
      WHEN 'captain' THEN 2
      ELSE 3
    END;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_global_search(p_query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
  v_escaped_query text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF length(p_query) < 2 THEN
    RETURN json_build_object('users', '[]'::json, 'matches', '[]'::json, 'transactions', '[]'::json);
  END IF;

  IF length(p_query) > 100 THEN
    RAISE EXCEPTION 'Search term too long';
  END IF;

  v_escaped_query := public.escape_like_pattern(p_query);

  SELECT json_build_object(
    'users', (
      SELECT COALESCE(json_agg(row_to_json(u)), '[]'::json)
      FROM (
        SELECT
          id,
          user_id,
          username,
          email,
          discord_avatar_url,
          is_banned
        FROM public.profiles
        WHERE
          username ILIKE '%' || v_escaped_query || '%'
          OR email ILIKE '%' || v_escaped_query || '%'
        LIMIT 5
      ) u
    ),
    'matches', (
      SELECT COALESCE(json_agg(row_to_json(m)), '[]'::json)
      FROM (
        SELECT
          m.id,
          m.mode,
          m.region,
          m.status,
          m.entry_fee,
          m.team_size,
          p.username AS creator_username,
          m.created_at
        FROM public.matches m
        LEFT JOIN public.profiles p
          ON m.creator_id = p.user_id
        WHERE
          m.id::text ILIKE '%' || v_escaped_query || '%'
          OR m.mode ILIKE '%' || v_escaped_query || '%'
          OR p.username ILIKE '%' || v_escaped_query || '%'
        ORDER BY m.created_at DESC
        LIMIT 5
      ) m
    ),
    'transactions', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT
          t.id,
          t.type,
          t.amount,
          t.description,
          t.match_id,
          t.user_id,
          t.created_at
        FROM public.transactions t
        WHERE
          t.id::text ILIKE '%' || v_escaped_query || '%'
          OR t.type ILIKE '%' || v_escaped_query || '%'
          OR t.description ILIKE '%' || v_escaped_query || '%'
        ORDER BY t.created_at DESC
        LIMIT 5
      ) t
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

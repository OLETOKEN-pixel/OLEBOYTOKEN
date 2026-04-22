-- Teams ranking and invite search avatar fixes.

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
  IF length(trim(coalesce(p_search_term, ''))) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    p.username,
    p.epic_username,
    coalesce(p.discord_avatar_url, p.avatar_url) AS avatar_url
  FROM public.profiles p
  WHERE (
    p.username ILIKE '%' || trim(p_search_term) || '%'
    OR p.epic_username ILIKE '%' || trim(p_search_term) || '%'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE tm.team_id = p_team_id
      AND tm.user_id = p.user_id
      AND tm.status IN ('accepted', 'pending')
  )
  AND p.user_id <> auth.uid()
  ORDER BY p.username ASC
  LIMIT 10;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_teams_page(
  p_search text DEFAULT '',
  p_limit integer DEFAULT 10,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teams jsonb;
BEGIN
  SELECT coalesce(
    jsonb_agg(to_jsonb(row) ORDER BY row.win_rate DESC, row.total_matches DESC, row.wins DESC, row.name ASC),
    '[]'::jsonb
  )
  INTO v_teams
  FROM (
    SELECT
      t.id,
      t.name,
      t.tag,
      t.logo_url,
      t.max_members,
      t.owner_id,
      t.created_at,
      coalesce(mc.member_count, 0)::integer AS member_count,
      coalesce(ms.total_matches, 0)::integer AS total_matches,
      coalesce(ms.wins, 0)::integer AS wins,
      greatest(coalesce(ms.total_matches, 0) - coalesce(ms.wins, 0), 0)::integer AS losses,
      CASE
        WHEN coalesce(ms.total_matches, 0) = 0 THEN 0
        ELSE round((coalesce(ms.wins, 0)::numeric / ms.total_matches::numeric) * 100, 2)
      END AS win_rate,
      (
        SELECT tm.status
        FROM public.team_members tm
        WHERE tm.team_id = t.id
          AND tm.user_id = auth.uid()
        ORDER BY tm.updated_at DESC NULLS LAST, tm.created_at DESC NULLS LAST
        LIMIT 1
      ) AS current_user_status,
      (
        auth.uid() IS NOT NULL
        AND coalesce(mc.member_count, 0) < t.max_members
        AND NOT EXISTS (
          SELECT 1
          FROM public.team_members tm
          WHERE tm.team_id = t.id
            AND tm.user_id = auth.uid()
            AND tm.status IN ('accepted', 'pending')
        )
      ) AS can_request
    FROM public.teams t
    LEFT JOIN (
      SELECT team_id, count(*) AS member_count
      FROM public.team_members
      WHERE status = 'accepted'
      GROUP BY team_id
    ) mc ON mc.team_id = t.id
    LEFT JOIN (
      SELECT
        team_id,
        count(*) AS total_matches,
        count(*) FILTER (WHERE won) AS wins
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
      ) team_match_rows
      WHERE team_id IS NOT NULL
      GROUP BY team_id
    ) ms ON ms.team_id = t.id
    WHERE p_search IS NULL
      OR length(trim(p_search)) = 0
      OR t.name ILIKE '%' || trim(p_search) || '%'
      OR t.tag ILIKE '%' || trim(p_search) || '%'
    ORDER BY win_rate DESC, coalesce(ms.total_matches, 0) DESC, coalesce(ms.wins, 0) DESC, t.name ASC
    LIMIT greatest(1, least(coalesce(p_limit, 10), 50))
    OFFSET greatest(coalesce(p_offset, 0), 0)
  ) row;

  RETURN jsonb_build_object('success', true, 'teams', v_teams);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'teams'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'team_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'matches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'match_results'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.match_results;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.search_users_for_invite(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_teams_page(text, integer, integer) TO anon, authenticated;

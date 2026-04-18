-- Ensure participant-scoped match details include safe profile names and Discord avatars.
-- The frontend uses this RPC after ready-up/start so both teams can see each other.

CREATE OR REPLACE FUNCTION public.get_match_details(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_is_allowed boolean;
  v_is_admin boolean;
  v_match jsonb;
  v_creator jsonb;
  v_participants jsonb;
  v_result jsonb;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  v_is_admin := public.is_admin();

  SELECT (v_is_admin OR public.is_match_participant(p_match_id, v_caller_id))
    INTO v_is_allowed;

  IF NOT COALESCE(v_is_allowed, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;

  SELECT to_jsonb(m.*) INTO v_match
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;

  SELECT to_jsonb(row)
  INTO v_creator
  FROM (
    SELECT
      p.user_id,
      p.username,
      p.discord_avatar_url AS avatar_url,
      p.discord_avatar_url,
      p.epic_username,
      p.discord_display_name
    FROM public.profiles p
    WHERE p.user_id = (v_match->>'creator_id')::uuid
  ) row;

  SELECT COALESCE(jsonb_agg(to_jsonb(row) ORDER BY (row.joined_at)), '[]'::jsonb)
  INTO v_participants
  FROM (
    SELECT
      mp.*,
      (
        SELECT to_jsonb(pp)
        FROM (
          SELECT
            p.user_id,
            p.username,
            p.discord_avatar_url AS avatar_url,
            p.discord_avatar_url,
            p.epic_username,
            p.discord_display_name
          FROM public.profiles p
          WHERE p.user_id = mp.user_id
        ) pp
      ) AS profile
    FROM public.match_participants mp
    WHERE mp.match_id = p_match_id
  ) row;

  SELECT to_jsonb(r.*)
  INTO v_result
  FROM public.match_results r
  WHERE r.match_id = p_match_id
  LIMIT 1;

  RETURN jsonb_build_object(
    'success', true,
    'match', v_match || jsonb_build_object(
      'creator', v_creator,
      'participants', v_participants,
      'result', v_result
    )
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_match_details(uuid) TO authenticated;

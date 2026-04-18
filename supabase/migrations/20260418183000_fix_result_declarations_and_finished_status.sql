-- Fix result declarations so each side declares from its own perspective.
-- Opposite declarations (A WIN / B LOSS or A LOSS / B WIN) finish the match.
-- Matching declarations (both WIN or both LOSS) stay disputed for admin review.

DROP FUNCTION IF EXISTS public.submit_match_result(uuid, text);
DROP FUNCTION IF EXISTS public.submit_team_declaration(uuid, text);

CREATE FUNCTION public.submit_team_declaration(
  p_match_id uuid,
  p_result text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_result text := UPPER(TRIM(COALESCE(p_result, '')));
  v_match matches%ROWTYPE;
  v_participant match_participants%ROWTYPE;
  v_team_side text;
  v_existing_team_result text;
  v_opp_team_side text;
  v_opp_result text;
  v_opp_user_ids uuid[];
  v_finalize jsonb;
  v_status text;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'status', 'not_authenticated', 'error', 'Not authenticated');
  END IF;

  IF v_result NOT IN ('WIN', 'LOSS') THEN
    RETURN jsonb_build_object('success', false, 'status', 'invalid_result', 'error', 'Invalid result. Must be WIN or LOSS');
  END IF;

  SELECT * INTO v_match
  FROM matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'status', 'not_found', 'error', 'Match not found');
  END IF;

  IF v_match.status NOT IN ('in_progress', 'result_pending') THEN
    RETURN jsonb_build_object('success', false, 'status', 'invalid_status', 'error', 'Match is not in progress or result pending');
  END IF;

  SELECT * INTO v_participant
  FROM match_participants
  WHERE match_id = p_match_id
    AND user_id = v_caller_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'status', 'not_participant', 'error', 'You are not a participant in this match');
  END IF;

  v_team_side := v_participant.team_side;

  IF v_team_side NOT IN ('A', 'B') THEN
    RETURN jsonb_build_object('success', false, 'status', 'invalid_team_side', 'error', 'Participant has no valid team side');
  END IF;

  PERFORM 1
  FROM match_participants
  WHERE match_id = p_match_id
    AND team_side = v_team_side
  FOR UPDATE;

  SELECT mp.result_choice INTO v_existing_team_result
  FROM match_participants mp
  WHERE mp.match_id = p_match_id
    AND mp.team_side = v_team_side
    AND mp.result_choice IS NOT NULL
  LIMIT 1;

  IF v_existing_team_result IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'already_submitted',
      'message', 'Your team already declared: ' || v_existing_team_result
    );
  END IF;

  UPDATE match_participants
  SET result_choice = v_result,
      result_at = now()
  WHERE match_id = p_match_id
    AND team_side = v_team_side;

  IF v_match.status = 'in_progress' THEN
    UPDATE matches SET status = 'result_pending' WHERE id = p_match_id;
  END IF;

  v_opp_team_side := CASE WHEN v_team_side = 'A' THEN 'B' ELSE 'A' END;

  SELECT array_agg(user_id) INTO v_opp_user_ids
  FROM match_participants
  WHERE match_id = p_match_id
    AND team_side = v_opp_team_side;

  IF v_opp_user_ids IS NOT NULL AND array_length(v_opp_user_ids, 1) > 0 THEN
    PERFORM public.emit_match_event(
      p_match_id,
      'result_declared',
      v_caller_id,
      v_opp_user_ids,
      jsonb_build_object('team_side', v_team_side, 'result', v_result)
    );
  END IF;

  SELECT mp.result_choice INTO v_opp_result
  FROM match_participants mp
  WHERE mp.match_id = p_match_id
    AND mp.team_side = v_opp_team_side
    AND mp.result_choice IS NOT NULL
  LIMIT 1;

  IF v_opp_result IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'result_pending',
      'message', 'Result declared. Waiting for opponent team.'
    );
  END IF;

  v_finalize := public.try_finalize_match(p_match_id);
  v_status := COALESCE(v_finalize->>'status', 'submitted');

  IF v_status IN ('completed', 'already_finalized') THEN
    UPDATE matches
    SET status = 'finished',
        finished_at = COALESCE(finished_at, now())
    WHERE id = p_match_id
      AND status IN ('completed', 'finished');
    v_status := 'finished';
  END IF;

  RETURN jsonb_build_object(
    'success', COALESCE((v_finalize->>'success')::boolean, true),
    'status', v_status,
    'winner_side', v_finalize->>'winner_side',
    'message', COALESCE(v_finalize->>'message', CASE WHEN v_status = 'finished' THEN 'Match finished successfully.' ELSE 'Result processed.' END)
  );
END;
$$;

CREATE FUNCTION public.submit_match_result(
  p_match_id uuid,
  p_result text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_result text := UPPER(TRIM(COALESCE(p_result, '')));
  v_match matches%ROWTYPE;
  v_participant match_participants%ROWTYPE;
  v_team_side text;
  v_opp_team_side text;
  v_opp_result text;
  v_finalize jsonb;
  v_status text;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'status', 'not_authenticated', 'error', 'Not authenticated');
  END IF;

  IF v_result NOT IN ('WIN', 'LOSS') THEN
    RETURN jsonb_build_object('success', false, 'status', 'invalid_result', 'error', 'Invalid result. Must be WIN or LOSS');
  END IF;

  SELECT * INTO v_match
  FROM matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'status', 'not_found', 'error', 'Match not found');
  END IF;

  IF COALESCE(v_match.team_size, 1) > 1 THEN
    RETURN public.submit_team_declaration(p_match_id, v_result);
  END IF;

  IF v_match.status NOT IN ('in_progress', 'result_pending') THEN
    RETURN jsonb_build_object('success', false, 'status', 'invalid_status', 'error', 'Match is not in progress or result pending');
  END IF;

  SELECT * INTO v_participant
  FROM match_participants
  WHERE match_id = p_match_id
    AND user_id = v_caller_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'status', 'not_participant', 'error', 'You are not a participant in this match');
  END IF;

  v_team_side := v_participant.team_side;

  IF v_team_side NOT IN ('A', 'B') THEN
    RETURN jsonb_build_object('success', false, 'status', 'invalid_team_side', 'error', 'Participant has no valid team side');
  END IF;

  IF v_participant.result_choice IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'already_submitted',
      'message', 'You already declared: ' || v_participant.result_choice
    );
  END IF;

  UPDATE match_participants
  SET result_choice = v_result,
      result_at = now()
  WHERE id = v_participant.id;

  IF v_match.status = 'in_progress' THEN
    UPDATE matches SET status = 'result_pending' WHERE id = p_match_id;
  END IF;

  v_opp_team_side := CASE WHEN v_team_side = 'A' THEN 'B' ELSE 'A' END;

  SELECT mp.result_choice INTO v_opp_result
  FROM match_participants mp
  WHERE mp.match_id = p_match_id
    AND mp.team_side = v_opp_team_side
    AND mp.result_choice IS NOT NULL
  LIMIT 1;

  IF v_opp_result IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'result_pending',
      'message', 'Result declared. Waiting for opponent.'
    );
  END IF;

  v_finalize := public.try_finalize_match(p_match_id);
  v_status := COALESCE(v_finalize->>'status', 'submitted');

  IF v_status IN ('completed', 'already_finalized') THEN
    UPDATE matches
    SET status = 'finished',
        finished_at = COALESCE(finished_at, now())
    WHERE id = p_match_id
      AND status IN ('completed', 'finished');
    v_status := 'finished';
  END IF;

  RETURN jsonb_build_object(
    'success', COALESCE((v_finalize->>'success')::boolean, true),
    'status', v_status,
    'winner_side', v_finalize->>'winner_side',
    'message', COALESCE(v_finalize->>'message', CASE WHEN v_status = 'finished' THEN 'Match finished successfully.' ELSE 'Result processed.' END)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_team_declaration(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_match_result(uuid, text) TO authenticated;

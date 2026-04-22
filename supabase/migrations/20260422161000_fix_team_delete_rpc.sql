-- Ensure team owners can delete their full team from the Teams page.

CREATE OR REPLACE FUNCTION public.delete_team(p_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_team_name text;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT name
  INTO v_team_name
  FROM public.teams
  WHERE id = p_team_id
    AND owner_id = v_user_id;

  IF v_team_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found or you are not the owner');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.matches
    WHERE (team_a_id = p_team_id OR team_b_id = p_team_id)
      AND status NOT IN ('finished', 'expired', 'cancelled')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot delete team while it has an active match');
  END IF;

  DELETE FROM public.team_members WHERE team_id = p_team_id;
  DELETE FROM public.teams WHERE id = p_team_id;

  RETURN jsonb_build_object('success', true, 'message', format('Team "%s" deleted successfully', v_team_name));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_team(uuid) TO authenticated;

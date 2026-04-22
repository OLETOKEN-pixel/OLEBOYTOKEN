-- Change voting model from "one vote per user per week" to
-- "many votes per user (one per highlight), toggle on click"

-- 1. Drop the week-based uniqueness
ALTER TABLE public.highlight_votes
  DROP CONSTRAINT IF EXISTS highlight_votes_unique_per_week;

-- 2. Clean up duplicates that would block the new unique
DELETE FROM public.highlight_votes a
USING public.highlight_votes b
WHERE a.id > b.id
  AND a.user_id = b.user_id
  AND a.highlight_id = b.highlight_id;

-- 3. Add per-(user, highlight) uniqueness
ALTER TABLE public.highlight_votes
  ADD CONSTRAINT highlight_votes_unique_per_user_highlight
  UNIQUE (user_id, highlight_id);

-- 4. Rewrite RPC as pure toggle — no more switch semantics
CREATE OR REPLACE FUNCTION public.vote_highlight(p_highlight_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_existing_id uuid;
  v_week_start date;
  v_action text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT id INTO v_existing_id
  FROM highlight_votes
  WHERE user_id = v_user_id AND highlight_id = p_highlight_id;

  IF v_existing_id IS NOT NULL THEN
    DELETE FROM highlight_votes WHERE id = v_existing_id;
    v_action := 'unvoted';
  ELSE
    v_week_start := (date_trunc('week', now()))::date;
    INSERT INTO highlight_votes (user_id, highlight_id, week_start)
    VALUES (v_user_id, p_highlight_id, v_week_start);
    v_action := 'voted';
  END IF;

  RETURN json_build_object('success', true, 'action', v_action);
END;
$$;

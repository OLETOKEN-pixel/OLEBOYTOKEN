-- Make challenges permanent one-time achievements (period_key = 'lifetime')
-- Prevents daily/weekly reset and XP farming.
-- Once a challenge is claimed, it stays claimed forever.

-- A) update_challenge_progress — use 'lifetime' instead of daily/weekly period key
CREATE OR REPLACE FUNCTION public.update_challenge_progress(
  p_user_id   UUID,
  p_metric_type TEXT,
  p_source_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_challenge RECORD;
  v_progress  RECORD;
BEGIN
  FOR v_challenge IN
    SELECT * FROM challenges
    WHERE metric_type = p_metric_type AND is_active = true
  LOOP
    -- If already claimed (lifetime), skip — no double XP
    SELECT * INTO v_progress
    FROM user_challenge_progress
    WHERE user_id = p_user_id
      AND challenge_id = v_challenge.id
      AND period_key = 'lifetime';

    IF FOUND AND v_progress.is_claimed THEN
      CONTINUE;
    END IF;

    -- Upsert progress, capped at target_value
    INSERT INTO user_challenge_progress (user_id, challenge_id, period_key, progress_value)
    VALUES (p_user_id, v_challenge.id, 'lifetime', 1)
    ON CONFLICT (user_id, challenge_id, period_key)
    DO UPDATE SET
      progress_value = LEAST(
        user_challenge_progress.progress_value + 1,
        v_challenge.target_value
      ),
      updated_at = now();

    -- Re-read to check completion
    SELECT * INTO v_progress
    FROM user_challenge_progress
    WHERE user_id = p_user_id
      AND challenge_id = v_challenge.id
      AND period_key = 'lifetime';

    IF v_progress.progress_value >= v_challenge.target_value AND NOT v_progress.is_completed THEN
      UPDATE user_challenge_progress
      SET is_completed = true, completed_at = now()
      WHERE id = v_progress.id;
    END IF;
  END LOOP;
END;
$$;

-- B) get_user_challenges — always join on 'lifetime' period_key
CREATE OR REPLACE FUNCTION public.get_user_challenges(p_type TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_result  JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id',             c.id,
      'title',          c.title,
      'description',    c.description,
      'type',           c.type,
      'metric_type',    c.metric_type,
      'target_value',   c.target_value,
      'reward_xp',      c.reward_xp,
      'reward_coin',    c.reward_coin,
      'progress_value', COALESCE(p.progress_value, 0),
      'is_completed',   COALESCE(p.is_completed, false),
      'is_claimed',     COALESCE(p.is_claimed, false),
      'period_key',     'lifetime'
    )
    ORDER BY c.type, c.created_at
  ) INTO v_result
  FROM challenges c
  LEFT JOIN user_challenge_progress p
    ON  p.challenge_id = c.id
    AND p.user_id      = v_user_id
    AND p.period_key   = 'lifetime'
  WHERE c.is_active = true
  AND (p_type IS NULL OR c.type = p_type);

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

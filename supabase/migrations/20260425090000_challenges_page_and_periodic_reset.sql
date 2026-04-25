ALTER TABLE public.challenges
ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.update_challenge_progress(
  p_user_id UUID,
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
  v_period_key TEXT;
BEGIN
  FOR v_challenge IN
    SELECT *
    FROM public.challenges
    WHERE metric_type = p_metric_type
      AND is_active = true
    ORDER BY
      CASE WHEN type = 'daily' THEN 0 ELSE 1 END,
      sort_order,
      created_at
  LOOP
    v_period_key := public.get_current_period_key(v_challenge.type);

    INSERT INTO public.user_challenge_progress (
      user_id,
      challenge_id,
      period_key,
      progress_value
    )
    VALUES (
      p_user_id,
      v_challenge.id,
      v_period_key,
      1
    )
    ON CONFLICT (user_id, challenge_id, period_key)
    DO UPDATE SET
      progress_value = LEAST(
        public.user_challenge_progress.progress_value + 1,
        v_challenge.target_value
      ),
      updated_at = now();

    UPDATE public.user_challenge_progress
    SET
      is_completed = true,
      completed_at = COALESCE(completed_at, now())
    WHERE user_id = p_user_id
      AND challenge_id = v_challenge.id
      AND period_key = v_period_key
      AND progress_value >= v_challenge.target_value
      AND is_completed = false;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_challenges(p_type TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_daily_key TEXT;
  v_weekly_key TEXT;
  v_result JSONB;
BEGIN
  v_daily_key := public.get_current_period_key('daily');
  v_weekly_key := public.get_current_period_key('weekly');

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'title', c.title,
      'description', c.description,
      'type', c.type,
      'metric_type', c.metric_type,
      'target_value', c.target_value,
      'reward_xp', c.reward_xp,
      'reward_coin', c.reward_coin,
      'progress_value', COALESCE(p.progress_value, 0),
      'is_completed', COALESCE(p.is_completed, false),
      'is_claimed', COALESCE(p.is_claimed, false),
      'period_key', CASE WHEN c.type = 'daily' THEN v_daily_key ELSE v_weekly_key END,
      'sort_order', c.sort_order
    )
    ORDER BY
      CASE WHEN c.type = 'daily' THEN 0 ELSE 1 END,
      c.sort_order,
      c.created_at
  ) INTO v_result
  FROM public.challenges c
  LEFT JOIN public.user_challenge_progress p
    ON p.challenge_id = c.id
   AND p.user_id = v_user_id
   AND p.period_key = CASE WHEN c.type = 'daily' THEN v_daily_key ELSE v_weekly_key END
  WHERE c.is_active = true
    AND (p_type IS NULL OR c.type = p_type);

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

WITH desired_challenges AS (
  SELECT *
  FROM (
    VALUES
      ('daily', 'match_completed', 1, 'Play 1 Match', 'Complete any match today', 30, 0::numeric, 1),
      ('daily', 'match_completed', 3, 'Play 3 Matches', 'Complete three matches today', 60, 0::numeric, 2),
      ('daily', 'ready_up_fast', 1, 'Ready Up Fast', 'Ready within 2 minutes after the ready check starts', 20, 0::numeric, 3),
      ('daily', 'proof_uploaded', 1, 'Upload 1 Match Proof', 'Upload proof in one match today', 30, 0::numeric, 4),
      ('daily', 'match_created_started', 1, 'Start 1 Match You Created', 'Get one match you created into in-progress today', 30, 0::numeric, 5),
      ('weekly', 'match_completed', 10, 'Complete 10 Matches', 'Complete 10 matches this week', 50, 1::numeric, 1),
      ('weekly', 'match_completed', 25, 'Complete 25 Matches', 'Complete 25 matches this week', 100, 0::numeric, 2),
      ('weekly', 'match_created_started', 5, 'Start 5 Matches You Created', 'Get 5 matches you created into in-progress this week', 40, 1::numeric, 3),
      ('weekly', 'proof_uploaded', 5, 'Upload Proof in 5 Matches', 'Upload proof in five matches this week', 50, 1::numeric, 4),
      ('weekly', 'ready_up_fast', 5, 'Ready Up Fast 5 Times', 'Ready up fast five times this week', 40, 0::numeric, 5)
  ) AS desired(
    type,
    metric_type,
    target_value,
    title,
    description,
    reward_xp,
    reward_coin,
    sort_order
  )
),
duplicate_rows AS (
  SELECT
    c.id,
    ROW_NUMBER() OVER (
      PARTITION BY c.type, c.metric_type, c.target_value
      ORDER BY c.created_at, c.id
    ) AS duplicate_rank
  FROM public.challenges c
  JOIN desired_challenges d
    ON d.type = c.type
   AND d.metric_type = c.metric_type
   AND d.target_value = c.target_value
  WHERE c.is_active = true
)
UPDATE public.challenges c
SET
  is_active = false,
  updated_at = now()
FROM duplicate_rows d
WHERE c.id = d.id
  AND d.duplicate_rank > 1;

WITH desired_challenges AS (
  SELECT *
  FROM (
    VALUES
      ('daily', 'match_completed', 1, 'Play 1 Match', 'Complete any match today', 30, 0::numeric, 1),
      ('daily', 'match_completed', 3, 'Play 3 Matches', 'Complete three matches today', 60, 0::numeric, 2),
      ('daily', 'ready_up_fast', 1, 'Ready Up Fast', 'Ready within 2 minutes after the ready check starts', 20, 0::numeric, 3),
      ('daily', 'proof_uploaded', 1, 'Upload 1 Match Proof', 'Upload proof in one match today', 30, 0::numeric, 4),
      ('daily', 'match_created_started', 1, 'Start 1 Match You Created', 'Get one match you created into in-progress today', 30, 0::numeric, 5),
      ('weekly', 'match_completed', 10, 'Complete 10 Matches', 'Complete 10 matches this week', 50, 1::numeric, 1),
      ('weekly', 'match_completed', 25, 'Complete 25 Matches', 'Complete 25 matches this week', 100, 0::numeric, 2),
      ('weekly', 'match_created_started', 5, 'Start 5 Matches You Created', 'Get 5 matches you created into in-progress this week', 40, 1::numeric, 3),
      ('weekly', 'proof_uploaded', 5, 'Upload Proof in 5 Matches', 'Upload proof in five matches this week', 50, 1::numeric, 4),
      ('weekly', 'ready_up_fast', 5, 'Ready Up Fast 5 Times', 'Ready up fast five times this week', 40, 0::numeric, 5)
  ) AS desired(
    type,
    metric_type,
    target_value,
    title,
    description,
    reward_xp,
    reward_coin,
    sort_order
  )
)
UPDATE public.challenges c
SET
  title = d.title,
  description = d.description,
  reward_xp = d.reward_xp,
  reward_coin = d.reward_coin,
  sort_order = d.sort_order,
  is_active = true,
  updated_at = now()
FROM desired_challenges d
WHERE c.id = (
  SELECT c2.id
  FROM public.challenges c2
  WHERE c2.type = d.type
    AND c2.metric_type = d.metric_type
    AND c2.target_value = d.target_value
  ORDER BY
    CASE WHEN c2.is_active THEN 0 ELSE 1 END,
    c2.created_at,
    c2.id
  LIMIT 1
);

WITH desired_challenges AS (
  SELECT *
  FROM (
    VALUES
      ('daily', 'match_completed', 1, 'Play 1 Match', 'Complete any match today', 30, 0::numeric, 1),
      ('daily', 'match_completed', 3, 'Play 3 Matches', 'Complete three matches today', 60, 0::numeric, 2),
      ('daily', 'ready_up_fast', 1, 'Ready Up Fast', 'Ready within 2 minutes after the ready check starts', 20, 0::numeric, 3),
      ('daily', 'proof_uploaded', 1, 'Upload 1 Match Proof', 'Upload proof in one match today', 30, 0::numeric, 4),
      ('daily', 'match_created_started', 1, 'Start 1 Match You Created', 'Get one match you created into in-progress today', 30, 0::numeric, 5),
      ('weekly', 'match_completed', 10, 'Complete 10 Matches', 'Complete 10 matches this week', 50, 1::numeric, 1),
      ('weekly', 'match_completed', 25, 'Complete 25 Matches', 'Complete 25 matches this week', 100, 0::numeric, 2),
      ('weekly', 'match_created_started', 5, 'Start 5 Matches You Created', 'Get 5 matches you created into in-progress this week', 40, 1::numeric, 3),
      ('weekly', 'proof_uploaded', 5, 'Upload Proof in 5 Matches', 'Upload proof in five matches this week', 50, 1::numeric, 4),
      ('weekly', 'ready_up_fast', 5, 'Ready Up Fast 5 Times', 'Ready up fast five times this week', 40, 0::numeric, 5)
  ) AS desired(
    type,
    metric_type,
    target_value,
    title,
    description,
    reward_xp,
    reward_coin,
    sort_order
  )
)
INSERT INTO public.challenges (
  title,
  description,
  type,
  metric_type,
  target_value,
  reward_xp,
  reward_coin,
  is_active,
  sort_order
)
SELECT
  d.title,
  d.description,
  d.type,
  d.metric_type,
  d.target_value,
  d.reward_xp,
  d.reward_coin,
  true,
  d.sort_order
FROM desired_challenges d
WHERE NOT EXISTS (
  SELECT 1
  FROM public.challenges c
  WHERE c.type = d.type
    AND c.metric_type = d.metric_type
    AND c.target_value = d.target_value
);

WITH desired_challenges AS (
  SELECT *
  FROM (
    VALUES
      ('daily', 'match_completed', 1),
      ('daily', 'match_completed', 3),
      ('daily', 'ready_up_fast', 1),
      ('daily', 'proof_uploaded', 1),
      ('daily', 'match_created_started', 1),
      ('weekly', 'match_completed', 10),
      ('weekly', 'match_completed', 25),
      ('weekly', 'match_created_started', 5),
      ('weekly', 'proof_uploaded', 5),
      ('weekly', 'ready_up_fast', 5)
  ) AS desired(type, metric_type, target_value)
)
UPDATE public.challenges c
SET
  is_active = false,
  updated_at = now()
WHERE c.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM desired_challenges d
    WHERE d.type = c.type
      AND d.metric_type = c.metric_type
      AND d.target_value = c.target_value
  );

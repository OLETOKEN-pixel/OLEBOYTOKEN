CREATE TABLE IF NOT EXISTS public.shop_level_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  level_required INT NOT NULL CHECK (level_required > 0),
  image_path TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_shop_level_rewards_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_shop_level_rewards_updated_at ON public.shop_level_rewards;
CREATE TRIGGER set_shop_level_rewards_updated_at
BEFORE UPDATE ON public.shop_level_rewards
FOR EACH ROW
EXECUTE FUNCTION public.set_shop_level_rewards_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS shop_level_rewards_unique_active_level_idx
  ON public.shop_level_rewards (level_required)
  WHERE is_active = true;

ALTER TABLE public.shop_level_rewards ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.shop_level_rewards TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.shop_level_rewards TO authenticated;

DROP POLICY IF EXISTS "Anyone can view active shop rewards" ON public.shop_level_rewards;
CREATE POLICY "Anyone can view active shop rewards"
  ON public.shop_level_rewards
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins can manage shop rewards" ON public.shop_level_rewards;
CREATE POLICY "Admins can manage shop rewards"
  ON public.shop_level_rewards
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shop-rewards',
  'shop-rewards',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Shop reward images are public" ON storage.objects;
CREATE POLICY "Shop reward images are public"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'shop-rewards');

DROP POLICY IF EXISTS "Admins can upload shop reward images" ON storage.objects;
CREATE POLICY "Admins can upload shop reward images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'shop-rewards'
    AND public.is_admin()
  );

DROP POLICY IF EXISTS "Admins can update shop reward images" ON storage.objects;
CREATE POLICY "Admins can update shop reward images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'shop-rewards'
    AND public.is_admin()
  )
  WITH CHECK (
    bucket_id = 'shop-rewards'
    AND public.is_admin()
  );

DROP POLICY IF EXISTS "Admins can delete shop reward images" ON storage.objects;
CREATE POLICY "Admins can delete shop reward images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'shop-rewards'
    AND public.is_admin()
  );

CREATE OR REPLACE FUNCTION public.admin_upsert_shop_level_reward(
  p_reward_id UUID DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT '',
  p_level_required INT DEFAULT NULL,
  p_image_path TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward_id UUID;
  v_conflict_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF length(trim(COALESCE(p_name, ''))) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reward name is required');
  END IF;

  IF p_level_required IS NULL OR p_level_required < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Level must be greater than zero');
  END IF;

  IF length(trim(COALESCE(p_image_path, ''))) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reward image is required');
  END IF;

  IF p_is_active THEN
    SELECT id INTO v_conflict_id
    FROM public.shop_level_rewards
    WHERE level_required = p_level_required
      AND is_active = true
      AND id <> COALESCE(p_reward_id, '00000000-0000-0000-0000-000000000000'::uuid)
    LIMIT 1;

    IF v_conflict_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Another active reward already uses this level');
    END IF;
  END IF;

  IF p_reward_id IS NULL THEN
    INSERT INTO public.shop_level_rewards (
      name,
      description,
      level_required,
      image_path,
      is_active
    )
    VALUES (
      trim(p_name),
      COALESCE(p_description, ''),
      p_level_required,
      trim(p_image_path),
      COALESCE(p_is_active, true)
    )
    RETURNING id INTO v_reward_id;
  ELSE
    UPDATE public.shop_level_rewards
    SET
      name = trim(p_name),
      description = COALESCE(p_description, ''),
      level_required = p_level_required,
      image_path = trim(p_image_path),
      is_active = COALESCE(p_is_active, true),
      updated_at = now()
    WHERE id = p_reward_id
    RETURNING id INTO v_reward_id;

    IF v_reward_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Reward not found');
    END IF;
  END IF;

  PERFORM public.log_admin_action(
    'upsert_shop_level_reward',
    'shop_reward',
    v_reward_id,
    jsonb_build_object(
      'name', trim(p_name),
      'description', COALESCE(p_description, ''),
      'level_required', p_level_required,
      'image_path', trim(p_image_path),
      'is_active', COALESCE(p_is_active, true)
    )
  );

  RETURN jsonb_build_object('success', true, 'id', v_reward_id);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Another active reward already uses this level');
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_shop_level_reward_active(
  p_reward_id UUID,
  p_is_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward public.shop_level_rewards%ROWTYPE;
  v_conflict_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO v_reward
  FROM public.shop_level_rewards
  WHERE id = p_reward_id;

  IF v_reward.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reward not found');
  END IF;

  IF p_is_active THEN
    SELECT id INTO v_conflict_id
    FROM public.shop_level_rewards
    WHERE level_required = v_reward.level_required
      AND is_active = true
      AND id <> p_reward_id
    LIMIT 1;

    IF v_conflict_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Another active reward already uses this level');
    END IF;
  END IF;

  UPDATE public.shop_level_rewards
  SET
    is_active = p_is_active,
    updated_at = now()
  WHERE id = p_reward_id;

  PERFORM public.log_admin_action(
    'set_shop_level_reward_active',
    'shop_reward',
    p_reward_id,
    jsonb_build_object('is_active', p_is_active)
  );

  RETURN jsonb_build_object('success', true, 'id', p_reward_id, 'is_active', p_is_active);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_upsert_shop_level_reward(UUID, TEXT, TEXT, INT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_shop_level_reward_active(UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_upsert_challenge(
  p_challenge_id UUID DEFAULT NULL,
  p_title TEXT DEFAULT NULL,
  p_description TEXT DEFAULT '',
  p_type TEXT DEFAULT NULL,
  p_metric_type TEXT DEFAULT NULL,
  p_target_value INT DEFAULT NULL,
  p_reward_xp INT DEFAULT 0,
  p_reward_coin NUMERIC DEFAULT 0,
  p_sort_order INT DEFAULT 0,
  p_is_active BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_challenge_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF length(trim(COALESCE(p_title, ''))) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Challenge title is required');
  END IF;

  IF length(trim(COALESCE(p_description, ''))) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Challenge description is required');
  END IF;

  IF p_type NOT IN ('daily', 'weekly') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Challenge type is invalid');
  END IF;

  IF length(trim(COALESCE(p_metric_type, ''))) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Metric type is required');
  END IF;

  IF p_target_value IS NULL OR p_target_value < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target value must be greater than zero');
  END IF;

  IF COALESCE(p_reward_xp, 0) < 0 OR COALESCE(p_reward_coin, 0) < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rewards cannot be negative');
  END IF;

  IF p_challenge_id IS NULL THEN
    INSERT INTO public.challenges (
      title,
      description,
      type,
      metric_type,
      target_value,
      reward_xp,
      reward_coin,
      sort_order,
      is_active
    )
    VALUES (
      trim(p_title),
      trim(p_description),
      p_type,
      trim(p_metric_type),
      p_target_value,
      COALESCE(p_reward_xp, 0),
      COALESCE(p_reward_coin, 0),
      COALESCE(p_sort_order, 0),
      COALESCE(p_is_active, true)
    )
    RETURNING id INTO v_challenge_id;
  ELSE
    UPDATE public.challenges
    SET
      title = trim(p_title),
      description = trim(p_description),
      type = p_type,
      metric_type = trim(p_metric_type),
      target_value = p_target_value,
      reward_xp = COALESCE(p_reward_xp, 0),
      reward_coin = COALESCE(p_reward_coin, 0),
      sort_order = COALESCE(p_sort_order, 0),
      is_active = COALESCE(p_is_active, true),
      updated_at = now()
    WHERE id = p_challenge_id
    RETURNING id INTO v_challenge_id;

    IF v_challenge_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Challenge not found');
    END IF;
  END IF;

  PERFORM public.log_admin_action(
    'upsert_challenge',
    'challenge',
    v_challenge_id,
    jsonb_build_object(
      'title', trim(p_title),
      'description', trim(p_description),
      'type', p_type,
      'metric_type', trim(p_metric_type),
      'target_value', p_target_value,
      'reward_xp', COALESCE(p_reward_xp, 0),
      'reward_coin', COALESCE(p_reward_coin, 0),
      'sort_order', COALESCE(p_sort_order, 0),
      'is_active', COALESCE(p_is_active, true)
    )
  );

  RETURN jsonb_build_object('success', true, 'id', v_challenge_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_challenge_active(
  p_challenge_id UUID,
  p_is_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT EXISTS(
    SELECT 1
    FROM public.challenges
    WHERE id = p_challenge_id
  )
  INTO v_exists;

  IF NOT v_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Challenge not found');
  END IF;

  UPDATE public.challenges
  SET
    is_active = p_is_active,
    updated_at = now()
  WHERE id = p_challenge_id;

  PERFORM public.log_admin_action(
    'set_challenge_active',
    'challenge',
    p_challenge_id,
    jsonb_build_object('is_active', p_is_active)
  );

  RETURN jsonb_build_object('success', true, 'id', p_challenge_id, 'is_active', p_is_active);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_upsert_challenge(UUID, TEXT, TEXT, TEXT, TEXT, INT, INT, NUMERIC, INT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_challenge_active(UUID, BOOLEAN) TO authenticated;

INSERT INTO public.shop_level_rewards (name, description, level_required, image_path, is_active)
SELECT 'TAPPETINO', 'Official OleBoy mousepad reward.', 15, '/shop/tappetino.png', true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.shop_level_rewards
  WHERE level_required = 15
    AND is_active = true
);

INSERT INTO public.shop_level_rewards (name, description, level_required, image_path, is_active)
SELECT 'MOUSE', 'Official OleBoy mouse reward.', 30, '/shop/mouse.webp', true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.shop_level_rewards
  WHERE level_required = 30
    AND is_active = true
);

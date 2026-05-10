-- Canonical shop catalog powering /admin/shop, /shop, wallet purchase overlay,
-- and the home shop preview.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shop_item_kind') THEN
    CREATE TYPE public.shop_item_kind AS ENUM (
      'coin_pack',
      'vip_membership',
      'physical_product',
      'physical_reward',
      'action_card'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shop_price_audience') THEN
    CREATE TYPE public.shop_price_audience AS ENUM ('base', 'vip');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shop_price_currency') THEN
    CREATE TYPE public.shop_price_currency AS ENUM ('eur', 'coins');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shop_unlock_type') THEN
    CREATE TYPE public.shop_unlock_type AS ENUM ('none', 'level', 'challenge');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shop_claim_status') THEN
    CREATE TYPE public.shop_claim_status AS ENUM (
      'pending',
      'approved',
      'fulfilled',
      'rejected',
      'cancelled'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.shop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  kind public.shop_item_kind NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  image_path TEXT NOT NULL,
  cta_label TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  action_key TEXT NULL,
  coin_amount INT NULL CHECK (coin_amount IS NULL OR coin_amount > 0),
  vip_duration_days INT NULL CHECK (vip_duration_days IS NULL OR vip_duration_days > 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shop_item_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.shop_items(id) ON DELETE CASCADE,
  audience public.shop_price_audience NOT NULL,
  currency public.shop_price_currency NOT NULL,
  amount_minor INT NOT NULL CHECK (amount_minor >= 0),
  compare_at_minor INT NULL CHECK (compare_at_minor IS NULL OR compare_at_minor >= amount_minor),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS shop_item_prices_unique_active_audience_idx
  ON public.shop_item_prices (item_id, audience)
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.shop_item_unlock_rules (
  item_id UUID PRIMARY KEY REFERENCES public.shop_items(id) ON DELETE CASCADE,
  unlock_type public.shop_unlock_type NOT NULL DEFAULT 'none',
  level_required INT NULL CHECK (level_required IS NULL OR level_required >= 1),
  challenge_id UUID NULL REFERENCES public.challenges(id) ON DELETE SET NULL,
  claim_once BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shop_surface_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surface_key TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  item_id UUID NOT NULL REFERENCES public.shop_items(id) ON DELETE CASCADE,
  card_variant TEXT NOT NULL DEFAULT 'default',
  title_override TEXT NOT NULL DEFAULT '',
  subtitle_override TEXT NOT NULL DEFAULT '',
  cta_label_override TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS shop_surface_slots_unique_surface_order_idx
  ON public.shop_surface_slots (surface_key, sort_order);

CREATE TABLE IF NOT EXISTS public.shop_item_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.shop_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.shop_claim_status NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ NULL,
  resolved_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS shop_item_claims_unique_user_item_idx
  ON public.shop_item_claims (item_id, user_id);

CREATE OR REPLACE FUNCTION public.set_shop_catalog_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_shop_items_updated_at ON public.shop_items;
CREATE TRIGGER set_shop_items_updated_at
BEFORE UPDATE ON public.shop_items
FOR EACH ROW
EXECUTE FUNCTION public.set_shop_catalog_updated_at();

DROP TRIGGER IF EXISTS set_shop_item_prices_updated_at ON public.shop_item_prices;
CREATE TRIGGER set_shop_item_prices_updated_at
BEFORE UPDATE ON public.shop_item_prices
FOR EACH ROW
EXECUTE FUNCTION public.set_shop_catalog_updated_at();

DROP TRIGGER IF EXISTS set_shop_item_unlock_rules_updated_at ON public.shop_item_unlock_rules;
CREATE TRIGGER set_shop_item_unlock_rules_updated_at
BEFORE UPDATE ON public.shop_item_unlock_rules
FOR EACH ROW
EXECUTE FUNCTION public.set_shop_catalog_updated_at();

DROP TRIGGER IF EXISTS set_shop_surface_slots_updated_at ON public.shop_surface_slots;
CREATE TRIGGER set_shop_surface_slots_updated_at
BEFORE UPDATE ON public.shop_surface_slots
FOR EACH ROW
EXECUTE FUNCTION public.set_shop_catalog_updated_at();

DROP TRIGGER IF EXISTS set_shop_item_claims_updated_at ON public.shop_item_claims;
CREATE TRIGGER set_shop_item_claims_updated_at
BEFORE UPDATE ON public.shop_item_claims
FOR EACH ROW
EXECUTE FUNCTION public.set_shop_catalog_updated_at();

ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_item_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_item_unlock_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_surface_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_item_claims ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.shop_items TO anon, authenticated;
GRANT SELECT ON public.shop_item_prices TO anon, authenticated;
GRANT SELECT ON public.shop_item_unlock_rules TO anon, authenticated;
GRANT SELECT ON public.shop_surface_slots TO anon, authenticated;
GRANT SELECT ON public.shop_item_claims TO authenticated;

DROP POLICY IF EXISTS "Anyone can view active shop items" ON public.shop_items;
CREATE POLICY "Anyone can view active shop items"
  ON public.shop_items
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins can manage shop items" ON public.shop_items;
CREATE POLICY "Admins can manage shop items"
  ON public.shop_items
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Anyone can view active shop item prices" ON public.shop_item_prices;
CREATE POLICY "Anyone can view active shop item prices"
  ON public.shop_item_prices
  FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Admins can manage shop item prices" ON public.shop_item_prices;
CREATE POLICY "Admins can manage shop item prices"
  ON public.shop_item_prices
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Anyone can view shop unlock rules" ON public.shop_item_unlock_rules;
CREATE POLICY "Anyone can view shop unlock rules"
  ON public.shop_item_unlock_rules
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage shop unlock rules" ON public.shop_item_unlock_rules;
CREATE POLICY "Admins can manage shop unlock rules"
  ON public.shop_item_unlock_rules
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Anyone can view active shop slots" ON public.shop_surface_slots;
CREATE POLICY "Anyone can view active shop slots"
  ON public.shop_surface_slots
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins can manage shop slots" ON public.shop_surface_slots;
CREATE POLICY "Admins can manage shop slots"
  ON public.shop_surface_slots
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Users can view own shop claims" ON public.shop_item_claims;
CREATE POLICY "Users can view own shop claims"
  ON public.shop_item_claims
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can create own shop claims" ON public.shop_item_claims;
CREATE POLICY "Users can create own shop claims"
  ON public.shop_item_claims
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins can manage shop claims" ON public.shop_item_claims;
CREATE POLICY "Admins can manage shop claims"
  ON public.shop_item_claims
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shop-catalog',
  'shop-catalog',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Shop catalog images are public" ON storage.objects;
CREATE POLICY "Shop catalog images are public"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'shop-catalog');

DROP POLICY IF EXISTS "Admins can upload shop catalog images" ON storage.objects;
CREATE POLICY "Admins can upload shop catalog images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'shop-catalog' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can update shop catalog images" ON storage.objects;
CREATE POLICY "Admins can update shop catalog images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'shop-catalog' AND public.is_admin())
  WITH CHECK (bucket_id = 'shop-catalog' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can delete shop catalog images" ON storage.objects;
CREATE POLICY "Admins can delete shop catalog images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'shop-catalog' AND public.is_admin());

CREATE OR REPLACE FUNCTION public.shop_money_label(
  p_amount_minor INT,
  p_currency public.shop_price_currency
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_currency = 'eur' THEN
    RETURN '€' || REPLACE(to_char(p_amount_minor / 100.0, 'FM999999990.00'), '.', ',');
  END IF;

  RETURN p_amount_minor::TEXT || ' COINS';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_shop_catalog()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_vip BOOLEAN := false;
  v_level INT := 0;
  v_featured JSONB := '[]'::jsonb;
  v_unlock JSONB := '[]'::jsonb;
  v_coin_packs JSONB := '[]'::jsonb;
  v_vip_offer JSONB := NULL;
BEGIN
  IF v_user_id IS NOT NULL THEN
    BEGIN
      SELECT COALESCE((public.check_vip_status(v_user_id)->>'is_vip')::BOOLEAN, false)
      INTO v_is_vip;
    EXCEPTION
      WHEN OTHERS THEN
        v_is_vip := false;
    END;

    BEGIN
      SELECT COALESCE(public.xp_to_level(total_xp), 0)
      INTO v_level
      FROM public.user_xp
      WHERE user_id = v_user_id;
    EXCEPTION
      WHEN OTHERS THEN
        v_level := 0;
    END;
  END IF;

  WITH resolved_slots AS (
    SELECT
      s.id AS slot_id,
      s.surface_key,
      s.sort_order,
      s.card_variant,
      s.title_override,
      s.subtitle_override,
      s.cta_label_override,
      i.id AS item_id,
      i.slug,
      i.kind,
      i.title,
      i.subtitle,
      i.description,
      i.image_path,
      i.cta_label,
      i.action_key,
      i.coin_amount,
      i.vip_duration_days,
      i.metadata,
      u.unlock_type,
      u.level_required,
      u.challenge_id,
      u.claim_once,
      COALESCE(
        (
          SELECT jsonb_build_object(
            'audience', p.audience,
            'currency', p.currency,
            'amount_minor', p.amount_minor,
            'compare_at_minor', p.compare_at_minor,
            'label', public.shop_money_label(p.amount_minor, p.currency)
          )
          FROM public.shop_item_prices p
          WHERE p.item_id = i.id
            AND p.is_active = true
            AND p.audience = CASE WHEN v_is_vip THEN 'vip'::public.shop_price_audience ELSE 'base'::public.shop_price_audience END
          LIMIT 1
        ),
        (
          SELECT jsonb_build_object(
            'audience', p.audience,
            'currency', p.currency,
            'amount_minor', p.amount_minor,
            'compare_at_minor', p.compare_at_minor,
            'label', public.shop_money_label(p.amount_minor, p.currency)
          )
          FROM public.shop_item_prices p
          WHERE p.item_id = i.id
            AND p.is_active = true
            AND p.audience = 'base'::public.shop_price_audience
          LIMIT 1
        )
      ) AS effective_price,
      CASE
        WHEN u.unlock_type = 'level'::public.shop_unlock_type AND COALESCE(u.level_required, 1) > v_level THEN false
        WHEN u.unlock_type = 'challenge'::public.shop_unlock_type AND NOT EXISTS (
          SELECT 1
          FROM public.user_challenge_progress cp
          WHERE cp.user_id = v_user_id
            AND cp.challenge_id = u.challenge_id
            AND cp.is_completed = true
        ) THEN false
        ELSE true
      END AS is_unlocked,
      (
        SELECT jsonb_build_object(
          'id', c.id,
          'status', c.status,
          'requested_at', c.requested_at,
          'resolved_at', c.resolved_at,
          'admin_note', c.admin_note
        )
        FROM public.shop_item_claims c
        WHERE c.item_id = i.id
          AND c.user_id = v_user_id
        LIMIT 1
      ) AS claim_state
    FROM public.shop_surface_slots s
    JOIN public.shop_items i ON i.id = s.item_id
    LEFT JOIN public.shop_item_unlock_rules u ON u.item_id = i.id
    WHERE s.is_active = true
      AND i.is_active = true
      AND s.surface_key IN ('shop.featured_cards', 'shop.unlock_cards')
  )
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'slot_id', slot_id,
        'surface_key', surface_key,
        'sort_order', sort_order,
        'card_variant', card_variant,
        'title', COALESCE(NULLIF(title_override, ''), title),
        'subtitle', COALESCE(NULLIF(subtitle_override, ''), subtitle),
        'cta_label', COALESCE(NULLIF(cta_label_override, ''), cta_label),
        'item', jsonb_build_object(
          'id', item_id,
          'slug', slug,
          'kind', kind,
          'title', title,
          'subtitle', subtitle,
          'description', description,
          'image_path', image_path,
          'cta_label', cta_label,
          'action_key', action_key,
          'coin_amount', coin_amount,
          'vip_duration_days', vip_duration_days,
          'metadata', metadata,
          'effective_price', effective_price,
          'unlock_rule', jsonb_build_object(
            'unlock_type', COALESCE(unlock_type, 'none'::public.shop_unlock_type),
            'level_required', level_required,
            'challenge_id', challenge_id,
            'claim_once', COALESCE(claim_once, true)
          ),
          'is_unlocked', is_unlocked,
          'claim_state', claim_state
        )
      )
      ORDER BY sort_order
    ) FILTER (WHERE surface_key = 'shop.featured_cards'), '[]'::jsonb),
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'slot_id', slot_id,
        'surface_key', surface_key,
        'sort_order', sort_order,
        'card_variant', card_variant,
        'title', COALESCE(NULLIF(title_override, ''), title),
        'subtitle', COALESCE(NULLIF(subtitle_override, ''), subtitle),
        'cta_label', COALESCE(NULLIF(cta_label_override, ''), cta_label),
        'item', jsonb_build_object(
          'id', item_id,
          'slug', slug,
          'kind', kind,
          'title', title,
          'subtitle', subtitle,
          'description', description,
          'image_path', image_path,
          'cta_label', cta_label,
          'action_key', action_key,
          'coin_amount', coin_amount,
          'vip_duration_days', vip_duration_days,
          'metadata', metadata,
          'effective_price', effective_price,
          'unlock_rule', jsonb_build_object(
            'unlock_type', COALESCE(unlock_type, 'none'::public.shop_unlock_type),
            'level_required', level_required,
            'challenge_id', challenge_id,
            'claim_once', COALESCE(claim_once, true)
          ),
          'is_unlocked', is_unlocked,
          'claim_state', claim_state
        )
      )
      ORDER BY sort_order
    ) FILTER (WHERE surface_key = 'shop.unlock_cards'), '[]'::jsonb)
  INTO v_featured, v_unlock
  FROM resolved_slots;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'slug', i.slug,
      'title', i.title,
      'subtitle', i.subtitle,
      'image_path', i.image_path,
      'coin_amount', i.coin_amount,
      'effective_price', (
        SELECT jsonb_build_object(
          'audience', p.audience,
          'currency', p.currency,
          'amount_minor', p.amount_minor,
          'compare_at_minor', p.compare_at_minor,
          'label', public.shop_money_label(p.amount_minor, p.currency)
        )
        FROM public.shop_item_prices p
        WHERE p.item_id = i.id
          AND p.is_active = true
          AND p.audience = 'base'::public.shop_price_audience
        LIMIT 1
      )
    )
    ORDER BY i.coin_amount NULLS LAST, i.title
  ), '[]'::jsonb)
  INTO v_coin_packs
  FROM public.shop_items i
  WHERE i.is_active = true
    AND i.kind = 'coin_pack'::public.shop_item_kind;

  SELECT jsonb_build_object(
    'id', i.id,
    'slug', i.slug,
    'title', i.title,
    'subtitle', i.subtitle,
    'image_path', i.image_path,
    'vip_duration_days', i.vip_duration_days,
    'effective_price', COALESCE(
      (
        SELECT jsonb_build_object(
          'audience', p.audience,
          'currency', p.currency,
          'amount_minor', p.amount_minor,
          'compare_at_minor', p.compare_at_minor,
          'label', public.shop_money_label(p.amount_minor, p.currency)
        )
        FROM public.shop_item_prices p
        WHERE p.item_id = i.id
          AND p.is_active = true
          AND p.audience = CASE WHEN v_is_vip THEN 'vip'::public.shop_price_audience ELSE 'base'::public.shop_price_audience END
        LIMIT 1
      ),
      (
        SELECT jsonb_build_object(
          'audience', p.audience,
          'currency', p.currency,
          'amount_minor', p.amount_minor,
          'compare_at_minor', p.compare_at_minor,
          'label', public.shop_money_label(p.amount_minor, p.currency)
        )
        FROM public.shop_item_prices p
        WHERE p.item_id = i.id
          AND p.is_active = true
          AND p.audience = 'base'::public.shop_price_audience
        LIMIT 1
      )
    )
  )
  INTO v_vip_offer
  FROM public.shop_items i
  WHERE i.is_active = true
    AND i.kind = 'vip_membership'::public.shop_item_kind
  ORDER BY i.created_at ASC
  LIMIT 1;

  RETURN jsonb_build_object(
    'viewer', jsonb_build_object(
      'user_id', v_user_id,
      'is_authenticated', v_user_id IS NOT NULL,
      'is_vip', v_is_vip,
      'level', v_level
    ),
    'featured_cards', COALESCE(v_featured, '[]'::jsonb),
    'unlock_cards', COALESCE(v_unlock, '[]'::jsonb),
    'coin_packs', COALESCE(v_coin_packs, '[]'::jsonb),
    'vip_offer', v_vip_offer
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_shop_item_payload(
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_kind public.shop_item_kind;
  v_unlock_type public.shop_unlock_type;
  v_prices JSONB := COALESCE(p_payload->'prices', '[]'::jsonb);
  v_price JSONB;
  v_base_amount INT := NULL;
  v_vip_amount INT := NULL;
BEGIN
  v_kind := (p_payload->>'kind')::public.shop_item_kind;

  IF COALESCE(trim(p_payload->>'title'), '') = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Title is required');
  END IF;

  IF COALESCE(trim(p_payload->>'slug'), '') = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Slug is required');
  END IF;

  IF COALESCE(trim(p_payload->>'image_path'), '') = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Image path is required');
  END IF;

  FOR v_price IN SELECT * FROM jsonb_array_elements(v_prices)
  LOOP
    IF (v_price->>'audience') = 'base' THEN
      v_base_amount := (v_price->>'amount_minor')::INT;
    ELSIF (v_price->>'audience') = 'vip' THEN
      v_vip_amount := (v_price->>'amount_minor')::INT;
    END IF;
  END LOOP;

  IF v_vip_amount IS NOT NULL AND v_base_amount IS NOT NULL AND v_vip_amount > v_base_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'VIP override cannot exceed base price');
  END IF;

  IF v_kind = 'coin_pack'::public.shop_item_kind THEN
    IF COALESCE((p_payload->>'coin_amount')::INT, 0) < 1 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Coin pack amount is required');
    END IF;
  ELSIF v_kind = 'vip_membership'::public.shop_item_kind THEN
    IF COALESCE((p_payload->>'vip_duration_days')::INT, 0) < 1 THEN
      RETURN jsonb_build_object('success', false, 'error', 'VIP duration is required');
    END IF;
  ELSIF v_kind = 'physical_reward'::public.shop_item_kind THEN
    v_unlock_type := COALESCE((p_payload->'unlock_rule'->>'unlock_type')::public.shop_unlock_type, 'none'::public.shop_unlock_type);
    IF v_unlock_type = 'none'::public.shop_unlock_type THEN
      RETURN jsonb_build_object('success', false, 'error', 'Physical rewards require an unlock rule');
    END IF;
  ELSIF v_kind = 'action_card'::public.shop_item_kind THEN
    IF COALESCE(trim(p_payload->>'action_key'), '') = '' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Action cards require an action key');
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_shop_item(
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_validation JSONB;
  v_item_id UUID;
  v_kind public.shop_item_kind;
  v_unlock_rule JSONB := COALESCE(p_payload->'unlock_rule', '{}'::jsonb);
  v_price JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  v_validation := public.validate_shop_item_payload(p_payload);
  IF COALESCE((v_validation->>'success')::BOOLEAN, false) = false THEN
    RETURN v_validation;
  END IF;

  v_kind := (p_payload->>'kind')::public.shop_item_kind;
  v_item_id := NULLIF(p_payload->>'id', '')::UUID;

  IF v_item_id IS NULL THEN
    INSERT INTO public.shop_items (
      slug,
      kind,
      title,
      subtitle,
      description,
      image_path,
      cta_label,
      is_active,
      action_key,
      coin_amount,
      vip_duration_days,
      metadata
    )
    VALUES (
      trim(p_payload->>'slug'),
      v_kind,
      trim(p_payload->>'title'),
      COALESCE(p_payload->>'subtitle', ''),
      COALESCE(p_payload->>'description', ''),
      trim(p_payload->>'image_path'),
      COALESCE(p_payload->>'cta_label', ''),
      COALESCE((p_payload->>'is_active')::BOOLEAN, true),
      NULLIF(p_payload->>'action_key', ''),
      NULLIF(p_payload->>'coin_amount', '')::INT,
      NULLIF(p_payload->>'vip_duration_days', '')::INT,
      COALESCE(p_payload->'metadata', '{}'::jsonb)
    )
    RETURNING id INTO v_item_id;
  ELSE
    UPDATE public.shop_items
    SET
      slug = trim(p_payload->>'slug'),
      kind = v_kind,
      title = trim(p_payload->>'title'),
      subtitle = COALESCE(p_payload->>'subtitle', ''),
      description = COALESCE(p_payload->>'description', ''),
      image_path = trim(p_payload->>'image_path'),
      cta_label = COALESCE(p_payload->>'cta_label', ''),
      is_active = COALESCE((p_payload->>'is_active')::BOOLEAN, true),
      action_key = NULLIF(p_payload->>'action_key', ''),
      coin_amount = NULLIF(p_payload->>'coin_amount', '')::INT,
      vip_duration_days = NULLIF(p_payload->>'vip_duration_days', '')::INT,
      metadata = COALESCE(p_payload->'metadata', '{}'::jsonb),
      updated_at = now()
    WHERE id = v_item_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Item not found');
    END IF;
  END IF;

  DELETE FROM public.shop_item_prices WHERE item_id = v_item_id;
  FOR v_price IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'prices', '[]'::jsonb))
  LOOP
    INSERT INTO public.shop_item_prices (
      item_id,
      audience,
      currency,
      amount_minor,
      compare_at_minor,
      is_active
    )
    VALUES (
      v_item_id,
      (v_price->>'audience')::public.shop_price_audience,
      (v_price->>'currency')::public.shop_price_currency,
      COALESCE((v_price->>'amount_minor')::INT, 0),
      NULLIF(v_price->>'compare_at_minor', '')::INT,
      COALESCE((v_price->>'is_active')::BOOLEAN, true)
    );
  END LOOP;

  IF v_kind = 'physical_reward'::public.shop_item_kind THEN
    INSERT INTO public.shop_item_unlock_rules (
      item_id,
      unlock_type,
      level_required,
      challenge_id,
      claim_once
    )
    VALUES (
      v_item_id,
      COALESCE((v_unlock_rule->>'unlock_type')::public.shop_unlock_type, 'none'::public.shop_unlock_type),
      NULLIF(v_unlock_rule->>'level_required', '')::INT,
      NULLIF(v_unlock_rule->>'challenge_id', '')::UUID,
      COALESCE((v_unlock_rule->>'claim_once')::BOOLEAN, true)
    )
    ON CONFLICT (item_id) DO UPDATE
    SET
      unlock_type = EXCLUDED.unlock_type,
      level_required = EXCLUDED.level_required,
      challenge_id = EXCLUDED.challenge_id,
      claim_once = EXCLUDED.claim_once,
      updated_at = now();
  ELSE
    DELETE FROM public.shop_item_unlock_rules WHERE item_id = v_item_id;
  END IF;

  PERFORM public.log_admin_action(
    'upsert_shop_item',
    'shop_item',
    v_item_id,
    p_payload
  );

  RETURN jsonb_build_object('success', true, 'id', v_item_id);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Shop item slug already exists');
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_shop_surface_slot(
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot_id UUID := NULLIF(p_payload->>'id', '')::UUID;
  v_surface_key TEXT := COALESCE(p_payload->>'surface_key', '');
  v_item_id UUID := NULLIF(p_payload->>'item_id', '')::UUID;
  v_sort_order INT := COALESCE((p_payload->>'sort_order')::INT, 0);
  v_item_kind public.shop_item_kind;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT kind INTO v_item_kind
  FROM public.shop_items
  WHERE id = v_item_id;

  IF v_item_kind IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Item not found');
  END IF;

  IF v_surface_key = 'shop.unlock_cards' AND v_item_kind <> 'physical_reward'::public.shop_item_kind THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unlock cards only accept physical rewards');
  END IF;

  IF v_surface_key = 'shop.featured_cards' AND v_item_kind = 'physical_reward'::public.shop_item_kind THEN
    RETURN jsonb_build_object('success', false, 'error', 'Featured cards cannot use physical rewards');
  END IF;

  IF v_slot_id IS NULL THEN
    INSERT INTO public.shop_surface_slots (
      surface_key,
      sort_order,
      item_id,
      card_variant,
      title_override,
      subtitle_override,
      cta_label_override,
      is_active
    )
    VALUES (
      v_surface_key,
      v_sort_order,
      v_item_id,
      COALESCE(p_payload->>'card_variant', 'default'),
      COALESCE(p_payload->>'title_override', ''),
      COALESCE(p_payload->>'subtitle_override', ''),
      COALESCE(p_payload->>'cta_label_override', ''),
      COALESCE((p_payload->>'is_active')::BOOLEAN, true)
    )
    RETURNING id INTO v_slot_id;
  ELSE
    UPDATE public.shop_surface_slots
    SET
      surface_key = v_surface_key,
      sort_order = v_sort_order,
      item_id = v_item_id,
      card_variant = COALESCE(p_payload->>'card_variant', 'default'),
      title_override = COALESCE(p_payload->>'title_override', ''),
      subtitle_override = COALESCE(p_payload->>'subtitle_override', ''),
      cta_label_override = COALESCE(p_payload->>'cta_label_override', ''),
      is_active = COALESCE((p_payload->>'is_active')::BOOLEAN, true),
      updated_at = now()
    WHERE id = v_slot_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Slot not found');
    END IF;
  END IF;

  PERFORM public.log_admin_action(
    'upsert_shop_surface_slot',
    'shop_surface_slot',
    v_slot_id,
    p_payload
  );

  RETURN jsonb_build_object('success', true, 'id', v_slot_id);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Another slot already uses that surface order');
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_shop_item_active(
  p_item_id UUID,
  p_is_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  UPDATE public.shop_items
  SET
    is_active = p_is_active,
    updated_at = now()
  WHERE id = p_item_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Item not found');
  END IF;

  PERFORM public.log_admin_action(
    'set_shop_item_active',
    'shop_item',
    p_item_id,
    jsonb_build_object('is_active', p_is_active)
  );

  RETURN jsonb_build_object('success', true, 'id', p_item_id, 'is_active', p_is_active);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_shop_reward(
  p_item_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_item public.shop_items%ROWTYPE;
  v_unlock public.shop_item_unlock_rules%ROWTYPE;
  v_level INT := 0;
  v_existing_claim public.shop_item_claims%ROWTYPE;
  v_completed BOOLEAN := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_item
  FROM public.shop_items
  WHERE id = p_item_id
    AND is_active = true;

  IF v_item.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reward not found');
  END IF;

  IF v_item.kind <> 'physical_reward'::public.shop_item_kind THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only physical rewards can be claimed');
  END IF;

  SELECT * INTO v_unlock
  FROM public.shop_item_unlock_rules
  WHERE item_id = p_item_id;

  IF v_unlock.item_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reward unlock rule not configured');
  END IF;

  IF v_unlock.unlock_type = 'level'::public.shop_unlock_type THEN
    SELECT COALESCE(public.xp_to_level(total_xp), 0)
    INTO v_level
    FROM public.user_xp
    WHERE user_id = v_user_id;

    IF COALESCE(v_level, 0) < COALESCE(v_unlock.level_required, 1) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Reward still locked by level');
    END IF;
  ELSIF v_unlock.unlock_type = 'challenge'::public.shop_unlock_type THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_challenge_progress
      WHERE user_id = v_user_id
        AND challenge_id = v_unlock.challenge_id
        AND is_completed = true
    )
    INTO v_completed;

    IF NOT v_completed THEN
      RETURN jsonb_build_object('success', false, 'error', 'Reward still locked by challenge');
    END IF;
  END IF;

  SELECT * INTO v_existing_claim
  FROM public.shop_item_claims
  WHERE item_id = p_item_id
    AND user_id = v_user_id;

  IF v_existing_claim.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Reward already claimed',
      'claim_id', v_existing_claim.id,
      'status', v_existing_claim.status
    );
  END IF;

  INSERT INTO public.shop_item_claims (
    item_id,
    user_id,
    status
  )
  VALUES (
    p_item_id,
    v_user_id,
    'pending'::public.shop_claim_status
  )
  RETURNING * INTO v_existing_claim;

  RETURN jsonb_build_object(
    'success', true,
    'claim_id', v_existing_claim.id,
    'status', v_existing_claim.status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_shop_claim(
  p_claim_id UUID,
  p_status TEXT,
  p_admin_note TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status public.shop_claim_status;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  v_status := p_status::public.shop_claim_status;

  UPDATE public.shop_item_claims
  SET
    status = v_status,
    admin_note = COALESCE(p_admin_note, ''),
    resolved_at = CASE
      WHEN v_status IN ('approved'::public.shop_claim_status, 'fulfilled'::public.shop_claim_status, 'rejected'::public.shop_claim_status, 'cancelled'::public.shop_claim_status)
      THEN now()
      ELSE NULL
    END,
    resolved_by = auth.uid(),
    updated_at = now()
  WHERE id = p_claim_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Claim not found');
  END IF;

  PERFORM public.log_admin_action(
    'update_shop_claim',
    'shop_item_claim',
    p_claim_id,
    jsonb_build_object('status', v_status, 'admin_note', COALESCE(p_admin_note, ''))
  );

  RETURN jsonb_build_object('success', true, 'id', p_claim_id, 'status', v_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.purchase_shop_wallet_item(
  p_item_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_wallet public.wallets%ROWTYPE;
  v_item public.shop_items%ROWTYPE;
  v_price public.shop_item_prices%ROWTYPE;
  v_is_vip BOOLEAN := false;
  v_vip_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_item
  FROM public.shop_items
  WHERE id = p_item_id
    AND is_active = true;

  IF v_item.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Shop item not found');
  END IF;

  IF v_item.kind NOT IN ('vip_membership'::public.shop_item_kind) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Item is not purchasable with wallet coins');
  END IF;

  SELECT COALESCE((public.check_vip_status(v_user_id)->>'is_vip')::BOOLEAN, false)
  INTO v_is_vip;

  SELECT *
  INTO v_price
  FROM public.shop_item_prices
  WHERE item_id = v_item.id
    AND is_active = true
    AND currency = 'coins'::public.shop_price_currency
    AND audience = CASE
      WHEN v_is_vip THEN 'vip'::public.shop_price_audience
      ELSE 'base'::public.shop_price_audience
    END
  LIMIT 1;

  IF v_price.id IS NULL THEN
    SELECT *
    INTO v_price
    FROM public.shop_item_prices
    WHERE item_id = v_item.id
      AND is_active = true
      AND currency = 'coins'::public.shop_price_currency
      AND audience = 'base'::public.shop_price_audience
    LIMIT 1;
  END IF;

  IF v_price.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet price not configured');
  END IF;

  IF v_item.kind = 'vip_membership'::public.shop_item_kind THEN
    IF v_price.amount_minor <> 5 THEN
      RETURN jsonb_build_object('success', false, 'error', 'VIP wallet price must remain 5 coins while legacy VIP purchase is active');
    END IF;

    v_vip_result := public.purchase_vip();
    RETURN v_vip_result;
  END IF;

  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF v_wallet.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  IF v_wallet.balance < v_price.amount_minor THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'Unsupported wallet item');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shop_catalog() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_shop_item(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_shop_surface_slot(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_shop_item_active(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_shop_reward(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_shop_claim(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_shop_wallet_item(UUID) TO authenticated;

INSERT INTO public.shop_items (
  slug,
  kind,
  title,
  subtitle,
  description,
  image_path,
  cta_label,
  is_active,
  coin_amount,
  vip_duration_days,
  metadata
)
VALUES
  ('coin-pack-3', 'coin_pack', '3 COINS', 'STARTER', 'Starter coin pack', '/coin.png', 'BUY NOW', true, 3, NULL, '{"badge":"x3"}'::jsonb),
  ('coin-pack-5', 'coin_pack', '5 COINS', 'BOOST', 'Everyday coin pack', '/coin.png', 'BUY NOW', true, 5, NULL, '{"badge":"x5"}'::jsonb),
  ('coin-pack-10', 'coin_pack', '10 COINS', 'MOST WANTED', 'Popular coin pack', '/coin.png', 'BUY NOW', true, 10, NULL, '{"badge":"x10"}'::jsonb),
  ('coin-pack-15', 'coin_pack', '15 COINS', 'CLIMBER', 'Large coin pack', '/coin.png', 'BUY NOW', true, 15, NULL, '{"badge":"x15"}'::jsonb),
  ('coin-pack-25', 'coin_pack', '25 COINS', 'BEST SELLER', 'Best seller coin pack', '/coin.png', 'BUY NOW', true, 25, NULL, '{"badge":"x25"}'::jsonb),
  ('coin-pack-50', 'coin_pack', '50 COINS', 'ULTRA', 'Ultra coin pack', '/coin.png', 'BUY NOW', true, 50, NULL, '{"badge":"x50"}'::jsonb),
  ('vip-membership-30d', 'vip_membership', 'VIP', '1 MONTH', 'VIP membership for 30 days', '/showreel/vip-icon.svg', 'GET VIP', true, NULL, 30, '{"benefits":["Real rewards","Giveaways","Less levels, more prizes"]}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.shop_item_prices (item_id, audience, currency, amount_minor, compare_at_minor, is_active)
SELECT id, 'base', 'eur', coin_amount * 100, NULL, true
FROM public.shop_items
WHERE kind = 'coin_pack'::public.shop_item_kind
ON CONFLICT DO NOTHING;

INSERT INTO public.shop_item_prices (item_id, audience, currency, amount_minor, compare_at_minor, is_active)
SELECT id, 'base', 'coins', 5, NULL, true
FROM public.shop_items
WHERE slug = 'vip-membership-30d'
ON CONFLICT DO NOTHING;

INSERT INTO public.shop_surface_slots (surface_key, sort_order, item_id, card_variant, title_override, subtitle_override, cta_label_override, is_active)
SELECT 'shop.featured_cards', ROW_NUMBER() OVER (ORDER BY created_at) - 1, id, 'coins', '', '', '', true
FROM public.shop_items
WHERE slug IN ('coin-pack-3', 'coin-pack-5', 'coin-pack-10', 'coin-pack-15', 'coin-pack-25')
ON CONFLICT DO NOTHING;

INSERT INTO public.shop_items (
  slug,
  kind,
  title,
  subtitle,
  description,
  image_path,
  cta_label,
  is_active,
  metadata
)
SELECT
  'legacy-reward-' || replace(lower(name), ' ', '-'),
  'physical_reward',
  name,
  'LEVEL REWARD',
  description,
  image_path,
  'CLAIM',
  is_active,
  '{}'::jsonb
FROM public.shop_level_rewards
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.shop_item_unlock_rules (item_id, unlock_type, level_required, challenge_id, claim_once)
SELECT
  i.id,
  'level',
  r.level_required,
  NULL,
  true
FROM public.shop_level_rewards r
JOIN public.shop_items i
  ON i.slug = 'legacy-reward-' || replace(lower(r.name), ' ', '-')
ON CONFLICT (item_id) DO NOTHING;

INSERT INTO public.shop_surface_slots (surface_key, sort_order, item_id, card_variant, title_override, subtitle_override, cta_label_override, is_active)
SELECT
  'shop.unlock_cards',
  ROW_NUMBER() OVER (ORDER BY r.level_required) - 1,
  i.id,
  'reward',
  '',
  '',
  '',
  r.is_active
FROM public.shop_level_rewards r
JOIN public.shop_items i
  ON i.slug = 'legacy-reward-' || replace(lower(r.name), ' ', '-')
ON CONFLICT DO NOTHING;

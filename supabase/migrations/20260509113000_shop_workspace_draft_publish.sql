DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shop_workspace') THEN
    CREATE TYPE public.shop_workspace AS ENUM ('draft', 'live');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.shop_draft_items (
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

CREATE TABLE IF NOT EXISTS public.shop_draft_item_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.shop_draft_items(id) ON DELETE CASCADE,
  audience public.shop_price_audience NOT NULL,
  currency public.shop_price_currency NOT NULL,
  amount_minor INT NOT NULL CHECK (amount_minor >= 0),
  compare_at_minor INT NULL CHECK (compare_at_minor IS NULL OR compare_at_minor >= amount_minor),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS shop_draft_item_prices_unique_active_audience_idx
  ON public.shop_draft_item_prices (item_id, audience)
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.shop_draft_item_unlock_rules (
  item_id UUID PRIMARY KEY REFERENCES public.shop_draft_items(id) ON DELETE CASCADE,
  unlock_type public.shop_unlock_type NOT NULL DEFAULT 'none',
  level_required INT NULL CHECK (level_required IS NULL OR level_required >= 1),
  challenge_id UUID NULL REFERENCES public.challenges(id) ON DELETE SET NULL,
  claim_once BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shop_draft_surface_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surface_key TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  item_id UUID NOT NULL REFERENCES public.shop_draft_items(id) ON DELETE CASCADE,
  card_variant TEXT NOT NULL DEFAULT 'default',
  title_override TEXT NOT NULL DEFAULT '',
  subtitle_override TEXT NOT NULL DEFAULT '',
  cta_label_override TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS shop_draft_surface_slots_unique_surface_order_idx
  ON public.shop_draft_surface_slots (surface_key, sort_order);

CREATE TABLE IF NOT EXISTS public.shop_slot_presentations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL,
  workspace public.shop_workspace NOT NULL,
  template_key TEXT NOT NULL DEFAULT 'featured-card',
  theme_key TEXT NOT NULL DEFAULT 'default',
  eyebrow_text TEXT NOT NULL DEFAULT '',
  supporting_text TEXT NOT NULL DEFAULT '',
  primary_image_path TEXT NOT NULL DEFAULT '',
  secondary_image_path TEXT NOT NULL DEFAULT '',
  show_badge BOOLEAN NOT NULL DEFAULT true,
  show_subtitle BOOLEAN NOT NULL DEFAULT true,
  show_supporting_text BOOLEAN NOT NULL DEFAULT false,
  show_secondary_image BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shop_slot_presentations_workspace_slot_unique UNIQUE (workspace, slot_id)
);

DROP TRIGGER IF EXISTS set_shop_draft_items_updated_at ON public.shop_draft_items;
CREATE TRIGGER set_shop_draft_items_updated_at
BEFORE UPDATE ON public.shop_draft_items
FOR EACH ROW
EXECUTE FUNCTION public.set_shop_catalog_updated_at();

DROP TRIGGER IF EXISTS set_shop_draft_item_prices_updated_at ON public.shop_draft_item_prices;
CREATE TRIGGER set_shop_draft_item_prices_updated_at
BEFORE UPDATE ON public.shop_draft_item_prices
FOR EACH ROW
EXECUTE FUNCTION public.set_shop_catalog_updated_at();

DROP TRIGGER IF EXISTS set_shop_draft_item_unlock_rules_updated_at ON public.shop_draft_item_unlock_rules;
CREATE TRIGGER set_shop_draft_item_unlock_rules_updated_at
BEFORE UPDATE ON public.shop_draft_item_unlock_rules
FOR EACH ROW
EXECUTE FUNCTION public.set_shop_catalog_updated_at();

DROP TRIGGER IF EXISTS set_shop_draft_surface_slots_updated_at ON public.shop_draft_surface_slots;
CREATE TRIGGER set_shop_draft_surface_slots_updated_at
BEFORE UPDATE ON public.shop_draft_surface_slots
FOR EACH ROW
EXECUTE FUNCTION public.set_shop_catalog_updated_at();

DROP TRIGGER IF EXISTS set_shop_slot_presentations_updated_at ON public.shop_slot_presentations;
CREATE TRIGGER set_shop_slot_presentations_updated_at
BEFORE UPDATE ON public.shop_slot_presentations
FOR EACH ROW
EXECUTE FUNCTION public.set_shop_catalog_updated_at();

ALTER TABLE public.shop_draft_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_draft_item_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_draft_item_unlock_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_draft_surface_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_slot_presentations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage draft shop items" ON public.shop_draft_items;
CREATE POLICY "Admins can manage draft shop items"
  ON public.shop_draft_items
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage draft shop item prices" ON public.shop_draft_item_prices;
CREATE POLICY "Admins can manage draft shop item prices"
  ON public.shop_draft_item_prices
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage draft shop unlock rules" ON public.shop_draft_item_unlock_rules;
CREATE POLICY "Admins can manage draft shop unlock rules"
  ON public.shop_draft_item_unlock_rules
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage draft shop slots" ON public.shop_draft_surface_slots;
CREATE POLICY "Admins can manage draft shop slots"
  ON public.shop_draft_surface_slots
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage slot presentations" ON public.shop_slot_presentations;
CREATE POLICY "Admins can manage slot presentations"
  ON public.shop_slot_presentations
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public can read live slot presentations" ON public.shop_slot_presentations;
CREATE POLICY "Public can read live slot presentations"
  ON public.shop_slot_presentations
  FOR SELECT
  TO anon, authenticated
  USING (workspace = 'live'::public.shop_workspace OR public.is_admin());

GRANT SELECT ON public.shop_slot_presentations TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.default_shop_template_for_surface(
  p_surface_key TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_surface_key = 'shop.unlock_cards' THEN
    RETURN 'unlock-card';
  END IF;

  RETURN 'featured-card';
END;
$$;

CREATE OR REPLACE FUNCTION public.default_shop_badge_for_kind(
  p_kind public.shop_item_kind
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  CASE p_kind
    WHEN 'coin_pack'::public.shop_item_kind THEN RETURN 'COINS';
    WHEN 'vip_membership'::public.shop_item_kind THEN RETURN 'VIP';
    WHEN 'physical_reward'::public.shop_item_kind THEN RETURN 'UNLOCK';
    WHEN 'physical_product'::public.shop_item_kind THEN RETURN 'MERCH';
    WHEN 'action_card'::public.shop_item_kind THEN RETURN 'ACTION';
    ELSE RETURN 'SHOP';
  END CASE;
END;
$$;

INSERT INTO public.shop_draft_items (
  id,
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
  metadata,
  created_at,
  updated_at
)
SELECT
  id,
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
  metadata,
  created_at,
  updated_at
FROM public.shop_items
ON CONFLICT (id) DO UPDATE
SET
  slug = EXCLUDED.slug,
  kind = EXCLUDED.kind,
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  image_path = EXCLUDED.image_path,
  cta_label = EXCLUDED.cta_label,
  is_active = EXCLUDED.is_active,
  action_key = EXCLUDED.action_key,
  coin_amount = EXCLUDED.coin_amount,
  vip_duration_days = EXCLUDED.vip_duration_days,
  metadata = EXCLUDED.metadata,
  updated_at = now();

INSERT INTO public.shop_draft_item_prices (
  id,
  item_id,
  audience,
  currency,
  amount_minor,
  compare_at_minor,
  is_active,
  created_at,
  updated_at
)
SELECT
  id,
  item_id,
  audience,
  currency,
  amount_minor,
  compare_at_minor,
  is_active,
  created_at,
  updated_at
FROM public.shop_item_prices
ON CONFLICT (id) DO UPDATE
SET
  item_id = EXCLUDED.item_id,
  audience = EXCLUDED.audience,
  currency = EXCLUDED.currency,
  amount_minor = EXCLUDED.amount_minor,
  compare_at_minor = EXCLUDED.compare_at_minor,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO public.shop_draft_item_unlock_rules (
  item_id,
  unlock_type,
  level_required,
  challenge_id,
  claim_once,
  created_at,
  updated_at
)
SELECT
  item_id,
  unlock_type,
  level_required,
  challenge_id,
  claim_once,
  created_at,
  updated_at
FROM public.shop_item_unlock_rules
ON CONFLICT (item_id) DO UPDATE
SET
  unlock_type = EXCLUDED.unlock_type,
  level_required = EXCLUDED.level_required,
  challenge_id = EXCLUDED.challenge_id,
  claim_once = EXCLUDED.claim_once,
  updated_at = now();

INSERT INTO public.shop_draft_surface_slots (
  id,
  surface_key,
  sort_order,
  item_id,
  card_variant,
  title_override,
  subtitle_override,
  cta_label_override,
  is_active,
  created_at,
  updated_at
)
SELECT
  id,
  surface_key,
  sort_order,
  item_id,
  card_variant,
  title_override,
  subtitle_override,
  cta_label_override,
  is_active,
  created_at,
  updated_at
FROM public.shop_surface_slots
ON CONFLICT (id) DO UPDATE
SET
  surface_key = EXCLUDED.surface_key,
  sort_order = EXCLUDED.sort_order,
  item_id = EXCLUDED.item_id,
  card_variant = EXCLUDED.card_variant,
  title_override = EXCLUDED.title_override,
  subtitle_override = EXCLUDED.subtitle_override,
  cta_label_override = EXCLUDED.cta_label_override,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO public.shop_slot_presentations (
  slot_id,
  workspace,
  template_key,
  theme_key,
  eyebrow_text,
  supporting_text,
  primary_image_path,
  secondary_image_path,
  show_badge,
  show_subtitle,
  show_supporting_text,
  show_secondary_image,
  metadata
)
SELECT
  s.id,
  'live'::public.shop_workspace,
  public.default_shop_template_for_surface(s.surface_key),
  'default',
  public.default_shop_badge_for_kind(i.kind),
  '',
  i.image_path,
  '',
  true,
  true,
  s.surface_key = 'shop.unlock_cards',
  false,
  '{}'::jsonb
FROM public.shop_surface_slots s
JOIN public.shop_items i ON i.id = s.item_id
ON CONFLICT (workspace, slot_id) DO NOTHING;

INSERT INTO public.shop_slot_presentations (
  slot_id,
  workspace,
  template_key,
  theme_key,
  eyebrow_text,
  supporting_text,
  primary_image_path,
  secondary_image_path,
  show_badge,
  show_subtitle,
  show_supporting_text,
  show_secondary_image,
  metadata
)
SELECT
  slot_id,
  'draft'::public.shop_workspace,
  template_key,
  theme_key,
  eyebrow_text,
  supporting_text,
  primary_image_path,
  secondary_image_path,
  show_badge,
  show_subtitle,
  show_supporting_text,
  show_secondary_image,
  metadata
FROM public.shop_slot_presentations
WHERE workspace = 'live'::public.shop_workspace
ON CONFLICT (workspace, slot_id) DO NOTHING;

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
      pres.template_key,
      pres.theme_key,
      pres.eyebrow_text,
      pres.supporting_text,
      pres.primary_image_path,
      pres.secondary_image_path,
      pres.show_badge,
      pres.show_subtitle,
      pres.show_supporting_text,
      pres.show_secondary_image,
      pres.metadata AS presentation_metadata,
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
    LEFT JOIN public.shop_slot_presentations pres
      ON pres.slot_id = s.id
      AND pres.workspace = 'live'::public.shop_workspace
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
        'presentation', jsonb_build_object(
          'template_key', COALESCE(template_key, public.default_shop_template_for_surface(surface_key)),
          'theme_key', COALESCE(theme_key, 'default'),
          'eyebrow_text', COALESCE(eyebrow_text, public.default_shop_badge_for_kind(kind)),
          'supporting_text', COALESCE(supporting_text, ''),
          'primary_image_path', COALESCE(NULLIF(primary_image_path, ''), image_path),
          'secondary_image_path', COALESCE(secondary_image_path, ''),
          'show_badge', COALESCE(show_badge, true),
          'show_subtitle', COALESCE(show_subtitle, true),
          'show_supporting_text', COALESCE(show_supporting_text, false),
          'show_secondary_image', COALESCE(show_secondary_image, false),
          'metadata', COALESCE(presentation_metadata, '{}'::jsonb)
        ),
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
        'presentation', jsonb_build_object(
          'template_key', COALESCE(template_key, public.default_shop_template_for_surface(surface_key)),
          'theme_key', COALESCE(theme_key, 'default'),
          'eyebrow_text', COALESCE(eyebrow_text, public.default_shop_badge_for_kind(kind)),
          'supporting_text', COALESCE(supporting_text, ''),
          'primary_image_path', COALESCE(NULLIF(primary_image_path, ''), image_path),
          'secondary_image_path', COALESCE(secondary_image_path, ''),
          'show_badge', COALESCE(show_badge, true),
          'show_subtitle', COALESCE(show_subtitle, true),
          'show_supporting_text', COALESCE(show_supporting_text, false),
          'show_secondary_image', COALESCE(show_secondary_image, false),
          'metadata', COALESCE(presentation_metadata, '{}'::jsonb)
        ),
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

CREATE OR REPLACE FUNCTION public.admin_get_shop_workspace(
  p_workspace TEXT DEFAULT 'draft'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace TEXT := CASE WHEN p_workspace = 'live' THEN 'live' ELSE 'draft' END;
  v_items JSONB := '[]'::jsonb;
  v_slots JSONB := '[]'::jsonb;
  v_presentations JSONB := '[]'::jsonb;
  v_challenges JSONB := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF v_workspace = 'live' THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'slug', i.slug,
        'kind', i.kind,
        'title', i.title,
        'subtitle', i.subtitle,
        'description', i.description,
        'image_path', i.image_path,
        'cta_label', i.cta_label,
        'is_active', i.is_active,
        'action_key', i.action_key,
        'coin_amount', i.coin_amount,
        'vip_duration_days', i.vip_duration_days,
        'metadata', i.metadata,
        'created_at', i.created_at,
        'updated_at', i.updated_at,
        'prices', COALESCE((
          SELECT jsonb_agg(to_jsonb(p) ORDER BY p.created_at ASC)
          FROM public.shop_item_prices p
          WHERE p.item_id = i.id
        ), '[]'::jsonb),
        'unlockRule', (
          SELECT to_jsonb(u)
          FROM public.shop_item_unlock_rules u
          WHERE u.item_id = i.id
        )
      )
      ORDER BY i.created_at ASC, i.slug ASC
    ), '[]'::jsonb)
    INTO v_items
    FROM public.shop_items i;

    SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.surface_key ASC, s.sort_order ASC), '[]'::jsonb)
    INTO v_slots
    FROM public.shop_surface_slots s;
  ELSE
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'slug', i.slug,
        'kind', i.kind,
        'title', i.title,
        'subtitle', i.subtitle,
        'description', i.description,
        'image_path', i.image_path,
        'cta_label', i.cta_label,
        'is_active', i.is_active,
        'action_key', i.action_key,
        'coin_amount', i.coin_amount,
        'vip_duration_days', i.vip_duration_days,
        'metadata', i.metadata,
        'created_at', i.created_at,
        'updated_at', i.updated_at,
        'prices', COALESCE((
          SELECT jsonb_agg(to_jsonb(p) ORDER BY p.created_at ASC)
          FROM public.shop_draft_item_prices p
          WHERE p.item_id = i.id
        ), '[]'::jsonb),
        'unlockRule', (
          SELECT to_jsonb(u)
          FROM public.shop_draft_item_unlock_rules u
          WHERE u.item_id = i.id
        )
      )
      ORDER BY i.created_at ASC, i.slug ASC
    ), '[]'::jsonb)
    INTO v_items
    FROM public.shop_draft_items i;

    SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.surface_key ASC, s.sort_order ASC), '[]'::jsonb)
    INTO v_slots
    FROM public.shop_draft_surface_slots s;
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.workspace ASC, p.created_at ASC), '[]'::jsonb)
  INTO v_presentations
  FROM public.shop_slot_presentations p
  WHERE p.workspace = v_workspace::public.shop_workspace;

  SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.type ASC, c.created_at ASC), '[]'::jsonb)
  INTO v_challenges
  FROM public.challenges c;

  RETURN jsonb_build_object(
    'success', true,
    'workspace', v_workspace,
    'items', v_items,
    'slots', v_slots,
    'presentations', v_presentations,
    'challenges', v_challenges
  );
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
    INSERT INTO public.shop_draft_items (
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
    UPDATE public.shop_draft_items
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
      RETURN jsonb_build_object('success', false, 'error', 'Draft item not found');
    END IF;
  END IF;

  DELETE FROM public.shop_draft_item_prices WHERE item_id = v_item_id;
  FOR v_price IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'prices', '[]'::jsonb))
  LOOP
    INSERT INTO public.shop_draft_item_prices (
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
    INSERT INTO public.shop_draft_item_unlock_rules (
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
    DELETE FROM public.shop_draft_item_unlock_rules WHERE item_id = v_item_id;
  END IF;

  PERFORM public.log_admin_action(
    'upsert_shop_item_draft',
    'shop_item',
    v_item_id,
    p_payload
  );

  RETURN jsonb_build_object('success', true, 'id', v_item_id);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Shop draft item slug already exists');
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
  v_item public.shop_draft_items%ROWTYPE;
  v_presentation JSONB := p_payload->'presentation';
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO v_item
  FROM public.shop_draft_items
  WHERE id = v_item_id;

  IF v_item.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Draft item not found');
  END IF;

  IF v_surface_key = 'shop.unlock_cards' AND v_item.kind <> 'physical_reward'::public.shop_item_kind THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unlock cards only accept physical rewards');
  END IF;

  IF v_surface_key = 'shop.featured_cards' AND v_item.kind = 'physical_reward'::public.shop_item_kind THEN
    RETURN jsonb_build_object('success', false, 'error', 'Featured cards cannot use physical rewards');
  END IF;

  IF v_slot_id IS NULL THEN
    INSERT INTO public.shop_draft_surface_slots (
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
    UPDATE public.shop_draft_surface_slots
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
      RETURN jsonb_build_object('success', false, 'error', 'Draft slot not found');
    END IF;
  END IF;

  IF v_presentation IS NOT NULL THEN
    INSERT INTO public.shop_slot_presentations (
      slot_id,
      workspace,
      template_key,
      theme_key,
      eyebrow_text,
      supporting_text,
      primary_image_path,
      secondary_image_path,
      show_badge,
      show_subtitle,
      show_supporting_text,
      show_secondary_image,
      metadata
    )
    VALUES (
      v_slot_id,
      'draft'::public.shop_workspace,
      COALESCE(v_presentation->>'template_key', public.default_shop_template_for_surface(v_surface_key)),
      COALESCE(v_presentation->>'theme_key', 'default'),
      COALESCE(v_presentation->>'eyebrow_text', public.default_shop_badge_for_kind(v_item.kind)),
      COALESCE(v_presentation->>'supporting_text', ''),
      COALESCE(NULLIF(v_presentation->>'primary_image_path', ''), v_item.image_path),
      COALESCE(v_presentation->>'secondary_image_path', ''),
      COALESCE((v_presentation->>'show_badge')::BOOLEAN, true),
      COALESCE((v_presentation->>'show_subtitle')::BOOLEAN, true),
      COALESCE((v_presentation->>'show_supporting_text')::BOOLEAN, v_surface_key = 'shop.unlock_cards'),
      COALESCE((v_presentation->>'show_secondary_image')::BOOLEAN, false),
      COALESCE(v_presentation->'metadata', '{}'::jsonb)
    )
    ON CONFLICT (workspace, slot_id) DO UPDATE
    SET
      template_key = EXCLUDED.template_key,
      theme_key = EXCLUDED.theme_key,
      eyebrow_text = EXCLUDED.eyebrow_text,
      supporting_text = EXCLUDED.supporting_text,
      primary_image_path = EXCLUDED.primary_image_path,
      secondary_image_path = EXCLUDED.secondary_image_path,
      show_badge = EXCLUDED.show_badge,
      show_subtitle = EXCLUDED.show_subtitle,
      show_supporting_text = EXCLUDED.show_supporting_text,
      show_secondary_image = EXCLUDED.show_secondary_image,
      metadata = EXCLUDED.metadata,
      updated_at = now();
  ELSE
    INSERT INTO public.shop_slot_presentations (
      slot_id,
      workspace,
      template_key,
      theme_key,
      eyebrow_text,
      supporting_text,
      primary_image_path,
      secondary_image_path,
      show_badge,
      show_subtitle,
      show_supporting_text,
      show_secondary_image,
      metadata
    )
    VALUES (
      v_slot_id,
      'draft'::public.shop_workspace,
      public.default_shop_template_for_surface(v_surface_key),
      'default',
      public.default_shop_badge_for_kind(v_item.kind),
      '',
      v_item.image_path,
      '',
      true,
      true,
      v_surface_key = 'shop.unlock_cards',
      false,
      '{}'::jsonb
    )
    ON CONFLICT (workspace, slot_id) DO NOTHING;
  END IF;

  PERFORM public.log_admin_action(
    'upsert_shop_surface_slot_draft',
    'shop_surface_slot',
    v_slot_id,
    p_payload
  );

  RETURN jsonb_build_object('success', true, 'id', v_slot_id);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Another draft slot already uses that surface order');
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

  UPDATE public.shop_draft_items
  SET
    is_active = p_is_active,
    updated_at = now()
  WHERE id = p_item_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Draft item not found');
  END IF;

  PERFORM public.log_admin_action(
    'set_shop_item_active_draft',
    'shop_item',
    p_item_id,
    jsonb_build_object('is_active', p_is_active)
  );

  RETURN jsonb_build_object('success', true, 'id', p_item_id, 'is_active', p_is_active);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_publish_shop_catalog()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invalid_slot RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT s.id, s.surface_key, i.kind
  INTO v_invalid_slot
  FROM public.shop_draft_surface_slots s
  JOIN public.shop_draft_items i ON i.id = s.item_id
  WHERE (s.surface_key = 'shop.unlock_cards' AND i.kind <> 'physical_reward'::public.shop_item_kind)
     OR (s.surface_key = 'shop.featured_cards' AND i.kind = 'physical_reward'::public.shop_item_kind)
  LIMIT 1;

  IF v_invalid_slot.id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Draft shop contains an invalid surface assignment');
  END IF;

  INSERT INTO public.shop_items (
    id,
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
    metadata,
    created_at,
    updated_at
  )
  SELECT
    id,
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
    metadata,
    created_at,
    now()
  FROM public.shop_draft_items
  ON CONFLICT (id) DO UPDATE
  SET
    slug = EXCLUDED.slug,
    kind = EXCLUDED.kind,
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    description = EXCLUDED.description,
    image_path = EXCLUDED.image_path,
    cta_label = EXCLUDED.cta_label,
    is_active = EXCLUDED.is_active,
    action_key = EXCLUDED.action_key,
    coin_amount = EXCLUDED.coin_amount,
    vip_duration_days = EXCLUDED.vip_duration_days,
    metadata = EXCLUDED.metadata,
    updated_at = now();

  UPDATE public.shop_items
  SET
    is_active = false,
    updated_at = now()
  WHERE id NOT IN (SELECT id FROM public.shop_draft_items);

  DELETE FROM public.shop_item_prices;
  INSERT INTO public.shop_item_prices (
    id,
    item_id,
    audience,
    currency,
    amount_minor,
    compare_at_minor,
    is_active,
    created_at,
    updated_at
  )
  SELECT
    id,
    item_id,
    audience,
    currency,
    amount_minor,
    compare_at_minor,
    is_active,
    created_at,
    now()
  FROM public.shop_draft_item_prices;

  DELETE FROM public.shop_item_unlock_rules;
  INSERT INTO public.shop_item_unlock_rules (
    item_id,
    unlock_type,
    level_required,
    challenge_id,
    claim_once,
    created_at,
    updated_at
  )
  SELECT
    item_id,
    unlock_type,
    level_required,
    challenge_id,
    claim_once,
    created_at,
    now()
  FROM public.shop_draft_item_unlock_rules;

  DELETE FROM public.shop_surface_slots;
  INSERT INTO public.shop_surface_slots (
    id,
    surface_key,
    sort_order,
    item_id,
    card_variant,
    title_override,
    subtitle_override,
    cta_label_override,
    is_active,
    created_at,
    updated_at
  )
  SELECT
    id,
    surface_key,
    sort_order,
    item_id,
    card_variant,
    title_override,
    subtitle_override,
    cta_label_override,
    is_active,
    created_at,
    now()
  FROM public.shop_draft_surface_slots;

  DELETE FROM public.shop_slot_presentations
  WHERE workspace = 'live'::public.shop_workspace;

  INSERT INTO public.shop_slot_presentations (
    slot_id,
    workspace,
    template_key,
    theme_key,
    eyebrow_text,
    supporting_text,
    primary_image_path,
    secondary_image_path,
    show_badge,
    show_subtitle,
    show_supporting_text,
    show_secondary_image,
    metadata,
    created_at,
    updated_at
  )
  SELECT
    slot_id,
    'live'::public.shop_workspace,
    template_key,
    theme_key,
    eyebrow_text,
    supporting_text,
    primary_image_path,
    secondary_image_path,
    show_badge,
    show_subtitle,
    show_supporting_text,
    show_secondary_image,
    metadata,
    created_at,
    now()
  FROM public.shop_slot_presentations
  WHERE workspace = 'draft'::public.shop_workspace;

  PERFORM public.log_admin_action(
    'publish_shop_catalog',
    'shop_catalog',
    NULL,
    jsonb_build_object('source_workspace', 'draft', 'target_workspace', 'live')
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_shop_workspace(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_publish_shop_catalog() TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'shop_slot_presentations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_slot_presentations;
  END IF;
END $$;

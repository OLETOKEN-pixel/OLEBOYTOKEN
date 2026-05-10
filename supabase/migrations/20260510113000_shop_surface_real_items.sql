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

  IF v_surface_key = 'shop.unlock_cards'
     AND v_item.kind NOT IN ('physical_reward'::public.shop_item_kind, 'physical_product'::public.shop_item_kind) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unlock cards only accept physical products or rewards');
  END IF;

  IF v_surface_key = 'shop.featured_cards'
     AND v_item.kind IN ('physical_reward'::public.shop_item_kind, 'physical_product'::public.shop_item_kind) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Featured cards only accept digital items');
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
  WHERE (
      s.surface_key = 'shop.unlock_cards'
      AND i.kind NOT IN ('physical_reward'::public.shop_item_kind, 'physical_product'::public.shop_item_kind)
    )
    OR (
      s.surface_key = 'shop.featured_cards'
      AND i.kind IN ('physical_reward'::public.shop_item_kind, 'physical_product'::public.shop_item_kind)
    )
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

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

  DELETE FROM public.shop_slot_presentations
  WHERE workspace = 'live'::public.shop_workspace;

  DELETE FROM public.shop_item_prices
  WHERE true;

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

  DELETE FROM public.shop_item_unlock_rules
  WHERE true;

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

  DELETE FROM public.shop_surface_slots
  WHERE true;

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

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { supabase } from '@/integrations/supabase/client';
import {
  createFallbackAdminShopSeed,
  createDefaultShopPresentation,
  createShopSurfaceCard,
  isPhysicalShopItemKind,
  normalizeShopCatalogPayload,
  normalizeShopPresentation,
  resolveShopCatalogImage,
  toShopCardViewModel,
  type ShopCatalogItem,
  type ShopCatalogPayload,
  type ShopCardViewModel,
  type ShopSurfaceCard,
  type ShopCardPresentation,
  type ShopCardTemplateKey,
  type ShopPrice,
} from '@/lib/shopCatalog';
import type {
  ShopActionKey,
  ShopCardVariant,
  ShopClaimStatus,
  ShopItemKind,
  ShopPriceAudience,
  ShopPriceCurrency,
  ShopSurfaceKey,
  ShopUnlockType,
  ShopWorkspace,
} from '@/lib/shopCatalog';

export interface AdminShopPriceRecord {
  id: string;
  item_id: string;
  audience: ShopPriceAudience;
  currency: ShopPriceCurrency;
  amount_minor: number;
  compare_at_minor: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminShopUnlockRuleRecord {
  item_id: string;
  unlock_type: ShopUnlockType;
  level_required: number | null;
  challenge_id: string | null;
  claim_once: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminShopItemRecord {
  id: string;
  slug: string;
  kind: ShopItemKind;
  title: string;
  subtitle: string;
  description: string;
  image_path: string;
  cta_label: string;
  is_active: boolean;
  action_key: ShopActionKey | null;
  coin_amount: number | null;
  vip_duration_days: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  prices: AdminShopPriceRecord[];
  unlockRule: AdminShopUnlockRuleRecord | null;
}

export interface AdminShopSlotRecord {
  id: string;
  surface_key: ShopSurfaceKey;
  sort_order: number;
  item_id: string;
  card_variant: ShopCardVariant;
  title_override: string;
  subtitle_override: string;
  cta_label_override: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminShopPresentationRecord {
  id: string;
  slot_id: string;
  workspace: ShopWorkspace;
  template_key: 'featured-card' | 'unlock-card';
  theme_key: string;
  eyebrow_text: string;
  supporting_text: string;
  primary_image_path: string;
  secondary_image_path: string;
  show_badge: boolean;
  show_subtitle: boolean;
  show_supporting_text: boolean;
  show_secondary_image: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AdminShopChallengeRecord {
  id: string;
  title: string;
  description: string;
  type: string;
  reward_type: string;
  reward_value: number;
  reward_xp: number;
  reward_coin: number;
  target_value: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface AdminShopWorkspaceSnapshot {
  workspace: ShopWorkspace;
  items: AdminShopItemRecord[];
  slots: AdminShopSlotRecord[];
  presentations: AdminShopPresentationRecord[];
  challenges: AdminShopChallengeRecord[];
}

export type AdminShopCardPlacement = 'public_digital' | 'wallet_offer' | 'real_item';

export interface AdminShopCardEntry {
  item: AdminShopItemRecord;
  slot: AdminShopSlotRecord | null;
  presentation: AdminShopPresentationRecord | null;
  card: ShopCardViewModel;
  placement: AdminShopCardPlacement;
  isVisibleInShop: boolean;
}

const EMPTY_DRAFT_WORKSPACE: AdminShopWorkspaceSnapshot = {
  workspace: 'draft',
  items: [],
  slots: [],
  presentations: [],
  challenges: [],
};

const EMPTY_LIVE_WORKSPACE: AdminShopWorkspaceSnapshot = {
  workspace: 'live',
  items: [],
  slots: [],
  presentations: [],
  challenges: [],
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback: number | null = null) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizePrice(value: unknown): AdminShopPriceRecord | null {
  const input = asObject(value);
  const id = asString(input.id);
  if (!id) return null;

  return {
    id,
    item_id: asString(input.item_id),
    audience: asString(input.audience) as ShopPriceAudience,
    currency: asString(input.currency) as ShopPriceCurrency,
    amount_minor: asNumber(input.amount_minor, 0) ?? 0,
    compare_at_minor: asNumber(input.compare_at_minor, null),
    is_active: asBoolean(input.is_active, true),
    created_at: asString(input.created_at),
    updated_at: asString(input.updated_at),
  };
}

function normalizeUnlockRule(value: unknown): AdminShopUnlockRuleRecord | null {
  const input = asObject(value);
  const itemId = asString(input.item_id);
  if (!itemId) return null;

  return {
    item_id: itemId,
    unlock_type: (asString(input.unlock_type, 'none') as ShopUnlockType) || 'none',
    level_required: asNumber(input.level_required, null),
    challenge_id: asString(input.challenge_id) || null,
    claim_once: asBoolean(input.claim_once, true),
    created_at: asString(input.created_at),
    updated_at: asString(input.updated_at),
  };
}

function normalizeItem(value: unknown): AdminShopItemRecord | null {
  const input = asObject(value);
  const id = asString(input.id);
  const kind = asString(input.kind) as ShopItemKind;
  if (!id || !kind) return null;

  const prices = Array.isArray(input.prices)
    ? input.prices.map(normalizePrice).filter((entry): entry is AdminShopPriceRecord => Boolean(entry))
    : [];

  return {
    id,
    slug: asString(input.slug),
    kind,
    title: asString(input.title),
    subtitle: asString(input.subtitle),
    description: asString(input.description),
    image_path: asString(input.image_path),
    cta_label: asString(input.cta_label),
    is_active: asBoolean(input.is_active, true),
    action_key: (asString(input.action_key) as ShopActionKey) || null,
    coin_amount: asNumber(input.coin_amount, null),
    vip_duration_days: asNumber(input.vip_duration_days, null),
    metadata: asObject(input.metadata),
    created_at: asString(input.created_at),
    updated_at: asString(input.updated_at),
    prices,
    unlockRule: normalizeUnlockRule(input.unlockRule ?? input.unlock_rule),
  };
}

function normalizeSlot(value: unknown): AdminShopSlotRecord | null {
  const input = asObject(value);
  const id = asString(input.id);
  if (!id) return null;

  return {
    id,
    surface_key: (asString(input.surface_key) as ShopSurfaceKey) || 'shop.featured_cards',
    sort_order: asNumber(input.sort_order, 0) ?? 0,
    item_id: asString(input.item_id),
    card_variant: (asString(input.card_variant, 'default') as ShopCardVariant) || 'default',
    title_override: asString(input.title_override),
    subtitle_override: asString(input.subtitle_override),
    cta_label_override: asString(input.cta_label_override),
    is_active: asBoolean(input.is_active, true),
    created_at: asString(input.created_at),
    updated_at: asString(input.updated_at),
  };
}

function normalizePresentation(value: unknown): AdminShopPresentationRecord | null {
  const input = asObject(value);
  const slotId = asString(input.slot_id);
  const workspace = asString(input.workspace) as ShopWorkspace;
  if (!slotId || !workspace) return null;

  return {
    id: asString(input.id),
    slot_id: slotId,
    workspace,
    template_key: (asString(input.template_key, 'featured-card') as 'featured-card' | 'unlock-card') || 'featured-card',
    theme_key: asString(input.theme_key, 'default') || 'default',
    eyebrow_text: asString(input.eyebrow_text),
    supporting_text: asString(input.supporting_text),
    primary_image_path: asString(input.primary_image_path),
    secondary_image_path: asString(input.secondary_image_path),
    show_badge: asBoolean(input.show_badge, true),
    show_subtitle: asBoolean(input.show_subtitle, true),
    show_supporting_text: asBoolean(input.show_supporting_text, false),
    show_secondary_image: asBoolean(input.show_secondary_image, false),
    metadata: asObject(input.metadata),
    created_at: asString(input.created_at),
    updated_at: asString(input.updated_at),
  };
}

function normalizeChallenge(value: unknown): AdminShopChallengeRecord | null {
  const input = asObject(value);
  const id = asString(input.id);
  if (!id) return null;

  return {
    id,
    title: asString(input.title),
    description: asString(input.description),
    type: asString(input.type),
    reward_type: asString(input.reward_type),
    reward_value: asNumber(input.reward_value, 0) ?? 0,
    reward_xp: asNumber(input.reward_xp, 0) ?? 0,
    reward_coin: asNumber(input.reward_coin, 0) ?? 0,
    target_value: asNumber(input.target_value, 0) ?? 0,
    is_active: asBoolean(input.is_active, true),
    sort_order: asNumber(input.sort_order, 0) ?? 0,
    created_at: asString(input.created_at),
    updated_at: asString(input.updated_at),
  };
}

function normalizeWorkspaceSnapshot(raw: unknown, fallbackWorkspace: ShopWorkspace): AdminShopWorkspaceSnapshot {
  const input = asObject(raw);
  const items = Array.isArray(input.items)
    ? input.items.map(normalizeItem).filter((entry): entry is AdminShopItemRecord => Boolean(entry))
    : [];
  const slots = Array.isArray(input.slots)
    ? input.slots.map(normalizeSlot).filter((entry): entry is AdminShopSlotRecord => Boolean(entry))
    : [];
  const presentations = Array.isArray(input.presentations)
    ? input.presentations.map(normalizePresentation).filter((entry): entry is AdminShopPresentationRecord => Boolean(entry))
    : [];
  const challenges = Array.isArray(input.challenges)
    ? input.challenges.map(normalizeChallenge).filter((entry): entry is AdminShopChallengeRecord => Boolean(entry))
    : [];

  return {
    workspace: (asString(input.workspace, fallbackWorkspace) as ShopWorkspace) || fallbackWorkspace,
    items,
    slots,
    presentations,
    challenges,
  };
}

function stableWorkspaceHash(snapshot: AdminShopWorkspaceSnapshot) {
  return JSON.stringify({
    items: snapshot.items.map((item) => ({
      ...item,
      prices: [...item.prices].sort((a, b) => a.id.localeCompare(b.id)),
    })),
    slots: [...snapshot.slots].sort((a, b) => a.id.localeCompare(b.id)),
    presentations: [...snapshot.presentations].sort((a, b) => a.id.localeCompare(b.id)),
  });
}

function isUuid(value: string | null | undefined) {
  return Boolean(value && UUID_PATTERN.test(value));
}

function toPricePayload(price: ShopPrice | AdminShopPriceRecord) {
  return {
    audience: price.audience,
    currency: price.currency,
    amount_minor: 'amountMinor' in price ? price.amountMinor : price.amount_minor,
    compare_at_minor: 'compareAtMinor' in price ? price.compareAtMinor : price.compare_at_minor,
    is_active: 'is_active' in price ? price.is_active : true,
  };
}

function buildAdminEffectivePrice(
  item: AdminShopItemRecord,
  audience: ShopPriceAudience = 'base',
): ShopPrice | null {
  const basePrice = item.prices.find((price) => price.is_active && price.audience === 'base');
  const vipPrice = item.prices.find((price) => price.is_active && price.audience === 'vip');
  const selectedPrice = audience === 'vip' ? (vipPrice ?? basePrice) : basePrice;
  if (!selectedPrice || item.kind === 'physical_reward' || item.kind === 'action_card') {
    return null;
  }

  return {
    audience,
    currency: selectedPrice.currency,
    amountMinor: selectedPrice.amount_minor,
    compareAtMinor: selectedPrice.compare_at_minor,
    label: selectedPrice.currency === 'eur'
      ? `€${(selectedPrice.amount_minor / 100).toFixed(2).replace('.', ',')}`
      : `${selectedPrice.amount_minor} COINS`,
  };
}

function buildAdminCardEntry({
  item,
  slot,
  presentation,
  placement,
}: {
  item: AdminShopItemRecord;
  slot: AdminShopSlotRecord | null;
  presentation: AdminShopPresentationRecord | null;
  placement: AdminShopCardPlacement;
}): AdminShopCardEntry {
  const surfaceKey = slot?.surface_key ?? (placement === 'real_item' ? 'shop.unlock_cards' : 'shop.featured_cards');
  const normalizedPresentation = presentation
    ? normalizeShopPresentation(presentation, surfaceKey, item.kind, item.image_path)
    : createDefaultShopPresentation({
        surfaceKey,
        kind: item.kind,
        imagePath: item.image_path,
        supportingText: item.description,
      });

  const card = toShopCardViewModel(
    createShopSurfaceCard({
      slotId: slot?.id ?? `draft-item-${item.id}`,
      surfaceKey,
      sortOrder: slot?.sort_order ?? 0,
      cardVariant: slot?.card_variant ?? (placement === 'real_item' ? 'reward' : item.kind === 'action_card' ? 'action' : 'coins'),
      title: slot?.title_override.trim() || item.title,
      subtitle: slot?.subtitle_override.trim() || item.subtitle,
      ctaLabel: slot?.cta_label_override.trim() || item.cta_label,
      presentation: normalizedPresentation,
      item: {
        id: item.id,
        slug: item.slug,
        kind: item.kind,
        title: item.title,
        subtitle: item.subtitle,
        description: item.description,
        imagePath: resolveShopCatalogImage(item.image_path),
        ctaLabel: item.cta_label,
        actionKey: item.action_key,
        coinAmount: item.coin_amount,
        vipDurationDays: item.vip_duration_days,
        metadata: item.metadata,
        effectivePrice: buildAdminEffectivePrice(item),
        unlockRule: {
          unlockType: item.unlockRule?.unlock_type ?? 'none',
          levelRequired: item.unlockRule?.level_required ?? null,
          challengeId: item.unlockRule?.challenge_id ?? null,
          claimOnce: item.unlockRule?.claim_once ?? true,
        },
        isUnlocked: item.kind !== 'physical_reward',
        claimState: null,
      },
    }),
  );

  return {
    item,
    slot,
    presentation,
    card,
    placement,
    isVisibleInShop: Boolean(slot?.is_active),
  };
}

function toUnlockRulePayload(item: ShopCatalogItem | AdminShopItemRecord) {
  const unlockRule = 'unlockRule' in item ? item.unlockRule : item.unlockRule;
  if (!unlockRule || item.kind !== 'physical_reward') return undefined;

  return {
    unlock_type: 'unlockType' in unlockRule ? unlockRule.unlockType : unlockRule.unlock_type,
    level_required: 'levelRequired' in unlockRule ? unlockRule.levelRequired : unlockRule.level_required,
    challenge_id: 'challengeId' in unlockRule ? unlockRule.challengeId : unlockRule.challenge_id,
    claim_once: 'claimOnce' in unlockRule ? unlockRule.claimOnce : unlockRule.claim_once,
  };
}

function createDraftItemPayload(
  item: ShopCatalogItem | AdminShopItemRecord,
  options: { preserveId?: boolean } = {},
) {
  const prices = 'effectivePrice' in item
    ? (item.effectivePrice ? [toPricePayload(item.effectivePrice)] : [])
    : item.prices
        .filter((price) => price.is_active)
        .map((price) => toPricePayload(price));

  return {
    ...(options.preserveId && isUuid(item.id) ? { id: item.id } : {}),
    slug: item.slug,
    kind: item.kind,
    title: item.title,
    subtitle: item.subtitle,
    description: item.description,
    image_path: 'imagePath' in item ? item.imagePath : item.image_path,
    cta_label: 'ctaLabel' in item ? item.ctaLabel : item.cta_label,
    is_active: 'is_active' in item ? item.is_active : true,
    action_key: item.actionKey ?? ('action_key' in item ? item.action_key : null),
    coin_amount: item.coinAmount ?? ('coin_amount' in item ? item.coin_amount : null),
    vip_duration_days: item.vipDurationDays ?? ('vip_duration_days' in item ? item.vip_duration_days : null),
    metadata: item.metadata,
    prices,
    unlock_rule: toUnlockRulePayload(item),
  };
}

function normalizePresentationPayload(
  presentation: ShopCardPresentation | AdminShopPresentationRecord | null,
  fallbackSurface: ShopSurfaceKey,
  fallbackKind: ShopItemKind,
  fallbackImagePath: string,
) {
  const resolved = presentation
    ? 'templateKey' in presentation
      ? presentation
      : {
          templateKey: presentation.template_key as ShopCardTemplateKey,
          themeKey: presentation.theme_key,
          eyebrowText: presentation.eyebrow_text,
          supportingText: presentation.supporting_text,
          primaryImagePath: presentation.primary_image_path,
          secondaryImagePath: presentation.secondary_image_path,
          showBadge: presentation.show_badge,
          showSubtitle: presentation.show_subtitle,
          showSupportingText: presentation.show_supporting_text,
          showSecondaryImage: presentation.show_secondary_image,
          metadata: presentation.metadata,
        }
    : createDefaultShopPresentation({
        surfaceKey: fallbackSurface,
        kind: fallbackKind,
        imagePath: fallbackImagePath,
      });

  return {
    template_key: resolved.templateKey,
    theme_key: resolved.themeKey,
    eyebrow_text: resolved.eyebrowText,
    supporting_text: resolved.supportingText,
    primary_image_path: resolved.primaryImagePath || fallbackImagePath,
    secondary_image_path: resolved.secondaryImagePath,
    show_badge: resolved.showBadge,
    show_subtitle: resolved.showSubtitle,
    show_supporting_text: resolved.showSupportingText,
    show_secondary_image: resolved.showSecondaryImage,
    metadata: resolved.metadata,
  };
}

function createDraftSlotPayload(
  slot: ShopSurfaceCard | AdminShopSlotRecord,
  itemId: string,
  options: {
    preserveId?: boolean;
    fallbackKind: ShopItemKind;
    fallbackImagePath: string;
    presentation?: ShopCardPresentation | AdminShopPresentationRecord | null;
  },
) {
  const surfaceKey = 'surfaceKey' in slot ? slot.surfaceKey : slot.surface_key;
  const title = 'title' in slot ? slot.title : '';
  const subtitle = 'subtitle' in slot ? slot.subtitle : '';
  const ctaLabel = 'ctaLabel' in slot ? slot.ctaLabel : '';

  return {
    ...(
      options.preserveId
      && 'id' in slot
      && isUuid(slot.id)
        ? { id: slot.id }
        : {}
    ),
    surface_key: surfaceKey,
    sort_order: 'sortOrder' in slot ? slot.sortOrder : slot.sort_order,
    item_id: itemId,
    card_variant: 'cardVariant' in slot ? slot.cardVariant : slot.card_variant,
    title_override: 'title_override' in slot ? slot.title_override : title,
    subtitle_override: 'subtitle_override' in slot ? slot.subtitle_override : subtitle,
    cta_label_override: 'cta_label_override' in slot ? slot.cta_label_override : ctaLabel,
    is_active: 'is_active' in slot ? slot.is_active : true,
    presentation: normalizePresentationPayload(
      options.presentation ?? null,
      surfaceKey,
      options.fallbackKind,
      options.fallbackImagePath,
    ),
  };
}

async function runAdminItemUpsert(payload: Record<string, unknown>) {
  const { data, error } = await supabase.rpc('admin_upsert_shop_item', { p_payload: payload });
  if (error) throw error;
  const result = data as { success?: boolean; error?: string; id?: string } | null;
  if (!result?.success || !result.id) {
    throw new Error(result?.error || 'Unable to seed draft shop item.');
  }
  return result.id;
}

async function runAdminSlotUpsert(payload: Record<string, unknown>) {
  const { data, error } = await supabase.rpc('admin_upsert_shop_surface_slot', { p_payload: payload });
  if (error) throw error;
  const result = data as { success?: boolean; error?: string } | null;
  if (!result?.success) {
    throw new Error(result?.error || 'Unable to seed draft shop slot.');
  }
}

async function bootstrapDraftFromLiveSnapshot(snapshot: AdminShopWorkspaceSnapshot) {
  const presentationMap = new Map(snapshot.presentations.map((presentation) => [presentation.slot_id, presentation]));

  for (const item of snapshot.items) {
    await runAdminItemUpsert(createDraftItemPayload(item, { preserveId: true }));
  }

  for (const slot of [...snapshot.slots].sort((a, b) => a.sort_order - b.sort_order)) {
    const item = snapshot.items.find((entry) => entry.id === slot.item_id);
    if (!item) continue;

    await runAdminSlotUpsert(
      createDraftSlotPayload(slot, slot.item_id, {
        preserveId: true,
        fallbackKind: item.kind,
        fallbackImagePath: item.image_path,
        presentation: presentationMap.get(slot.id) ?? null,
      }),
    );
  }
}

async function bootstrapDraftFromFallbackSeed() {
  const seed = createFallbackAdminShopSeed();
  const itemIdMap = new Map<string, string>();

  for (const item of seed.items) {
    const persistedId = await runAdminItemUpsert({
      slug: item.slug,
      kind: item.kind,
      title: item.title,
      subtitle: item.subtitle,
      description: item.description,
      image_path: item.image_path,
      cta_label: item.cta_label,
      is_active: item.is_active,
      action_key: item.action_key,
      coin_amount: item.coin_amount,
      vip_duration_days: item.vip_duration_days,
      metadata: item.metadata,
      prices: item.prices,
      unlock_rule: item.unlock_rule,
    });

    itemIdMap.set(item.sourceKey, persistedId);
  }

  for (const slot of seed.slots) {
    const itemId = itemIdMap.get(slot.itemSourceKey);
    if (!itemId) {
      throw new Error(`Unable to resolve seeded item for slot ${slot.sourceKey}.`);
    }

    await runAdminSlotUpsert({
      surface_key: slot.surface_key,
      sort_order: slot.sort_order,
      item_id: itemId,
      card_variant: slot.card_variant,
      title_override: slot.title_override,
      subtitle_override: slot.subtitle_override,
      cta_label_override: slot.cta_label_override,
      is_active: slot.is_active,
      presentation: slot.presentation,
    });
  }
}

function createWorkspaceProjectionFromCatalog(
  catalog: ShopCatalogPayload,
  workspace: ShopWorkspace,
): AdminShopWorkspaceSnapshot {
  const itemMap = new Map<string, AdminShopItemRecord>();
  const projectedCards = [...catalog.featuredCards, ...catalog.unlockCards];

  const registerItem = (item: ShopCatalogItem) => {
    if (itemMap.has(item.id)) return;

    itemMap.set(item.id, {
      id: item.id,
      slug: item.slug,
      kind: item.kind,
      title: item.title,
      subtitle: item.subtitle,
      description: item.description,
      image_path: item.imagePath,
      cta_label: item.ctaLabel,
      is_active: true,
      action_key: item.actionKey,
      coin_amount: item.coinAmount,
      vip_duration_days: item.vipDurationDays,
      metadata: item.metadata,
      created_at: '',
      updated_at: '',
      prices: item.effectivePrice
        ? [
            {
              id: `${item.id}-price-${item.effectivePrice.audience}`,
              item_id: item.id,
              audience: item.effectivePrice.audience,
              currency: item.effectivePrice.currency,
              amount_minor: item.effectivePrice.amountMinor,
              compare_at_minor: item.effectivePrice.compareAtMinor,
              is_active: true,
              created_at: '',
              updated_at: '',
            },
          ]
        : [],
      unlockRule: item.kind === 'physical_reward'
        ? {
            item_id: item.id,
            unlock_type: item.unlockRule.unlockType,
            level_required: item.unlockRule.levelRequired,
            challenge_id: item.unlockRule.challengeId,
            claim_once: item.unlockRule.claimOnce,
            created_at: '',
            updated_at: '',
          }
        : null,
    });
  };

  catalog.coinPacks.forEach(registerItem);
  if (catalog.vipOffer) registerItem(catalog.vipOffer);
  projectedCards.forEach((card) => registerItem(card.item));

  const slots = projectedCards.map((card) => ({
    id: card.slotId,
    surface_key: card.surfaceKey,
    sort_order: card.sortOrder,
    item_id: card.item.id,
    card_variant: card.cardVariant,
    title_override: card.title === card.item.title ? '' : card.title,
    subtitle_override: card.subtitle === card.item.subtitle ? '' : card.subtitle,
    cta_label_override: card.ctaLabel === card.item.ctaLabel ? '' : card.ctaLabel,
    is_active: true,
    created_at: '',
    updated_at: '',
  }));

  const presentations = projectedCards.map((card) => ({
    id: `${workspace}-${card.slotId}`,
    slot_id: card.slotId,
    workspace,
    template_key: card.presentation.templateKey,
    theme_key: card.presentation.themeKey,
    eyebrow_text: card.presentation.eyebrowText,
    supporting_text: card.presentation.supportingText,
    primary_image_path: card.presentation.primaryImagePath,
    secondary_image_path: card.presentation.secondaryImagePath,
    show_badge: card.presentation.showBadge,
    show_subtitle: card.presentation.showSubtitle,
    show_supporting_text: card.presentation.showSupportingText,
    show_secondary_image: card.presentation.showSecondaryImage,
    metadata: card.presentation.metadata,
    created_at: '',
    updated_at: '',
  }));

  return {
    workspace,
    items: Array.from(itemMap.values()),
    slots,
    presentations,
    challenges: [],
  };
}

export function useAdminShopCatalog() {
  const { user, authLoading, isAdmin } = useAdminStatus();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['admin-shop-workspaces', user?.id ?? 'guest', isAdmin ? 'admin' : 'public'],
    enabled: !authLoading,
    queryFn: async () => {
      const loadPublicProjection = async () => {
        let rawCatalog: unknown = null;
        try {
          const { data, error } = await supabase.rpc('get_shop_catalog');
          if (error) {
            console.error('get_shop_catalog failed; using hardcoded fallback catalog:', error);
          } else {
            rawCatalog = data;
          }
        } catch (rpcError) {
          console.error('get_shop_catalog threw; using hardcoded fallback catalog:', rpcError);
        }
        const catalog = normalizeShopCatalogPayload(rawCatalog);
        const projection = createWorkspaceProjectionFromCatalog(catalog, 'draft');
        return {
          draft: projection,
          live: createWorkspaceProjectionFromCatalog(catalog, 'live'),
          workspaceSource: 'public_catalog_projection' as const,
          adminBackendAvailable: false,
        };
      };

      if (!isAdmin) {
        return loadPublicProjection();
      }

      try {
        const [draftRes, liveRes] = await Promise.all([
          supabase.rpc('admin_get_shop_workspace', { p_workspace: 'draft' }),
          supabase.rpc('admin_get_shop_workspace', { p_workspace: 'live' }),
        ]);

        if (draftRes.error) throw draftRes.error;
        if (liveRes.error) throw liveRes.error;

        const draftPayload = draftRes.data as { success?: boolean; error?: string } | null;
        const livePayload = liveRes.data as { success?: boolean; error?: string } | null;

        if (!draftPayload || draftPayload.success === false) {
          throw new Error(draftPayload?.error || 'Unable to load draft shop workspace.');
        }
        if (!livePayload || livePayload.success === false) {
          throw new Error(livePayload?.error || 'Unable to load live shop workspace.');
        }

        let draft = normalizeWorkspaceSnapshot(draftPayload, 'draft');
        let live = normalizeWorkspaceSnapshot(livePayload, 'live');

        if (draft.items.length === 0 && draft.slots.length === 0) {
          try {
            if (live.slots.length > 0) {
              await bootstrapDraftFromLiveSnapshot(live);
            } else {
              await bootstrapDraftFromFallbackSeed();
            }

            const refreshedDraftRes = await supabase.rpc('admin_get_shop_workspace', { p_workspace: 'draft' });
            if (refreshedDraftRes.error) throw refreshedDraftRes.error;
            const refreshedDraftPayload = refreshedDraftRes.data as { success?: boolean; error?: string } | null;
            if (!refreshedDraftPayload || refreshedDraftPayload.success === false) {
              throw new Error(refreshedDraftPayload?.error || 'Unable to refresh draft shop workspace after sync.');
            }

            draft = normalizeWorkspaceSnapshot(refreshedDraftPayload, 'draft');
          } catch (seedError) {
            console.error('Unable to bootstrap admin shop draft from current shop cards:', seedError);
            return loadPublicProjection();
          }
        }

        if (draft.items.length === 0 && live.items.length === 0) {
          return loadPublicProjection();
        }

        if (draft.items.length === 0 && live.items.length > 0) {
          draft = {
            ...live,
            workspace: 'draft',
            presentations: live.presentations.map((presentation) => ({
              ...presentation,
              workspace: 'draft',
            })),
          };
        }

        if (live.items.length === 0 && draft.items.length > 0) {
          live = {
            ...draft,
            workspace: 'live',
            presentations: draft.presentations.map((presentation) => ({
              ...presentation,
              workspace: 'live',
            })),
          };
        }

        return {
          draft,
          live,
          workspaceSource: 'workspace' as const,
          adminBackendAvailable: true,
        };
      } catch (error) {
        console.error('Falling back to public shop projection for admin workspace:', error);
        return loadPublicProjection();
      }
    },
    staleTime: 5_000,
    refetchOnWindowFocus: false,
  });

  const saveItem = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data, error } = await supabase.rpc('admin_upsert_shop_item', { p_payload: payload });
      if (error) throw error;
      const result = data as { success?: boolean; error?: string } | null;
      if (!result?.success) {
        throw new Error(result?.error || 'Unable to save shop item.');
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shop-workspaces'] });
    },
  });

  const saveSlot = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data, error } = await supabase.rpc('admin_upsert_shop_surface_slot', { p_payload: payload });
      if (error) throw error;
      const result = data as { success?: boolean; error?: string } | null;
      if (!result?.success) {
        throw new Error(result?.error || 'Unable to save shop slot.');
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shop-workspaces'] });
    },
  });

  const setItemActive = useMutation({
    mutationFn: async ({ itemId, isActive }: { itemId: string; isActive: boolean }) => {
      const { data, error } = await supabase.rpc('admin_set_shop_item_active', {
        p_item_id: itemId,
        p_is_active: isActive,
      });
      if (error) throw error;
      const result = data as { success?: boolean; error?: string } | null;
      if (!result?.success) {
        throw new Error(result?.error || 'Unable to change item status.');
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shop-workspaces'] });
    },
  });

  const publishCatalog = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('admin_publish_shop_catalog');
      if (error) throw error;
      const result = data as { success?: boolean; error?: string } | null;
      if (!result?.success) {
        throw new Error(result?.error || 'Unable to publish shop.');
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shop-workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['shop-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['admin-shop-claims'] });
    },
  });

  const draft = query.data?.draft ?? EMPTY_DRAFT_WORKSPACE;
  const live = query.data?.live ?? EMPTY_LIVE_WORKSPACE;

  const hasUnpublishedChanges = useMemo(
    () => stableWorkspaceHash(draft) !== stableWorkspaceHash(live),
    [draft, live],
  );

  const groupedCards = useMemo(() => {
    const slotsByItemId = new Map<string, AdminShopSlotRecord[]>();
    const presentationBySlotId = new Map(draft.presentations.map((presentation) => [presentation.slot_id, presentation]));

    for (const slot of draft.slots) {
      const list = slotsByItemId.get(slot.item_id) ?? [];
      list.push(slot);
      list.sort((left, right) => left.sort_order - right.sort_order);
      slotsByItemId.set(slot.item_id, list);
    }

    const publicDigitalCards: AdminShopCardEntry[] = [];
    const walletOffers: AdminShopCardEntry[] = [];
    const realItems: AdminShopCardEntry[] = [];

    for (const item of draft.items) {
      const itemSlots = slotsByItemId.get(item.id) ?? [];
      const featuredSlot = itemSlots.find((slot) => slot.surface_key === 'shop.featured_cards' && slot.is_active)
        ?? itemSlots.find((slot) => slot.surface_key === 'shop.featured_cards')
        ?? null;
      const unlockSlot = itemSlots.find((slot) => slot.surface_key === 'shop.unlock_cards' && slot.is_active)
        ?? itemSlots.find((slot) => slot.surface_key === 'shop.unlock_cards')
        ?? null;

      if (isPhysicalShopItemKind(item.kind)) {
        realItems.push(
          buildAdminCardEntry({
            item,
            slot: unlockSlot,
            presentation: unlockSlot ? presentationBySlotId.get(unlockSlot.id) ?? null : null,
            placement: 'real_item',
          }),
        );
        continue;
      }

      const digitalEntry = buildAdminCardEntry({
        item,
        slot: featuredSlot,
        presentation: featuredSlot ? presentationBySlotId.get(featuredSlot.id) ?? null : null,
        placement: featuredSlot?.is_active ? 'public_digital' : 'wallet_offer',
      });

      if (featuredSlot?.is_active) {
        publicDigitalCards.push(digitalEntry);
      } else {
        walletOffers.push(digitalEntry);
      }
    }

    walletOffers.sort((left, right) => {
      const leftKindOrder = left.item.kind === 'coin_pack' ? 0 : left.item.kind === 'vip_membership' ? 1 : 2;
      const rightKindOrder = right.item.kind === 'coin_pack' ? 0 : right.item.kind === 'vip_membership' ? 1 : 2;
      if (leftKindOrder !== rightKindOrder) return leftKindOrder - rightKindOrder;
      if (left.item.kind === 'coin_pack' && right.item.kind === 'coin_pack') {
        return (left.item.coin_amount ?? 0) - (right.item.coin_amount ?? 0);
      }
      return left.item.title.localeCompare(right.item.title);
    });

    realItems.sort((left, right) => {
      if (left.slot && right.slot) return left.slot.sort_order - right.slot.sort_order;
      if (left.item.unlockRule?.level_required && right.item.unlockRule?.level_required) {
        return left.item.unlockRule.level_required - right.item.unlockRule.level_required;
      }
      return left.item.title.localeCompare(right.item.title);
    });

    return {
      publicDigitalCards,
      walletOffers,
      realItems,
    };
  }, [draft.items, draft.presentations, draft.slots]);

  return {
    ...query,
    draft,
    live,
    items: draft.items,
    slots: draft.slots,
    presentations: draft.presentations,
    challenges: draft.challenges,
    liveItems: live.items,
    liveSlots: live.slots,
    livePresentations: live.presentations,
    workspaceSource: query.data?.workspaceSource ?? 'public_catalog_projection',
    adminBackendAvailable: query.data?.adminBackendAvailable ?? false,
    hasUnpublishedChanges,
    publicDigitalCards: groupedCards.publicDigitalCards,
    walletOffers: groupedCards.walletOffers,
    realItems: groupedCards.realItems,
    saveItem: saveItem.mutateAsync,
    saveSlot: saveSlot.mutateAsync,
    setItemActive: setItemActive.mutateAsync,
    publishCatalog: publishCatalog.mutateAsync,
    savingItem: saveItem.isPending,
    savingSlot: saveSlot.isPending,
    togglingItem: setItemActive.isPending,
    publishingCatalog: publishCatalog.isPending,
    isBootstrappingInitialDraft: query.isLoading && draft.items.length === 0 && draft.slots.length === 0,
  };
}

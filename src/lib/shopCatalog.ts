import { supabase } from '@/integrations/supabase/client';
import type { LevelReward } from '@/lib/levelRewards';

export type ShopItemKind =
  | 'coin_pack'
  | 'vip_membership'
  | 'physical_product'
  | 'physical_reward'
  | 'action_card';

export type ShopPriceAudience = 'base' | 'vip';
export type ShopPriceCurrency = 'eur' | 'coins';
export type ShopUnlockType = 'none' | 'level' | 'challenge';
export type ShopClaimStatus = 'pending' | 'approved' | 'fulfilled' | 'rejected' | 'cancelled';
export type ShopSurfaceKey = 'shop.featured_cards' | 'shop.unlock_cards';
export type ShopWorkspace = 'draft' | 'live';
export type ShopActionKey =
  | 'open_wallet_coins'
  | 'open_wallet_vip'
  | 'open_challenges'
  | 'open_matches'
  | 'open_teams'
  | 'open_shop';

export type ShopCardVariant = 'default' | 'coins' | 'reward' | 'action';
export type ShopCardTemplateKey = 'featured-card' | 'unlock-card';

export interface ShopPrice {
  audience: ShopPriceAudience;
  currency: ShopPriceCurrency;
  amountMinor: number;
  compareAtMinor: number | null;
  label: string;
}

export interface ShopUnlockRule {
  unlockType: ShopUnlockType;
  levelRequired: number | null;
  challengeId: string | null;
  claimOnce: boolean;
}

export interface ShopClaimState {
  id: string;
  status: ShopClaimStatus;
  requestedAt: string | null;
  resolvedAt: string | null;
  adminNote: string;
}

export interface ShopCardPresentation {
  templateKey: ShopCardTemplateKey;
  themeKey: string;
  eyebrowText: string;
  supportingText: string;
  primaryImagePath: string;
  secondaryImagePath: string;
  showBadge: boolean;
  showSubtitle: boolean;
  showSupportingText: boolean;
  showSecondaryImage: boolean;
  metadata: Record<string, unknown>;
}

export interface ShopCatalogItem {
  id: string;
  slug: string;
  kind: ShopItemKind;
  title: string;
  subtitle: string;
  description: string;
  imagePath: string;
  ctaLabel: string;
  actionKey: ShopActionKey | null;
  coinAmount: number | null;
  vipDurationDays: number | null;
  metadata: Record<string, unknown>;
  effectivePrice: ShopPrice | null;
  unlockRule: ShopUnlockRule;
  isUnlocked: boolean;
  claimState: ShopClaimState | null;
}

export interface ShopSurfaceCard {
  slotId: string;
  surfaceKey: ShopSurfaceKey;
  sortOrder: number;
  cardVariant: ShopCardVariant;
  title: string;
  subtitle: string;
  ctaLabel: string;
  presentation: ShopCardPresentation;
  item: ShopCatalogItem;
}

export interface ShopCatalogViewer {
  userId: string | null;
  isAuthenticated: boolean;
  isVip: boolean;
  level: number;
}

export interface ShopCatalogPayload {
  viewer: ShopCatalogViewer;
  featuredCards: ShopSurfaceCard[];
  unlockCards: ShopSurfaceCard[];
  coinPacks: ShopCatalogItem[];
  vipOffer: ShopCatalogItem | null;
}

export interface ShopAdminSeedPrice {
  audience: ShopPriceAudience;
  currency: ShopPriceCurrency;
  amount_minor: number;
  compare_at_minor: number | null;
  is_active: boolean;
}

export interface ShopAdminSeedUnlockRule {
  unlock_type: ShopUnlockType;
  level_required: number | null;
  challenge_id: string | null;
  claim_once: boolean;
}

export interface ShopAdminSeedItem {
  sourceKey: string;
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
  prices: ShopAdminSeedPrice[];
  unlock_rule?: ShopAdminSeedUnlockRule;
}

export interface ShopAdminSeedPresentation {
  template_key: ShopCardTemplateKey;
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
}

export interface ShopAdminSeedSlot {
  sourceKey: string;
  itemSourceKey: string;
  surface_key: ShopSurfaceKey;
  sort_order: number;
  card_variant: ShopCardVariant;
  title_override: string;
  subtitle_override: string;
  cta_label_override: string;
  is_active: boolean;
  presentation: ShopAdminSeedPresentation;
}

export interface ShopAdminSeed {
  items: ShopAdminSeedItem[];
  slots: ShopAdminSeedSlot[];
}

export interface ShopCardViewModel {
  id: string;
  slug: string;
  slotId: string;
  surfaceKey: ShopSurfaceKey;
  sortOrder: number;
  cardVariant: ShopCardVariant;
  templateKey: ShopCardTemplateKey;
  themeKey: string;
  title: string;
  subtitle: string;
  description: string;
  supportingText: string;
  image: string;
  primaryImage: string;
  secondaryImage: string;
  kind: ShopItemKind;
  ctaLabel: string;
  actionKey: ShopActionKey | null;
  coinAmount: number | null;
  vipDurationDays: number | null;
  priceLabel: string | null;
  priceCurrency: ShopPriceCurrency | null;
  unlockLabel: string | null;
  levelRequired: number | null;
  challengeId: string | null;
  isLocked: boolean;
  isClaimed: boolean;
  claimStatus: ShopClaimStatus | null;
  badgeLabel: string | null;
  showBadge: boolean;
  showSubtitle: boolean;
  showSupportingText: boolean;
  showSecondaryImage: boolean;
  metadata: Record<string, unknown>;
  searchText: string;
}

const SHOP_CATALOG_BUCKET = 'shop-catalog';

export const SHOP_ACTION_KEYS: ShopActionKey[] = [
  'open_wallet_coins',
  'open_wallet_vip',
  'open_challenges',
  'open_matches',
  'open_teams',
  'open_shop',
];

export function formatShopMoneyLabel(amountMinor: number, currency: ShopPriceCurrency) {
  if (currency === 'eur') {
    return `€${(amountMinor / 100).toFixed(2).replace('.', ',')}`;
  }

  return `${amountMinor} COINS`;
}

export function resolveShopCatalogImage(imagePath: string) {
  if (!imagePath) return '';
  if (
    imagePath.startsWith('/')
    || imagePath.startsWith('http://')
    || imagePath.startsWith('https://')
    || imagePath.startsWith('blob:')
    || imagePath.startsWith('data:')
  ) {
    return imagePath;
  }

  return supabase.storage.from(SHOP_CATALOG_BUCKET).getPublicUrl(imagePath).data.publicUrl;
}

export function defaultShopTemplateForSurface(surfaceKey: ShopSurfaceKey): ShopCardTemplateKey {
  return surfaceKey === 'shop.unlock_cards' ? 'unlock-card' : 'featured-card';
}

export function defaultShopBadgeLabel(kind: ShopItemKind) {
  switch (kind) {
    case 'coin_pack':
      return 'COINS';
    case 'vip_membership':
      return 'VIP';
    case 'physical_reward':
      return 'UNLOCK';
    case 'physical_product':
      return 'MERCH';
    case 'action_card':
      return 'ACTION';
    default:
      return 'SHOP';
  }
}

export function isPhysicalShopItemKind(kind: ShopItemKind) {
  return kind === 'physical_product' || kind === 'physical_reward';
}

export function isDigitalShopItemKind(kind: ShopItemKind) {
  return !isPhysicalShopItemKind(kind);
}

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

function normalizePrice(value: unknown): ShopPrice | null {
  const input = asObject(value);
  const currency = asString(input.currency) as ShopPriceCurrency;
  const audience = asString(input.audience) as ShopPriceAudience;

  if (!currency || !audience) return null;

  const amountMinor = asNumber(input.amount_minor ?? input.amountMinor, 0) ?? 0;
  const compareAtMinor = asNumber(input.compare_at_minor ?? input.compareAtMinor, null);

  return {
    audience,
    currency,
    amountMinor,
    compareAtMinor,
    label: asString(input.label, formatShopMoneyLabel(amountMinor, currency)),
  };
}

function normalizeUnlockRule(value: unknown): ShopUnlockRule {
  const input = asObject(value);
  return {
    unlockType: (asString(input.unlock_type ?? input.unlockType, 'none') as ShopUnlockType) || 'none',
    levelRequired: asNumber(input.level_required ?? input.levelRequired, null),
    challengeId: asString(input.challenge_id ?? input.challengeId) || null,
    claimOnce: asBoolean(input.claim_once ?? input.claimOnce, true),
  };
}

function normalizeClaimState(value: unknown): ShopClaimState | null {
  const input = asObject(value);
  const id = asString(input.id);
  if (!id) return null;

  return {
    id,
    status: asString(input.status) as ShopClaimStatus,
    requestedAt: asString(input.requested_at ?? input.requestedAt) || null,
    resolvedAt: asString(input.resolved_at ?? input.resolvedAt) || null,
    adminNote: asString(input.admin_note ?? input.adminNote),
  };
}

export function normalizeShopPresentation(
  value: unknown,
  surfaceKey: ShopSurfaceKey,
  kind: ShopItemKind,
  imagePath: string,
): ShopCardPresentation {
  const input = asObject(value);
  const primaryImagePath = asString(input.primary_image_path ?? input.primaryImagePath, imagePath) || imagePath;

  return {
    templateKey: (asString(input.template_key ?? input.templateKey, defaultShopTemplateForSurface(surfaceKey)) as ShopCardTemplateKey)
      || defaultShopTemplateForSurface(surfaceKey),
    themeKey: asString(input.theme_key ?? input.themeKey, 'default') || 'default',
    eyebrowText: asString(input.eyebrow_text ?? input.eyebrowText, defaultShopBadgeLabel(kind)) || defaultShopBadgeLabel(kind),
    supportingText: asString(input.supporting_text ?? input.supportingText),
    primaryImagePath: resolveShopCatalogImage(primaryImagePath),
    secondaryImagePath: resolveShopCatalogImage(asString(input.secondary_image_path ?? input.secondaryImagePath)),
    showBadge: asBoolean(input.show_badge ?? input.showBadge, true),
    showSubtitle: asBoolean(input.show_subtitle ?? input.showSubtitle, true),
    showSupportingText: asBoolean(input.show_supporting_text ?? input.showSupportingText, surfaceKey === 'shop.unlock_cards'),
    showSecondaryImage: asBoolean(input.show_secondary_image ?? input.showSecondaryImage, false),
    metadata: asObject(input.metadata),
  };
}

export function createDefaultShopPresentation({
  surfaceKey,
  kind,
  imagePath,
  supportingText = '',
  metadata = {},
}: {
  surfaceKey: ShopSurfaceKey;
  kind: ShopItemKind;
  imagePath: string;
  supportingText?: string;
  metadata?: Record<string, unknown>;
}): ShopCardPresentation {
  return normalizeShopPresentation(
    {
      template_key: defaultShopTemplateForSurface(surfaceKey),
      theme_key: 'default',
      eyebrow_text: defaultShopBadgeLabel(kind),
      supporting_text: supportingText,
      primary_image_path: imagePath,
      secondary_image_path: '',
      show_badge: true,
      show_subtitle: false,
      show_supporting_text: Boolean(supportingText),
      show_secondary_image: false,
      metadata,
    },
    surfaceKey,
    kind,
    imagePath,
  );
}

function normalizeCatalogItem(value: unknown): ShopCatalogItem | null {
  const input = asObject(value);
  const id = asString(input.id);
  const kind = asString(input.kind) as ShopItemKind;

  if (!id || !kind) return null;

  return {
    id,
    slug: asString(input.slug, id),
    kind,
    title: asString(input.title),
    subtitle: asString(input.subtitle),
    description: asString(input.description),
    imagePath: resolveShopCatalogImage(asString(input.image_path ?? input.imagePath)),
    ctaLabel: asString(input.cta_label ?? input.ctaLabel),
    actionKey: (asString(input.action_key ?? input.actionKey) as ShopActionKey) || null,
    coinAmount: asNumber(input.coin_amount ?? input.coinAmount, null),
    vipDurationDays: asNumber(input.vip_duration_days ?? input.vipDurationDays, null),
    metadata: asObject(input.metadata),
    effectivePrice: normalizePrice(input.effective_price ?? input.effectivePrice),
    unlockRule: normalizeUnlockRule(input.unlock_rule ?? input.unlockRule),
    isUnlocked: asBoolean(input.is_unlocked ?? input.isUnlocked, true),
    claimState: normalizeClaimState(input.claim_state ?? input.claimState),
  };
}

function normalizeSurfaceCard(value: unknown, fallbackSurface: ShopSurfaceKey): ShopSurfaceCard | null {
  const input = asObject(value);
  const slotId = asString(input.slot_id ?? input.slotId);
  const item = normalizeCatalogItem(input.item);

  if (!slotId || !item) return null;

  return {
    slotId,
    surfaceKey: (asString(input.surface_key ?? input.surfaceKey, fallbackSurface) as ShopSurfaceKey) || fallbackSurface,
    sortOrder: asNumber(input.sort_order ?? input.sortOrder, 0) ?? 0,
    cardVariant: (asString(input.card_variant ?? input.cardVariant, 'default') as ShopCardVariant) || 'default',
    title: asString(input.title, item.title),
    subtitle: asString(input.subtitle, item.subtitle),
    ctaLabel: asString(input.cta_label ?? input.ctaLabel, item.ctaLabel),
    presentation: normalizeShopPresentation(input.presentation, fallbackSurface, item.kind, item.imagePath),
    item,
  };
}

function normalizeCatalogItems(value: unknown): ShopCatalogItem[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeCatalogItem).filter((item): item is ShopCatalogItem => Boolean(item));
}

function normalizeSurfaceCards(value: unknown, surfaceKey: ShopSurfaceKey): ShopSurfaceCard[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeSurfaceCard(entry, surfaceKey))
    .filter((entry): entry is ShopSurfaceCard => Boolean(entry))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function createShopSurfaceCard({
  slotId,
  surfaceKey,
  sortOrder,
  cardVariant,
  title,
  subtitle,
  ctaLabel,
  presentation,
  item,
}: {
  slotId: string;
  surfaceKey: ShopSurfaceKey;
  sortOrder: number;
  cardVariant: ShopCardVariant;
  title: string;
  subtitle: string;
  ctaLabel: string;
  presentation: ShopCardPresentation;
  item: ShopCatalogItem;
}): ShopSurfaceCard {
  return {
    slotId,
    surfaceKey,
    sortOrder,
    cardVariant,
    title,
    subtitle,
    ctaLabel,
    presentation,
    item,
  };
}

export function createFallbackShopCatalog(viewerOverrides: Partial<ShopCatalogViewer> = {}): ShopCatalogPayload {
  const viewer: ShopCatalogViewer = {
    userId: null,
    isAuthenticated: false,
    isVip: false,
    level: 0,
    ...viewerOverrides,
  };

  const basePrice = (coins: number): ShopPrice => ({
    audience: viewer.isVip ? 'vip' : 'base',
    currency: 'eur',
    amountMinor: coins * 100,
    compareAtMinor: null,
    label: formatShopMoneyLabel(coins * 100, 'eur'),
  });

  const coinPackItems: ShopCatalogItem[] = [3, 5, 10, 15, 25, 50].map((coins) => ({
    id: `fallback-pack-${coins}`,
    slug: `fallback-pack-${coins}`,
    kind: 'coin_pack',
    title: `${coins} COINS`,
    subtitle: coins >= 10 ? 'COIN PACK' : 'STARTER PACK',
    description: `${coins} OBC coins`,
    imagePath: '/coin.png',
    ctaLabel: 'BUY NOW',
    actionKey: null,
    coinAmount: coins,
    vipDurationDays: null,
    metadata: { badge: defaultShopBadgeLabel('coin_pack') },
    effectivePrice: basePrice(coins),
    unlockRule: { unlockType: 'none', levelRequired: null, challengeId: null, claimOnce: true },
    isUnlocked: true,
    claimState: null,
  }));

  const vipOffer: ShopCatalogItem = {
    id: 'fallback-vip-30d',
    slug: 'fallback-vip-30d',
    kind: 'vip_membership',
    title: 'VIP',
    subtitle: '1 MONTH',
    description: 'VIP membership for 30 days',
    imagePath: '/showreel/vip-icon.svg',
    ctaLabel: viewer.isVip ? 'RENEW VIP' : 'GET VIP',
    actionKey: null,
    coinAmount: null,
    vipDurationDays: 30,
    metadata: { benefits: ['Real rewards', 'Giveaways', 'Less levels, more prizes'] },
    effectivePrice: {
      audience: viewer.isVip ? 'vip' : 'base',
      currency: 'coins',
      amountMinor: 5,
      compareAtMinor: null,
      label: '5 COINS',
    },
    unlockRule: { unlockType: 'none', levelRequired: null, challengeId: null, claimOnce: true },
    isUnlocked: true,
    claimState: null,
  };

  const unlockItems: ShopCatalogItem[] = [
    {
      id: 'fallback-reward-mousepad',
      slug: 'fallback-reward-mousepad',
      kind: 'physical_reward',
      title: 'TAPPETINO',
      subtitle: 'LEVEL REWARD',
      description: 'Official OleBoy mousepad reward.',
      imagePath: '/shop/tappetino.png',
      ctaLabel: 'CLAIM',
      actionKey: null,
      coinAmount: null,
      vipDurationDays: null,
      metadata: {},
      effectivePrice: null,
      unlockRule: { unlockType: 'level', levelRequired: 15, challengeId: null, claimOnce: true },
      isUnlocked: viewer.level >= 15,
      claimState: null,
    },
    {
      id: 'fallback-reward-mouse',
      slug: 'fallback-reward-mouse',
      kind: 'physical_reward',
      title: 'MOUSE',
      subtitle: 'LEVEL REWARD',
      description: 'Official OleBoy mouse reward.',
      imagePath: '/shop/mouse.webp',
      ctaLabel: 'CLAIM',
      actionKey: null,
      coinAmount: null,
      vipDurationDays: null,
      metadata: {},
      effectivePrice: null,
      unlockRule: { unlockType: 'level', levelRequired: 30, challengeId: null, claimOnce: true },
      isUnlocked: viewer.level >= 30,
      claimState: null,
    },
  ];

  return {
    viewer,
    featuredCards: coinPackItems.slice(0, 5).map((item, index) =>
      createShopSurfaceCard({
        slotId: `fallback-featured-${index}`,
        surfaceKey: 'shop.featured_cards',
        sortOrder: index,
        cardVariant: 'coins',
        title: item.title,
        subtitle: item.subtitle,
        ctaLabel: item.ctaLabel,
        presentation: createDefaultShopPresentation({
          surfaceKey: 'shop.featured_cards',
          kind: item.kind,
          imagePath: item.imagePath,
        }),
        item,
      }),
    ),
    unlockCards: unlockItems.map((item, index) =>
      createShopSurfaceCard({
        slotId: `fallback-unlock-${index}`,
        surfaceKey: 'shop.unlock_cards',
        sortOrder: index,
        cardVariant: 'reward',
        title: item.title,
        subtitle: item.subtitle,
        ctaLabel: item.ctaLabel,
        presentation: createDefaultShopPresentation({
          surfaceKey: 'shop.unlock_cards',
          kind: item.kind,
          imagePath: item.imagePath,
          supportingText: item.description,
        }),
        item,
      }),
    ),
    coinPacks: coinPackItems,
    vipOffer,
  };
}

export function createFallbackAdminShopSeed(): ShopAdminSeed {
  const fallback = createFallbackShopCatalog();
  const itemMap = new Map<string, ShopAdminSeedItem>();

  const registerItem = (item: ShopCatalogItem) => {
    if (itemMap.has(item.id)) return;

    itemMap.set(item.id, {
      sourceKey: item.id,
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
      prices: item.effectivePrice
        ? [
            {
              audience: item.effectivePrice.audience,
              currency: item.effectivePrice.currency,
              amount_minor: item.effectivePrice.amountMinor,
              compare_at_minor: item.effectivePrice.compareAtMinor,
              is_active: true,
            },
          ]
        : [],
      unlock_rule:
        item.kind === 'physical_reward'
          ? {
              unlock_type: item.unlockRule.unlockType,
              level_required: item.unlockRule.levelRequired,
              challenge_id: item.unlockRule.challengeId,
              claim_once: item.unlockRule.claimOnce,
            }
          : undefined,
    });
  };

  fallback.coinPacks.forEach(registerItem);
  if (fallback.vipOffer) registerItem(fallback.vipOffer);
  fallback.unlockCards.forEach((card) => registerItem(card.item));

  const slots = [...fallback.featuredCards, ...fallback.unlockCards].map((card) => ({
    sourceKey: card.slotId,
    itemSourceKey: card.item.id,
    surface_key: card.surfaceKey,
    sort_order: card.sortOrder,
    card_variant: card.cardVariant,
    title_override: card.title === card.item.title ? '' : card.title,
    subtitle_override: card.subtitle === card.item.subtitle ? '' : card.subtitle,
    cta_label_override: card.ctaLabel === card.item.ctaLabel ? '' : card.ctaLabel,
    is_active: true,
    presentation: {
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
    },
  }));

  return {
    items: Array.from(itemMap.values()),
    slots,
  };
}

export function normalizeShopCatalogPayload(
  raw: unknown,
  viewerOverrides: Partial<ShopCatalogViewer> = {},
): ShopCatalogPayload {
  const fallback = createFallbackShopCatalog(viewerOverrides);
  const input = asObject(raw);
  const viewerInput = asObject(input.viewer);

  const viewer: ShopCatalogViewer = {
    userId: asString(viewerInput.user_id ?? viewerInput.userId) || fallback.viewer.userId,
    isAuthenticated: asBoolean(viewerInput.is_authenticated ?? viewerInput.isAuthenticated, fallback.viewer.isAuthenticated),
    isVip: asBoolean(viewerInput.is_vip ?? viewerInput.isVip, fallback.viewer.isVip),
    level: asNumber(viewerInput.level, fallback.viewer.level) ?? fallback.viewer.level,
    ...viewerOverrides,
  };

  const viewerFallback = createFallbackShopCatalog(viewer);
  const featuredCards = normalizeSurfaceCards(input.featured_cards ?? input.featuredCards, 'shop.featured_cards');
  const unlockCards = normalizeSurfaceCards(input.unlock_cards ?? input.unlockCards, 'shop.unlock_cards');
  const coinPacks = normalizeCatalogItems(input.coin_packs ?? input.coinPacks);
  const vipOffer = normalizeCatalogItem(input.vip_offer ?? input.vipOffer);

  return {
    viewer,
    featuredCards: featuredCards.length > 0 ? featuredCards : viewerFallback.featuredCards,
    unlockCards: unlockCards.length > 0 ? unlockCards : viewerFallback.unlockCards,
    coinPacks: coinPacks.length > 0 ? coinPacks : viewerFallback.coinPacks,
    vipOffer: vipOffer ?? viewerFallback.vipOffer,
  };
}

export function toShopCardViewModel(card: ShopSurfaceCard): ShopCardViewModel {
  const priceLabel = card.item.effectivePrice?.label ?? null;
  const priceCurrency = card.item.effectivePrice?.currency ?? null;
  const levelRequired = card.item.unlockRule.levelRequired;
  const challengeId = card.item.unlockRule.challengeId;
  const claimStatus = card.item.claimState?.status ?? null;
  const isClaimed = Boolean(claimStatus);
  const isLocked = card.item.kind === 'physical_reward' ? !card.item.isUnlocked && !isClaimed : false;
  const isUnlockSurface = card.surfaceKey === 'shop.unlock_cards';
  const primaryImage = card.presentation.primaryImagePath || card.item.imagePath;
  const resolvedSupportingText = card.item.description || card.presentation.supportingText;
  const badgeLabel = defaultShopBadgeLabel(card.item.kind);

  let unlockLabel: string | null = null;
  if (card.item.kind === 'physical_reward') {
    if (isClaimed && claimStatus) {
      unlockLabel = claimStatus.toUpperCase();
    } else if (isLocked && levelRequired) {
      unlockLabel = `LVL ${levelRequired}`;
    } else if (isLocked && challengeId) {
      unlockLabel = 'CHALLENGE';
    } else {
      unlockLabel = 'FREE CLAIM';
    }
  }

  return {
    id: card.item.id,
    slug: card.item.slug,
    slotId: card.slotId,
    surfaceKey: card.surfaceKey,
    sortOrder: card.sortOrder,
    cardVariant: card.cardVariant,
    templateKey: isUnlockSurface ? 'unlock-card' : 'featured-card',
    themeKey: 'default',
    title: card.title,
    subtitle: card.subtitle,
    description: card.item.description,
    supportingText: resolvedSupportingText,
    image: primaryImage,
    primaryImage,
    secondaryImage: '',
    kind: card.item.kind,
    ctaLabel: card.ctaLabel || card.item.ctaLabel,
    actionKey: card.item.actionKey,
    coinAmount: card.item.coinAmount,
    vipDurationDays: card.item.vipDurationDays,
    priceLabel,
    priceCurrency,
    unlockLabel,
    levelRequired,
    challengeId,
    isLocked,
    isClaimed,
    claimStatus,
    badgeLabel,
    showBadge: true,
    showSubtitle: false,
    showSupportingText: false,
    showSecondaryImage: false,
    metadata: {
      ...card.item.metadata,
      ...card.presentation.metadata,
    },
    searchText: [
      card.title,
      card.subtitle,
      resolvedSupportingText,
      card.item.description,
      priceLabel,
      unlockLabel,
      badgeLabel,
      card.item.kind,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
  };
}

export function mapCatalogToLevelRewards(catalog: ShopCatalogPayload): LevelReward[] {
  return catalog.unlockCards
    .filter((card) => card.item.kind === 'physical_reward')
    .map((card) => ({
      id: card.item.id,
      name: card.title,
      description: card.item.description,
      image: card.presentation.primaryImagePath || card.item.imagePath,
      imagePath: card.presentation.primaryImagePath || card.item.imagePath,
      levelRequired: card.item.unlockRule.levelRequired ?? 1,
      isActive: true,
    }));
}

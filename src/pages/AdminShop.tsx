import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Boxes,
  Package,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import {
  ADMIN_DIALOG_CLASS,
  ADMIN_FIELD_CLASS,
  ADMIN_INSET_PANEL_CLASS,
  ADMIN_OUTLINE_BUTTON_CLASS,
  AdminEmptyState,
  AdminPanel,
  AdminShell,
  AdminStatCard,
} from '@/components/admin/AdminShell';
import { ShopCardRail } from '@/components/shop/ShopCardRail';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  useAdminShopCatalog,
  type AdminShopChallengeRecord,
  type AdminShopItemRecord,
  type AdminShopPresentationRecord,
  type AdminShopSlotRecord,
} from '@/hooks/useAdminShopCatalog';
import { useShopClaims } from '@/hooks/useShopClaims';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  createDefaultShopPresentation,
  createShopSurfaceCard,
  formatShopMoneyLabel,
  normalizeShopPresentation,
  resolveShopCatalogImage,
  toShopCardViewModel,
  type ShopActionKey,
  type ShopCardTemplateKey,
  type ShopCardVariant,
  type ShopCardViewModel,
  type ShopItemKind,
  type ShopPrice,
  type ShopPriceAudience,
  type ShopPriceCurrency,
  type ShopSurfaceKey,
  type ShopUnlockType,
} from '@/lib/shopCatalog';

type ShopClaimStatus = 'pending' | 'approved' | 'fulfilled' | 'rejected' | 'cancelled';
type PreviewAudience = 'base' | 'vip';
type RewardPreviewState = 'locked' | 'unlocked' | 'claimed';

type EditorFormState = {
  itemId: string | null;
  slotId: string | null;
  presentationId: string | null;
  slug: string;
  kind: ShopItemKind;
  title: string;
  subtitle: string;
  description: string;
  ctaLabel: string;
  isActive: boolean;
  actionKey: ShopActionKey | '';
  coinAmount: string;
  vipDurationDays: string;
  priceCurrency: ShopPriceCurrency;
  basePrice: string;
  vipPrice: string;
  unlockType: ShopUnlockType;
  levelRequired: string;
  challengeId: string;
  claimOnce: boolean;
  itemImagePath: string;
  itemImagePreview: string;
  primaryImagePath: string;
  primaryImagePreview: string;
  secondaryImagePath: string;
  secondaryImagePreview: string;
  itemFile: File | null;
  primaryFile: File | null;
  secondaryFile: File | null;
  metadataBenefits: string;
  surfaceKey: ShopSurfaceKey;
  sortOrder: string;
  cardVariant: ShopCardVariant;
  titleOverride: string;
  subtitleOverride: string;
  ctaLabelOverride: string;
  slotActive: boolean;
  templateKey: ShopCardTemplateKey;
  themeKey: string;
  eyebrowText: string;
  supportingText: string;
  showBadge: boolean;
  showSubtitle: boolean;
  showSupportingText: boolean;
  showSecondaryImage: boolean;
};

const ITEM_KIND_OPTIONS: Array<{ value: ShopItemKind; label: string }> = [
  { value: 'coin_pack', label: 'Coin pack' },
  { value: 'vip_membership', label: 'VIP membership' },
  { value: 'physical_product', label: 'Physical product' },
  { value: 'physical_reward', label: 'Physical reward' },
  { value: 'action_card', label: 'Action card' },
];

const CLAIM_STATUS_OPTIONS: Array<{ value: ShopClaimStatus; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

function buildSafeFileName(file: File) {
  const extension = file.name.includes('.') ? file.name.split('.').pop() : 'png';
  const base = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_]+/g, '-').toLowerCase();
  return `shop-${Date.now()}-${base || 'item'}.${extension}`;
}

function priceCurrencyForKind(kind: ShopItemKind): ShopPriceCurrency {
  return kind === 'vip_membership' ? 'coins' : 'eur';
}

function defaultCardVariant(kind: ShopItemKind): ShopCardVariant {
  if (kind === 'physical_reward') return 'reward';
  if (kind === 'action_card') return 'action';
  return 'coins';
}

function defaultTemplateForSurface(surfaceKey: ShopSurfaceKey): ShopCardTemplateKey {
  return surfaceKey === 'shop.unlock_cards' ? 'unlock-card' : 'featured-card';
}

function deriveDefaultCta(kind: ShopItemKind) {
  switch (kind) {
    case 'coin_pack':
    case 'physical_product':
      return 'BUY NOW';
    case 'vip_membership':
      return 'GET VIP';
    case 'physical_reward':
      return 'CLAIM';
    case 'action_card':
      return 'OPEN';
    default:
      return '';
  }
}

function formatAdminPrice(amountMinor: number | null, currency: ShopPriceCurrency) {
  if (amountMinor === null || amountMinor === undefined) return '';
  if (currency === 'eur') return (amountMinor / 100).toFixed(2);
  return String(amountMinor);
}

function parseAdminPrice(value: string, currency: ShopPriceCurrency) {
  if (!value.trim()) return null;
  if (currency === 'eur') {
    const normalized = Number.parseFloat(value.replace(',', '.'));
    return Number.isFinite(normalized) ? Math.round(normalized * 100) : null;
  }

  const normalized = Number.parseInt(value, 10);
  return Number.isFinite(normalized) ? normalized : null;
}

function emptyEditorForm(surfaceKey: ShopSurfaceKey = 'shop.featured_cards'): EditorFormState {
  const kind: ShopItemKind = surfaceKey === 'shop.unlock_cards' ? 'physical_reward' : 'coin_pack';

  return {
    itemId: null,
    slotId: null,
    presentationId: null,
    slug: '',
    kind,
    title: '',
    subtitle: kind === 'physical_reward' ? 'LEVEL REWARD' : '',
    description: '',
    ctaLabel: deriveDefaultCta(kind),
    isActive: true,
    actionKey: '',
    coinAmount: '',
    vipDurationDays: '',
    priceCurrency: priceCurrencyForKind(kind),
    basePrice: '',
    vipPrice: '',
    unlockType: kind === 'physical_reward' ? 'level' : 'none',
    levelRequired: kind === 'physical_reward' ? '1' : '',
    challengeId: '',
    claimOnce: true,
    itemImagePath: '',
    itemImagePreview: '',
    primaryImagePath: '',
    primaryImagePreview: '',
    secondaryImagePath: '',
    secondaryImagePreview: '',
    itemFile: null,
    primaryFile: null,
    secondaryFile: null,
    metadataBenefits: '',
    surfaceKey,
    sortOrder: '0',
    cardVariant: defaultCardVariant(kind),
    titleOverride: '',
    subtitleOverride: '',
    ctaLabelOverride: '',
    slotActive: true,
    templateKey: defaultTemplateForSurface(surfaceKey),
    themeKey: 'default',
    eyebrowText: surfaceKey === 'shop.unlock_cards' ? 'UNLOCK' : 'COINS',
    supportingText: '',
    showBadge: true,
    showSubtitle: true,
    showSupportingText: surfaceKey === 'shop.unlock_cards',
    showSecondaryImage: false,
  };
}

function createEffectivePrice(audience: ShopPriceAudience, currency: ShopPriceCurrency, amountMinor: number | null): ShopPrice | null {
  if (amountMinor === null) return null;
  return {
    audience,
    currency,
    amountMinor,
    compareAtMinor: null,
    label: formatShopMoneyLabel(amountMinor, currency),
  };
}

function buildPreviewCard(
  form: EditorFormState,
  audience: PreviewAudience,
  rewardState: RewardPreviewState,
): ShopCardViewModel {
  const baseMinor = parseAdminPrice(form.basePrice, form.priceCurrency);
  const vipMinor = parseAdminPrice(form.vipPrice, form.priceCurrency);
  const itemImage = form.itemImagePreview || form.itemImagePath;
  const primaryImage = form.primaryImagePreview || form.primaryImagePath || itemImage;
  const secondaryImage = form.secondaryImagePreview || form.secondaryImagePath;

  const item = {
    id: form.itemId ?? 'preview-item',
    slug: form.slug || 'preview-item',
    kind: form.kind,
    title: form.title,
    subtitle: form.subtitle,
    description: form.description,
    imagePath: resolveShopCatalogImage(itemImage),
    ctaLabel: form.ctaLabel,
    actionKey: form.actionKey || null,
    coinAmount: form.kind === 'coin_pack' ? Number(form.coinAmount || '0') || null : null,
    vipDurationDays: form.kind === 'vip_membership' ? Number(form.vipDurationDays || '0') || null : null,
    metadata:
      form.kind === 'vip_membership' && form.metadataBenefits.trim()
        ? { benefits: form.metadataBenefits.split(',').map((entry) => entry.trim()).filter(Boolean) }
        : {},
    effectivePrice:
      form.kind === 'physical_reward' || form.kind === 'action_card'
        ? null
        : createEffectivePrice(
            audience,
            form.priceCurrency,
            audience === 'vip' ? (vipMinor ?? baseMinor) : baseMinor,
          ),
    unlockRule: {
      unlockType: form.kind === 'physical_reward' ? form.unlockType : 'none',
      levelRequired: form.kind === 'physical_reward' && form.unlockType === 'level' ? Number(form.levelRequired || '0') || null : null,
      challengeId: form.kind === 'physical_reward' && form.unlockType === 'challenge' ? form.challengeId || null : null,
      claimOnce: form.claimOnce,
    },
    isUnlocked: form.kind === 'physical_reward' ? rewardState !== 'locked' : true,
    claimState:
      form.kind === 'physical_reward' && rewardState === 'claimed'
        ? {
            id: 'preview-claim',
            status: 'approved' as const,
            requestedAt: null,
            resolvedAt: null,
            adminNote: '',
          }
        : null,
  };

  const presentation = normalizeShopPresentation(
    {
      template_key: form.templateKey,
      theme_key: form.themeKey,
      eyebrow_text: form.eyebrowText,
      supporting_text: form.supportingText,
      primary_image_path: primaryImage || itemImage,
      secondary_image_path: secondaryImage,
      show_badge: form.showBadge,
      show_subtitle: form.showSubtitle,
      show_supporting_text: form.showSupportingText,
      show_secondary_image: form.showSecondaryImage,
      metadata: {},
    },
    form.surfaceKey,
    form.kind,
    itemImage,
  );

  return toShopCardViewModel(
    createShopSurfaceCard({
      slotId: form.slotId ?? 'preview-slot',
      surfaceKey: form.surfaceKey,
      sortOrder: Number(form.sortOrder || '0'),
      cardVariant: form.cardVariant,
      title: form.titleOverride.trim() || form.title,
      subtitle: form.subtitleOverride.trim() || form.subtitle,
      ctaLabel: form.ctaLabelOverride.trim() || form.ctaLabel,
      presentation,
      item,
    }),
  );
}

function buildWorkspaceCard(
  item: AdminShopItemRecord,
  slot: AdminShopSlotRecord,
  presentation: AdminShopPresentationRecord | null,
  audience: PreviewAudience = 'base',
): ShopCardViewModel {
  const basePrice = item.prices.find((price) => price.audience === 'base' && price.is_active);
  const vipPrice = item.prices.find((price) => price.audience === 'vip' && price.is_active);

  const effectivePrice =
    item.kind === 'physical_reward' || item.kind === 'action_card'
      ? null
      : createEffectivePrice(
          audience,
          (vipPrice?.currency ?? basePrice?.currency ?? priceCurrencyForKind(item.kind)) as ShopPriceCurrency,
          audience === 'vip'
            ? (vipPrice?.amount_minor ?? basePrice?.amount_minor ?? null)
            : (basePrice?.amount_minor ?? null),
        );

  const resolvedPresentation = presentation
    ? normalizeShopPresentation(presentation, slot.surface_key, item.kind, item.image_path)
    : createDefaultShopPresentation({
        surfaceKey: slot.surface_key,
        kind: item.kind,
        imagePath: item.image_path,
        supportingText: slot.surface_key === 'shop.unlock_cards' ? item.description : '',
      });

  return toShopCardViewModel(
    createShopSurfaceCard({
      slotId: slot.id,
      surfaceKey: slot.surface_key,
      sortOrder: slot.sort_order,
      cardVariant: slot.card_variant,
      title: slot.title_override.trim() || item.title,
      subtitle: slot.subtitle_override.trim() || item.subtitle,
      ctaLabel: slot.cta_label_override.trim() || item.cta_label,
      presentation: resolvedPresentation,
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
        effectivePrice,
        unlockRule: {
          unlockType: item.unlockRule?.unlock_type ?? 'none',
          levelRequired: item.unlockRule?.level_required ?? null,
          challengeId: item.unlockRule?.challenge_id ?? null,
          claimOnce: item.unlockRule?.claim_once ?? true,
        },
        isUnlocked: item.kind === 'physical_reward' ? false : true,
        claimState: null,
      },
    }),
  );
}

function createEditorForm(
  item: AdminShopItemRecord,
  slot: AdminShopSlotRecord | null,
  presentation: AdminShopPresentationRecord | null,
): EditorFormState {
  const primaryCurrency = item.prices[0]?.currency ?? priceCurrencyForKind(item.kind);
  const basePrice = item.prices.find((price) => price.audience === 'base');
  const vipPrice = item.prices.find((price) => price.audience === 'vip');
  const metadataBenefits = Array.isArray(item.metadata?.benefits)
    ? (item.metadata.benefits as string[]).join(', ')
    : '';

  return {
    itemId: item.id,
    slotId: slot?.id ?? null,
    presentationId: presentation?.id ?? null,
    slug: item.slug,
    kind: item.kind,
    title: item.title,
    subtitle: item.subtitle,
    description: item.description,
    ctaLabel: item.cta_label,
    isActive: item.is_active,
    actionKey: item.action_key ?? '',
    coinAmount: item.coin_amount ? String(item.coin_amount) : '',
    vipDurationDays: item.vip_duration_days ? String(item.vip_duration_days) : '',
    priceCurrency: primaryCurrency,
    basePrice: formatAdminPrice(basePrice?.amount_minor ?? null, primaryCurrency),
    vipPrice: formatAdminPrice(vipPrice?.amount_minor ?? null, primaryCurrency),
    unlockType: item.unlockRule?.unlock_type ?? 'none',
    levelRequired: item.unlockRule?.level_required ? String(item.unlockRule.level_required) : '',
    challengeId: item.unlockRule?.challenge_id ?? '',
    claimOnce: item.unlockRule?.claim_once ?? true,
    itemImagePath: item.image_path,
    itemImagePreview: resolveShopCatalogImage(item.image_path),
    primaryImagePath: presentation?.primary_image_path || '',
    primaryImagePreview: presentation?.primary_image_path ? resolveShopCatalogImage(presentation.primary_image_path) : '',
    secondaryImagePath: presentation?.secondary_image_path || '',
    secondaryImagePreview: presentation?.secondary_image_path ? resolveShopCatalogImage(presentation.secondary_image_path) : '',
    itemFile: null,
    primaryFile: null,
    secondaryFile: null,
    metadataBenefits,
    surfaceKey: slot?.surface_key ?? (item.kind === 'physical_reward' ? 'shop.unlock_cards' : 'shop.featured_cards'),
    sortOrder: slot ? String(slot.sort_order) : '0',
    cardVariant: slot?.card_variant ?? defaultCardVariant(item.kind),
    titleOverride: slot?.title_override ?? '',
    subtitleOverride: slot?.subtitle_override ?? '',
    ctaLabelOverride: slot?.cta_label_override ?? '',
    slotActive: slot?.is_active ?? true,
    templateKey: presentation?.template_key ?? defaultTemplateForSurface(slot?.surface_key ?? 'shop.featured_cards'),
    themeKey: presentation?.theme_key ?? 'default',
    eyebrowText: presentation?.eyebrow_text ?? (item.kind === 'physical_reward' ? 'UNLOCK' : item.kind === 'vip_membership' ? 'VIP' : 'COINS'),
    supportingText: presentation?.supporting_text ?? '',
    showBadge: presentation?.show_badge ?? true,
    showSubtitle: presentation?.show_subtitle ?? true,
    showSupportingText: presentation?.show_supporting_text ?? ((slot?.surface_key ?? 'shop.featured_cards') === 'shop.unlock_cards'),
    showSecondaryImage: presentation?.show_secondary_image ?? false,
  };
}

export default function AdminShop() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const {
    items,
    slots,
    presentations,
    challenges,
    isLoading,
    refetch,
    saveItem,
    saveSlot,
    setItemActive,
    publishCatalog,
    hasUnpublishedChanges,
    savingItem,
    savingSlot,
    togglingItem,
    publishingCatalog,
  } = useAdminShopCatalog();
  const { claims, updateClaim, updatingClaim } = useShopClaims();

  const [activeTab, setActiveTab] = useState('studio');
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorForm, setEditorForm] = useState<EditorFormState>(emptyEditorForm());
  const [previewAudience, setPreviewAudience] = useState<PreviewAudience>('base');
  const [rewardPreviewState, setRewardPreviewState] = useState<RewardPreviewState>('locked');
  const [claimNotes, setClaimNotes] = useState<Record<string, string>>({});

  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const presentationMap = useMemo(() => new Map(presentations.map((presentation) => [presentation.slot_id, presentation])), [presentations]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) =>
      [item.title, item.slug, item.kind, item.subtitle]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [items, search]);

  const featuredSlots = useMemo(
    () => slots.filter((slot) => slot.surface_key === 'shop.featured_cards').sort((a, b) => a.sort_order - b.sort_order),
    [slots],
  );
  const unlockSlots = useMemo(
    () => slots.filter((slot) => slot.surface_key === 'shop.unlock_cards').sort((a, b) => a.sort_order - b.sort_order),
    [slots],
  );

  const featuredCards = useMemo(
    () =>
      featuredSlots
        .map((slot) => {
          const item = itemMap.get(slot.item_id);
          if (!item) return null;
          return buildWorkspaceCard(item, slot, presentationMap.get(slot.id) ?? null, 'base');
        })
        .filter((entry): entry is ShopCardViewModel => Boolean(entry)),
    [featuredSlots, itemMap, presentationMap],
  );

  const unlockCards = useMemo(
    () =>
      unlockSlots
        .map((slot) => {
          const item = itemMap.get(slot.item_id);
          if (!item) return null;
          return buildWorkspaceCard(item, slot, presentationMap.get(slot.id) ?? null, 'base');
        })
        .filter((entry): entry is ShopCardViewModel => Boolean(entry)),
    [unlockSlots, itemMap, presentationMap],
  );

  const previewCard = useMemo(
    () => buildPreviewCard(editorForm, previewAudience, rewardPreviewState),
    [editorForm, previewAudience, rewardPreviewState],
  );

  const featuredCount = featuredSlots.length;
  const unlockCount = unlockSlots.length;
  const pendingClaimsCount = claims.filter((claim) => claim.status === 'pending').length;

  const openNewCardEditor = (surfaceKey: ShopSurfaceKey) => {
    const nextSortOrder = surfaceKey === 'shop.featured_cards' ? featuredCount : unlockCount;
    const next = emptyEditorForm(surfaceKey);
    next.sortOrder = String(nextSortOrder);
    setEditorForm(next);
    setPreviewAudience('base');
    setRewardPreviewState(surfaceKey === 'shop.unlock_cards' ? 'locked' : 'unlocked');
    setEditorOpen(true);
  };

  const openSlotEditor = (slot: AdminShopSlotRecord) => {
    const item = itemMap.get(slot.item_id);
    if (!item) return;
    const presentation = presentationMap.get(slot.id) ?? null;
    setEditorForm(createEditorForm(item, slot, presentation));
    setPreviewAudience('base');
    setRewardPreviewState(slot.surface_key === 'shop.unlock_cards' ? 'locked' : 'unlocked');
    setEditorOpen(true);
  };

  const openItemEditor = (item: AdminShopItemRecord) => {
    const linkedSlot = slots.find((slot) => slot.item_id === item.id) ?? null;
    const presentation = linkedSlot ? presentationMap.get(linkedSlot.id) ?? null : null;
    const nextForm = createEditorForm(item, linkedSlot, presentation);
    if (!linkedSlot) {
      nextForm.surfaceKey = item.kind === 'physical_reward' ? 'shop.unlock_cards' : 'shop.featured_cards';
      nextForm.sortOrder = String(
        nextForm.surfaceKey === 'shop.unlock_cards' ? unlockCount : featuredCount,
      );
    }
    setEditorForm(nextForm);
    setPreviewAudience('base');
    setRewardPreviewState(item.kind === 'physical_reward' ? 'locked' : 'unlocked');
    setEditorOpen(true);
  };

  useEffect(() => {
    const slotId = searchParams.get('slot');
    const itemId = searchParams.get('item');
    if (!slotId && !itemId) return;
    if (items.length === 0 && slots.length === 0) return;

    const targetSlot = slotId ? slots.find((entry) => entry.id === slotId) : null;
    const targetItem = targetSlot
      ? itemMap.get(targetSlot.item_id)
      : itemId
        ? itemMap.get(itemId)
        : null;

    if (targetSlot && targetItem) {
      openSlotEditor(targetSlot);
      setActiveTab('studio');
      setSearchParams({});
      return;
    }

    if (targetItem) {
      openItemEditor(targetItem);
      setActiveTab('catalog');
      setSearchParams({});
    }
  }, [items, slots, searchParams, setSearchParams, itemMap]);

  const uploadShopAsset = async (file: File | null) => {
    if (!file) return '';

    const path = buildSafeFileName(file);
    const { error } = await supabase.storage.from('shop-catalog').upload(path, file, {
      upsert: false,
      contentType: file.type || 'image/png',
    });
    if (error) throw error;
    return path;
  };

  const handleSaveCard = async () => {
    try {
      if (!editorForm.title.trim() || !editorForm.slug.trim()) {
        throw new Error('Title and slug are required.');
      }

      if (!editorForm.itemImagePath && !editorForm.itemFile) {
        throw new Error('An item image is required.');
      }

      if (editorForm.surfaceKey === 'shop.unlock_cards' && editorForm.kind !== 'physical_reward') {
        throw new Error('Only physical rewards can be placed in the unlock row.');
      }

      if (editorForm.surfaceKey === 'shop.featured_cards' && editorForm.kind === 'physical_reward') {
        throw new Error('Physical rewards must stay in the unlock row.');
      }

      const baseMinor = parseAdminPrice(editorForm.basePrice, editorForm.priceCurrency);
      const vipMinor = parseAdminPrice(editorForm.vipPrice, editorForm.priceCurrency);

      if (
        (editorForm.kind === 'coin_pack' || editorForm.kind === 'vip_membership' || editorForm.kind === 'physical_product')
        && baseMinor === null
      ) {
        throw new Error('A base price is required for this card.');
      }

      if (baseMinor !== null && vipMinor !== null && vipMinor > baseMinor) {
        throw new Error('VIP price must be lower than or equal to the base price.');
      }

      if (editorForm.kind === 'coin_pack' && Number(editorForm.coinAmount || '0') <= 0) {
        throw new Error('Coin packs require a valid coin amount.');
      }

      if (editorForm.kind === 'vip_membership' && Number(editorForm.vipDurationDays || '0') <= 0) {
        throw new Error('VIP memberships require a valid duration in days.');
      }

      if (editorForm.kind === 'physical_reward' && editorForm.unlockType === 'none') {
        throw new Error('Physical rewards require an unlock rule.');
      }

      if (editorForm.kind === 'physical_reward' && editorForm.unlockType === 'level' && Number(editorForm.levelRequired || '0') < 1) {
        throw new Error('Level unlocks require a level greater than or equal to 1.');
      }

      if (editorForm.kind === 'physical_reward' && editorForm.unlockType === 'challenge' && !editorForm.challengeId) {
        throw new Error('Select a challenge for challenge-based rewards.');
      }

      if (editorForm.kind === 'action_card' && !editorForm.actionKey) {
        throw new Error('Action cards require an action key.');
      }

      const uploadedItemImagePath = await uploadShopAsset(editorForm.itemFile);
      const uploadedPrimaryImagePath = await uploadShopAsset(editorForm.primaryFile);
      const uploadedSecondaryImagePath = await uploadShopAsset(editorForm.secondaryFile);

      const finalItemImagePath = uploadedItemImagePath || editorForm.itemImagePath;
      const finalPrimaryImagePath = uploadedPrimaryImagePath || editorForm.primaryImagePath || finalItemImagePath;
      const finalSecondaryImagePath = uploadedSecondaryImagePath || editorForm.secondaryImagePath;

      const prices =
        editorForm.kind === 'physical_reward' || editorForm.kind === 'action_card'
          ? []
          : [
              baseMinor !== null
                ? {
                    audience: 'base' as ShopPriceAudience,
                    currency: editorForm.priceCurrency,
                    amount_minor: baseMinor,
                    is_active: true,
                  }
                : null,
              vipMinor !== null
                ? {
                    audience: 'vip' as ShopPriceAudience,
                    currency: editorForm.priceCurrency,
                    amount_minor: vipMinor,
                    is_active: true,
                  }
                : null,
            ].filter(Boolean);

      const itemResult = await saveItem({
        id: editorForm.itemId,
        slug: editorForm.slug.trim(),
        kind: editorForm.kind,
        title: editorForm.title.trim(),
        subtitle: editorForm.subtitle.trim(),
        description: editorForm.description.trim(),
        image_path: finalItemImagePath,
        cta_label: editorForm.ctaLabel.trim() || deriveDefaultCta(editorForm.kind),
        is_active: editorForm.isActive,
        action_key: editorForm.kind === 'action_card' ? editorForm.actionKey : null,
        coin_amount: editorForm.kind === 'coin_pack' ? Number(editorForm.coinAmount || '0') : null,
        vip_duration_days: editorForm.kind === 'vip_membership' ? Number(editorForm.vipDurationDays || '0') : null,
        metadata:
          editorForm.kind === 'vip_membership' && editorForm.metadataBenefits.trim()
            ? { benefits: editorForm.metadataBenefits.split(',').map((entry) => entry.trim()).filter(Boolean) }
            : {},
        prices,
        unlock_rule:
          editorForm.kind === 'physical_reward'
            ? {
                unlock_type: editorForm.unlockType,
                level_required: editorForm.unlockType === 'level' ? Number(editorForm.levelRequired || '0') : null,
                challenge_id: editorForm.unlockType === 'challenge' ? editorForm.challengeId || null : null,
                claim_once: editorForm.claimOnce,
              }
            : undefined,
      }) as { id?: string };

      const itemId = itemResult?.id ?? editorForm.itemId;
      if (!itemId) {
        throw new Error('Missing draft item id after save.');
      }

      await saveSlot({
        id: editorForm.slotId,
        surface_key: editorForm.surfaceKey,
        sort_order: Number(editorForm.sortOrder || '0'),
        item_id: itemId,
        card_variant: editorForm.surfaceKey === 'shop.unlock_cards' ? 'reward' : editorForm.cardVariant,
        title_override: editorForm.titleOverride.trim(),
        subtitle_override: editorForm.subtitleOverride.trim(),
        cta_label_override: editorForm.ctaLabelOverride.trim(),
        is_active: editorForm.slotActive,
        presentation: {
          template_key: editorForm.templateKey,
          theme_key: editorForm.themeKey,
          eyebrow_text: editorForm.eyebrowText.trim(),
          supporting_text: editorForm.supportingText.trim(),
          primary_image_path: finalPrimaryImagePath,
          secondary_image_path: finalSecondaryImagePath,
          show_badge: editorForm.showBadge,
          show_subtitle: editorForm.showSubtitle,
          show_supporting_text: editorForm.showSupportingText,
          show_secondary_image: editorForm.showSecondaryImage,
          metadata: {},
        },
      });

      toast({
        title: editorForm.slotId ? 'Draft card updated' : 'Draft card created',
        description: editorForm.title,
      });
      setEditorOpen(false);
      setEditorForm(emptyEditorForm());
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Unable to save draft shop card.',
        variant: 'destructive',
      });
    }
  };

  const handleToggleItem = async (item: AdminShopItemRecord) => {
    try {
      await setItemActive({ itemId: item.id, isActive: !item.is_active });
      toast({
        title: item.is_active ? 'Draft item deactivated' : 'Draft item activated',
        description: item.title,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Unable to change draft item status.',
        variant: 'destructive',
      });
    }
  };

  const handlePublish = async () => {
    try {
      await publishCatalog();
      toast({
        title: 'Shop published',
        description: 'Live /shop now uses the current draft workspace.',
      });
    } catch (error: any) {
      toast({
        title: 'Publish error',
        description: error?.message || 'Unable to publish the draft shop.',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateClaim = async (claimId: string, status: ShopClaimStatus) => {
    try {
      await updateClaim({
        claimId,
        status,
        adminNote: claimNotes[claimId] ?? '',
      });
      toast({
        title: 'Claim updated',
        description: status,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Unable to update claim.',
        variant: 'destructive',
      });
    }
  };

  const rewardChallenges = challenges as AdminShopChallengeRecord[];

  return (
    <AdminShell
      title="Shop Workspace"
      description="Draft-first visual editing for every public shop card, with preview and one-click publish."
      actions={
        <>
          <Button variant="outline" onClick={() => refetch()} className={`h-11 ${ADMIN_OUTLINE_BUTTON_CLASS}`}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => openNewCardEditor('shop.featured_cards')}
            className={`h-11 ${ADMIN_OUTLINE_BUTTON_CLASS}`}
          >
            <Plus className="mr-2 h-4 w-4" />
            New featured card
          </Button>
          <Button
            variant="outline"
            onClick={() => openNewCardEditor('shop.unlock_cards')}
            className={`h-11 ${ADMIN_OUTLINE_BUTTON_CLASS}`}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            New unlock card
          </Button>
          <Button
            onClick={handlePublish}
            disabled={publishingCatalog || !hasUnpublishedChanges}
            className="h-11 bg-[#ff1654] text-white hover:bg-[#ff1654]/90"
          >
            {publishingCatalog ? 'Publishing...' : 'Publish shop'}
          </Button>
        </>
      }
    >
      <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="grid min-h-0 gap-4 xl:grid-rows-[repeat(4,minmax(0,120px))_minmax(0,1fr)]">
          <AdminStatCard label="Draft items" value={String(items.length)} icon={Package} />
          <AdminStatCard label="Featured cards" value={String(featuredCount)} icon={Boxes} accent="#72d2ff" />
          <AdminStatCard label="Unlock cards" value={String(unlockCount)} icon={ShieldCheck} accent="#72f1b8" />
          <AdminStatCard label="Pending claims" value={String(pendingClaimsCount)} icon={Sparkles} accent="#ff8a65" />

          <AdminPanel
            title="Workspace status"
            description="The public shop reads only live data. This editor changes the draft until you publish."
            className="min-h-0"
            contentClassName="min-h-0 overflow-y-auto pr-1"
          >
            <div className="space-y-3 text-sm leading-6 text-white/58">
              <p className={hasUnpublishedChanges ? 'text-[#ff8ead]' : 'text-[#72f1b8]'}>
                {hasUnpublishedChanges ? 'Unpublished changes detected in draft.' : 'Draft and live shop are in sync.'}
              </p>
              <p>Click any card in the studio rows to edit the exact frontend UI, copy, pricing, images, and reward state.</p>
              <p>If a row grows past five cards, the live page and the preview both switch to the marquee rail used on the logged-in home shop section.</p>
            </div>
          </AdminPanel>
        </div>

        <AdminPanel
          title="Admin shop"
          description="Use the visual studio first; the catalog tab remains available for quick search and review."
          className="h-full"
          contentClassName="min-h-0 h-full overflow-y-auto pr-1"
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full min-h-0 flex-col">
            <TabsList className="mb-4 w-fit bg-[#171012]">
              <TabsTrigger value="studio">Studio</TabsTrigger>
              <TabsTrigger value="catalog">Catalog</TabsTrigger>
              <TabsTrigger value="claims">Claims</TabsTrigger>
            </TabsList>

            <TabsContent value="studio" className="mt-0 min-h-0 flex-1">
              <div className="space-y-6">
                <div className={`min-h-0 overflow-hidden ${ADMIN_INSET_PANEL_CLASS}`}>
                  <div className="flex items-start justify-between gap-4 border-b border-[#2b1a1f] px-4 py-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Featured row</h3>
                      <p className="mt-1 text-sm leading-6 text-white/52">
                        Figma-accurate desktop cards. Click a card to edit content and live preview UI.
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => openNewCardEditor('shop.featured_cards')} className={ADMIN_OUTLINE_BUTTON_CLASS}>
                      Add card
                    </Button>
                  </div>
                  <div className="p-4">
                    {featuredCards.length === 0 ? (
                      <AdminEmptyState title="No featured cards yet" description="Create the first purchasable shop card." />
                    ) : (
                      <ShopCardRail cards={featuredCards} onAction={(card) => {
                        const slot = featuredSlots.find((entry) => entry.id === card.slotId);
                        if (slot) openSlotEditor(slot);
                      }} />
                    )}
                  </div>
                </div>

                <div className={`min-h-0 overflow-hidden ${ADMIN_INSET_PANEL_CLASS}`}>
                  <div className="flex items-start justify-between gap-4 border-b border-[#2b1a1f] px-4 py-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Unlock row</h3>
                      <p className="mt-1 text-sm leading-6 text-white/52">
                        Physical rewards only. The template stays reward-focused while matching the shared card system.
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => openNewCardEditor('shop.unlock_cards')} className={ADMIN_OUTLINE_BUTTON_CLASS}>
                      Add reward
                    </Button>
                  </div>
                  <div className="p-4">
                    {unlockCards.length === 0 ? (
                      <AdminEmptyState title="No unlock cards yet" description="Add the first level or challenge reward." />
                    ) : (
                      <ShopCardRail cards={unlockCards} onAction={(card) => {
                        const slot = unlockSlots.find((entry) => entry.id === card.slotId);
                        if (slot) openSlotEditor(slot);
                      }} />
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="catalog" className="mt-0 min-h-0 flex-1">
              <div className="mb-4 flex flex-wrap gap-3">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search draft items by title, slug, kind..."
                  className={`${ADMIN_FIELD_CLASS} max-w-[380px]`}
                />
              </div>

              {filteredItems.length === 0 && !isLoading ? (
                <AdminEmptyState
                  title="No draft items yet"
                  description="Start from the studio by creating a featured or unlock card."
                />
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {filteredItems.map((item) => {
                    const imageSrc = resolveShopCatalogImage(item.image_path);
                    const basePrice = item.prices.find((price) => price.audience === 'base');
                    const vipPrice = item.prices.find((price) => price.audience === 'vip');
                    const linkedSlot = slots.find((slot) => slot.item_id === item.id);

                    return (
                      <div key={item.id} className="rounded-[24px] border border-[#302025] bg-[#1c1c1c] p-4">
                        <div className="flex flex-col gap-4 2xl:flex-row">
                          <div className="flex h-[148px] w-full items-center justify-center overflow-hidden rounded-[18px] border border-white/10 bg-[#1a0808] 2xl:w-[180px]">
                            {imageSrc ? (
                              <img src={imageSrc} alt={item.title} className="h-full w-full object-contain p-4" />
                            ) : (
                              <UploadCloud className="h-8 w-8 text-white/28" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                              <span className="rounded-full border border-[#39242b] bg-[#171012] px-2.5 py-1 text-xs uppercase tracking-[0.2em] text-[#b7afb2]">
                                {item.kind}
                              </span>
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs uppercase tracking-[0.2em] ${
                                  item.is_active ? 'bg-[#72f1b8]/16 text-[#72f1b8]' : 'bg-white/8 text-white/46'
                                }`}
                              >
                                {item.is_active ? 'Draft active' : 'Draft inactive'}
                              </span>
                            </div>

                            <p className="mt-2 text-sm uppercase tracking-[0.16em] text-white/38">{item.slug}</p>
                            <p className="mt-3 text-sm leading-6 text-white/56">{item.description || 'No description set.'}</p>

                            <div className="mt-4 grid gap-2 text-sm text-white/64 sm:grid-cols-2">
                              <div>
                                Base: <span className="font-semibold text-white">{basePrice ? formatShopMoneyLabel(basePrice.amount_minor, basePrice.currency) : 'N/A'}</span>
                              </div>
                              <div>
                                VIP: <span className="font-semibold text-white">{vipPrice ? formatShopMoneyLabel(vipPrice.amount_minor, vipPrice.currency) : 'Same as base'}</span>
                              </div>
                              <div>
                                Surface: <span className="font-semibold text-white">{linkedSlot?.surface_key ?? 'Not placed yet'}</span>
                              </div>
                              <div>
                                Order: <span className="font-semibold text-white">{linkedSlot ? linkedSlot.sort_order : '-'}</span>
                              </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <Button variant="outline" onClick={() => openItemEditor(item)} className={ADMIN_OUTLINE_BUTTON_CLASS}>
                                Open editor
                              </Button>
                              <Button variant="outline" onClick={() => handleToggleItem(item)} className={ADMIN_OUTLINE_BUTTON_CLASS}>
                                {item.is_active ? 'Deactivate' : 'Activate'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="claims" className="mt-0 min-h-0 flex-1">
              {claims.length === 0 ? (
                <AdminEmptyState title="No reward claims yet" description="User reward claims will appear here for moderation." />
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {claims.map((claim) => (
                    <div key={claim.id} className="rounded-[24px] border border-[#302025] bg-[#1c1c1c] p-4">
                      <div className="flex items-center gap-4">
                        {claim.itemImage ? (
                          <img src={resolveShopCatalogImage(claim.itemImage)} alt={claim.itemTitle} className="h-[82px] w-[82px] rounded-[16px] border border-white/10 bg-[#1a0808] object-contain p-2" />
                        ) : (
                          <div className="flex h-[82px] w-[82px] items-center justify-center rounded-[16px] border border-white/10 bg-[#1a0808] text-white/22">
                            <ShieldCheck className="h-6 w-6" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="text-lg font-semibold text-white">{claim.itemTitle}</h3>
                          <p className="text-sm uppercase tracking-[0.18em] text-white/42">{claim.itemSlug}</p>
                          <p className="mt-2 text-sm text-white/58">Status: {claim.status}</p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <label className="text-sm text-white/62">Admin note</label>
                        <Textarea
                          value={claimNotes[claim.id] ?? claim.admin_note}
                          onChange={(event) =>
                            setClaimNotes((current) => ({
                              ...current,
                              [claim.id]: event.target.value,
                            }))
                          }
                          className={`${ADMIN_FIELD_CLASS} mt-2 min-h-[110px]`}
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {CLAIM_STATUS_OPTIONS.map((option) => (
                          <Button
                            key={option.value}
                            variant="outline"
                            onClick={() => handleUpdateClaim(claim.id, option.value)}
                            disabled={updatingClaim}
                            className={ADMIN_OUTLINE_BUTTON_CLASS}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </AdminPanel>
      </div>

      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) {
            setSearchParams({});
          }
        }}
      >
        <DialogContent className={`${ADMIN_DIALOG_CLASS} max-h-[92vh] overflow-y-auto sm:max-w-[1180px]`}>
          <DialogHeader>
            <DialogTitle>{editorForm.slotId ? 'Edit draft shop card' : 'Create draft shop card'}</DialogTitle>
            <DialogDescription className="text-white/56">
              Edit the exact frontend card content and preview it before publishing to the live shop.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-2 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="grid gap-5">
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="grid gap-2">
                  <label className="text-sm text-white/64">Surface</label>
                  <select
                    value={editorForm.surfaceKey}
                    onChange={(event) => {
                      const surfaceKey = event.target.value as ShopSurfaceKey;
                      setEditorForm((current) => ({
                        ...current,
                        surfaceKey,
                        kind: surfaceKey === 'shop.unlock_cards' ? 'physical_reward' : current.kind === 'physical_reward' ? 'coin_pack' : current.kind,
                        priceCurrency: surfaceKey === 'shop.unlock_cards' ? 'eur' : current.priceCurrency,
                        cardVariant: surfaceKey === 'shop.unlock_cards' ? 'reward' : defaultCardVariant(current.kind === 'physical_reward' ? 'coin_pack' : current.kind),
                        templateKey: defaultTemplateForSurface(surfaceKey),
                        eyebrowText: surfaceKey === 'shop.unlock_cards' ? 'UNLOCK' : current.kind === 'vip_membership' ? 'VIP' : 'COINS',
                        showSupportingText: surfaceKey === 'shop.unlock_cards' ? true : current.showSupportingText,
                      }));
                    }}
                    className={`${ADMIN_FIELD_CLASS} h-12 rounded-[16px] bg-[#171012] px-4 text-white`}
                  >
                    <option value="shop.featured_cards">Top row / featured cards</option>
                    <option value="shop.unlock_cards">Bottom row / unlock cards</option>
                  </select>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm text-white/64">Kind</label>
                  <select
                    value={editorForm.kind}
                    onChange={(event) => {
                      const kind = event.target.value as ShopItemKind;
                      setEditorForm((current) => ({
                        ...current,
                        kind,
                        priceCurrency: priceCurrencyForKind(kind),
                        ctaLabel: deriveDefaultCta(kind),
                        actionKey: kind === 'action_card' ? current.actionKey : '',
                        unlockType: kind === 'physical_reward' ? current.unlockType : 'none',
                        cardVariant: current.surfaceKey === 'shop.unlock_cards' ? 'reward' : defaultCardVariant(kind),
                        eyebrowText: current.surfaceKey === 'shop.unlock_cards'
                          ? 'UNLOCK'
                          : kind === 'vip_membership'
                            ? 'VIP'
                            : kind === 'physical_product'
                              ? 'MERCH'
                              : kind === 'action_card'
                                ? 'ACTION'
                                : 'COINS',
                      }));
                    }}
                    className={`${ADMIN_FIELD_CLASS} h-12 rounded-[16px] bg-[#171012] px-4 text-white`}
                    disabled={editorForm.surfaceKey === 'shop.unlock_cards'}
                  >
                    {ITEM_KIND_OPTIONS.filter((option) => editorForm.surfaceKey !== 'shop.unlock_cards' || option.value === 'physical_reward').map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm text-white/64">Sort order</label>
                  <Input
                    value={editorForm.sortOrder}
                    onChange={(event) => setEditorForm((current) => ({ ...current, sortOrder: event.target.value }))}
                    className={ADMIN_FIELD_CLASS}
                  />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="grid gap-2">
                  <label className="text-sm text-white/64">Slug</label>
                  <Input value={editorForm.slug} onChange={(event) => setEditorForm((current) => ({ ...current, slug: event.target.value }))} className={ADMIN_FIELD_CLASS} />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm text-white/64">CTA label</label>
                  <Input value={editorForm.ctaLabel} onChange={(event) => setEditorForm((current) => ({ ...current, ctaLabel: event.target.value }))} className={ADMIN_FIELD_CLASS} />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="grid gap-2">
                  <label className="text-sm text-white/64">Title</label>
                  <Input value={editorForm.title} onChange={(event) => setEditorForm((current) => ({ ...current, title: event.target.value }))} className={ADMIN_FIELD_CLASS} />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm text-white/64">Subtitle</label>
                  <Input value={editorForm.subtitle} onChange={(event) => setEditorForm((current) => ({ ...current, subtitle: event.target.value }))} className={ADMIN_FIELD_CLASS} />
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-sm text-white/64">Description</label>
                <Textarea value={editorForm.description} onChange={(event) => setEditorForm((current) => ({ ...current, description: event.target.value }))} className={`${ADMIN_FIELD_CLASS} min-h-[100px]`} />
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
                <div className="grid gap-2">
                  <label className="text-sm text-white/64">Item image path or upload</label>
                  <Input
                    value={editorForm.itemImagePath}
                    onChange={(event) =>
                      setEditorForm((current) => ({
                        ...current,
                        itemImagePath: event.target.value,
                        itemImagePreview: resolveShopCatalogImage(event.target.value),
                      }))
                    }
                    className={ADMIN_FIELD_CLASS}
                  />
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setEditorForm((current) => ({
                        ...current,
                        itemFile: file,
                        itemImagePreview: file ? URL.createObjectURL(file) : current.itemImagePreview,
                      }));
                    }}
                    className={ADMIN_FIELD_CLASS}
                  />
                </div>

                <div className="flex h-[140px] items-center justify-center overflow-hidden rounded-[18px] border border-white/10 bg-[#171012]">
                  {editorForm.itemImagePreview ? (
                    <img src={editorForm.itemImagePreview} alt="Item preview" className="h-full w-full object-contain p-4" />
                  ) : (
                    <UploadCloud className="h-7 w-7 text-white/28" />
                  )}
                </div>
              </div>

              <div className="rounded-[22px] border border-[#302025] bg-[#171012] p-4">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-white">Frontend card UI</h3>
                    <p className="mt-1 text-sm leading-6 text-white/52">Everything visible on the live card can be edited here before publish.</p>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm text-white/64">Eyebrow / badge text</label>
                    <Input value={editorForm.eyebrowText} onChange={(event) => setEditorForm((current) => ({ ...current, eyebrowText: event.target.value }))} className={ADMIN_FIELD_CLASS} />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm text-white/64">Supporting text</label>
                    <Input value={editorForm.supportingText} onChange={(event) => setEditorForm((current) => ({ ...current, supportingText: event.target.value }))} className={ADMIN_FIELD_CLASS} />
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm text-white/64">Title override</label>
                    <Input value={editorForm.titleOverride} onChange={(event) => setEditorForm((current) => ({ ...current, titleOverride: event.target.value }))} className={ADMIN_FIELD_CLASS} />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm text-white/64">Subtitle override</label>
                    <Input value={editorForm.subtitleOverride} onChange={(event) => setEditorForm((current) => ({ ...current, subtitleOverride: event.target.value }))} className={ADMIN_FIELD_CLASS} />
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm text-white/64">CTA override</label>
                    <Input value={editorForm.ctaLabelOverride} onChange={(event) => setEditorForm((current) => ({ ...current, ctaLabelOverride: event.target.value }))} className={ADMIN_FIELD_CLASS} />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm text-white/64">Theme key</label>
                    <Input value={editorForm.themeKey} onChange={(event) => setEditorForm((current) => ({ ...current, themeKey: event.target.value }))} className={ADMIN_FIELD_CLASS} />
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_220px]">
                  <div className="grid gap-2">
                    <label className="text-sm text-white/64">Primary card image override</label>
                    <Input
                      value={editorForm.primaryImagePath}
                      onChange={(event) =>
                        setEditorForm((current) => ({
                          ...current,
                          primaryImagePath: event.target.value,
                          primaryImagePreview: resolveShopCatalogImage(event.target.value),
                        }))
                      }
                      className={ADMIN_FIELD_CLASS}
                    />
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setEditorForm((current) => ({
                          ...current,
                          primaryFile: file,
                          primaryImagePreview: file ? URL.createObjectURL(file) : current.primaryImagePreview,
                        }));
                      }}
                      className={ADMIN_FIELD_CLASS}
                    />
                  </div>
                  <div className="flex h-[140px] items-center justify-center overflow-hidden rounded-[18px] border border-white/10 bg-[#171012]">
                    {editorForm.primaryImagePreview ? (
                      <img src={editorForm.primaryImagePreview} alt="Primary override preview" className="h-full w-full object-contain p-4" />
                    ) : (
                      <UploadCloud className="h-7 w-7 text-white/28" />
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_220px]">
                  <div className="grid gap-2">
                    <label className="text-sm text-white/64">Secondary / decorative image override</label>
                    <Input
                      value={editorForm.secondaryImagePath}
                      onChange={(event) =>
                        setEditorForm((current) => ({
                          ...current,
                          secondaryImagePath: event.target.value,
                          secondaryImagePreview: resolveShopCatalogImage(event.target.value),
                        }))
                      }
                      className={ADMIN_FIELD_CLASS}
                    />
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setEditorForm((current) => ({
                          ...current,
                          secondaryFile: file,
                          secondaryImagePreview: file ? URL.createObjectURL(file) : current.secondaryImagePreview,
                          showSecondaryImage: file ? true : current.showSecondaryImage,
                        }));
                      }}
                      className={ADMIN_FIELD_CLASS}
                    />
                  </div>
                  <div className="flex h-[140px] items-center justify-center overflow-hidden rounded-[18px] border border-white/10 bg-[#171012]">
                    {editorForm.secondaryImagePreview ? (
                      <img src={editorForm.secondaryImagePreview} alt="Secondary override preview" className="h-full w-full object-contain p-4" />
                    ) : (
                      <UploadCloud className="h-7 w-7 text-white/28" />
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className={`${ADMIN_FIELD_CLASS} flex h-12 items-center justify-between rounded-[16px] px-4`}>
                    <span className="text-white/72">Show badge</span>
                    <Switch checked={editorForm.showBadge} onCheckedChange={(checked) => setEditorForm((current) => ({ ...current, showBadge: checked }))} />
                  </div>
                  <div className={`${ADMIN_FIELD_CLASS} flex h-12 items-center justify-between rounded-[16px] px-4`}>
                    <span className="text-white/72">Show subtitle</span>
                    <Switch checked={editorForm.showSubtitle} onCheckedChange={(checked) => setEditorForm((current) => ({ ...current, showSubtitle: checked }))} />
                  </div>
                  <div className={`${ADMIN_FIELD_CLASS} flex h-12 items-center justify-between rounded-[16px] px-4`}>
                    <span className="text-white/72">Show supporting text</span>
                    <Switch checked={editorForm.showSupportingText} onCheckedChange={(checked) => setEditorForm((current) => ({ ...current, showSupportingText: checked }))} />
                  </div>
                  <div className={`${ADMIN_FIELD_CLASS} flex h-12 items-center justify-between rounded-[16px] px-4`}>
                    <span className="text-white/72">Show secondary image</span>
                    <Switch checked={editorForm.showSecondaryImage} onCheckedChange={(checked) => setEditorForm((current) => ({ ...current, showSecondaryImage: checked }))} />
                  </div>
                </div>
              </div>

              {editorForm.kind === 'coin_pack' ? (
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="grid gap-2">
                    <label className="text-sm text-white/64">Coins granted</label>
                    <Input value={editorForm.coinAmount} onChange={(event) => setEditorForm((current) => ({ ...current, coinAmount: event.target.value }))} className={ADMIN_FIELD_CLASS} />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm text-white/64">Base EUR price</label>
                    <Input value={editorForm.basePrice} onChange={(event) => setEditorForm((current) => ({ ...current, basePrice: event.target.value }))} className={ADMIN_FIELD_CLASS} />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm text-white/64">VIP EUR price</label>
                    <Input value={editorForm.vipPrice} onChange={(event) => setEditorForm((current) => ({ ...current, vipPrice: event.target.value }))} className={ADMIN_FIELD_CLASS} />
                  </div>
                </div>
              ) : null}

              {editorForm.kind === 'vip_membership' ? (
                <div className="grid gap-4 lg:grid-cols-4">
                  <div className="grid gap-2">
                    <label className="text-sm text-white/64">Duration days</label>
                    <Input value={editorForm.vipDurationDays} onChange={(event) => setEditorForm((current) => ({ ...current, vipDurationDays: event.target.value }))} className={ADMIN_FIELD_CLASS} />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm text-white/64">Base coin price</label>
                    <Input value={editorForm.basePrice} onChange={(event) => setEditorForm((current) => ({ ...current, basePrice: event.target.value }))} className={ADMIN_FIELD_CLASS} />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm text-white/64">VIP coin price</label>
                    <Input value={editorForm.vipPrice} onChange={(event) => setEditorForm((current) => ({ ...current, vipPrice: event.target.value }))} className={ADMIN_FIELD_CLASS} />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm text-white/64">Benefits (comma separated)</label>
                    <Input value={editorForm.metadataBenefits} onChange={(event) => setEditorForm((current) => ({ ...current, metadataBenefits: event.target.value }))} className={ADMIN_FIELD_CLASS} />
                  </div>
                </div>
              ) : null}

              {editorForm.kind === 'physical_product' ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm text-white/64">Base EUR price</label>
                    <Input value={editorForm.basePrice} onChange={(event) => setEditorForm((current) => ({ ...current, basePrice: event.target.value }))} className={ADMIN_FIELD_CLASS} />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm text-white/64">VIP EUR price</label>
                    <Input value={editorForm.vipPrice} onChange={(event) => setEditorForm((current) => ({ ...current, vipPrice: event.target.value }))} className={ADMIN_FIELD_CLASS} />
                  </div>
                </div>
              ) : null}

              {editorForm.kind === 'physical_reward' ? (
                <div className="grid gap-4 lg:grid-cols-4">
                  <div className="grid gap-2">
                    <label className="text-sm text-white/64">Unlock type</label>
                    <select
                      value={editorForm.unlockType}
                      onChange={(event) => setEditorForm((current) => ({ ...current, unlockType: event.target.value as ShopUnlockType }))}
                      className={`${ADMIN_FIELD_CLASS} h-12 rounded-[16px] bg-[#171012] px-4 text-white`}
                    >
                      <option value="level">Level</option>
                      <option value="challenge">Challenge</option>
                    </select>
                  </div>

                  {editorForm.unlockType === 'level' ? (
                    <div className="grid gap-2">
                      <label className="text-sm text-white/64">Level required</label>
                      <Input value={editorForm.levelRequired} onChange={(event) => setEditorForm((current) => ({ ...current, levelRequired: event.target.value }))} className={ADMIN_FIELD_CLASS} />
                    </div>
                  ) : null}

                  {editorForm.unlockType === 'challenge' ? (
                    <div className="grid gap-2 lg:col-span-2">
                      <label className="text-sm text-white/64">Challenge required</label>
                      <select
                        value={editorForm.challengeId}
                        onChange={(event) => setEditorForm((current) => ({ ...current, challengeId: event.target.value }))}
                        className={`${ADMIN_FIELD_CLASS} h-12 rounded-[16px] bg-[#171012] px-4 text-white`}
                      >
                        <option value="">Select challenge</option>
                        {rewardChallenges.map((challenge) => (
                          <option key={challenge.id} value={challenge.id}>
                            {challenge.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  <div className={`${ADMIN_FIELD_CLASS} flex h-12 items-center justify-between rounded-[16px] px-4`}>
                    <span className="text-white/72">Claim once</span>
                    <Switch checked={editorForm.claimOnce} onCheckedChange={(checked) => setEditorForm((current) => ({ ...current, claimOnce: checked }))} />
                  </div>
                </div>
              ) : null}

              {editorForm.kind === 'action_card' ? (
                <div className="grid gap-2">
                  <label className="text-sm text-white/64">Action key</label>
                  <Input value={editorForm.actionKey} onChange={(event) => setEditorForm((current) => ({ ...current, actionKey: event.target.value as ShopActionKey | '' }))} className={ADMIN_FIELD_CLASS} />
                </div>
              ) : null}
            </div>

            <div className="grid gap-4">
              <div className="rounded-[24px] border border-[#302025] bg-[#171012] p-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={previewAudience === 'base' ? 'default' : 'outline'}
                    className={previewAudience === 'base' ? 'bg-[#ff1654] text-white hover:bg-[#ff1654]/90' : ADMIN_OUTLINE_BUTTON_CLASS}
                    onClick={() => setPreviewAudience('base')}
                  >
                    Base
                  </Button>
                  <Button
                    type="button"
                    variant={previewAudience === 'vip' ? 'default' : 'outline'}
                    className={previewAudience === 'vip' ? 'bg-[#ff1654] text-white hover:bg-[#ff1654]/90' : ADMIN_OUTLINE_BUTTON_CLASS}
                    onClick={() => setPreviewAudience('vip')}
                  >
                    VIP
                  </Button>
                  {editorForm.kind === 'physical_reward' ? (
                    <>
                      <Button
                        type="button"
                        variant={rewardPreviewState === 'locked' ? 'default' : 'outline'}
                        className={rewardPreviewState === 'locked' ? 'bg-[#ff1654] text-white hover:bg-[#ff1654]/90' : ADMIN_OUTLINE_BUTTON_CLASS}
                        onClick={() => setRewardPreviewState('locked')}
                      >
                        Locked
                      </Button>
                      <Button
                        type="button"
                        variant={rewardPreviewState === 'unlocked' ? 'default' : 'outline'}
                        className={rewardPreviewState === 'unlocked' ? 'bg-[#ff1654] text-white hover:bg-[#ff1654]/90' : ADMIN_OUTLINE_BUTTON_CLASS}
                        onClick={() => setRewardPreviewState('unlocked')}
                      >
                        Unlocked
                      </Button>
                      <Button
                        type="button"
                        variant={rewardPreviewState === 'claimed' ? 'default' : 'outline'}
                        className={rewardPreviewState === 'claimed' ? 'bg-[#ff1654] text-white hover:bg-[#ff1654]/90' : ADMIN_OUTLINE_BUTTON_CLASS}
                        onClick={() => setRewardPreviewState('claimed')}
                      >
                        Claimed
                      </Button>
                    </>
                  ) : null}
                </div>

                <p className="mt-4 text-sm uppercase tracking-[0.2em] text-white/42">User-facing preview</p>
                <div className="mt-4 overflow-hidden rounded-[20px] border border-white/8 bg-[#120607] p-4">
                  <ShopCardRail cards={[previewCard]} />
                </div>

                <div className="mt-4 flex items-center gap-3 text-sm text-white/58">
                  <span>LIVE VIEWER</span>
                  <span className="font-semibold text-white">{previewAudience === 'vip' ? 'VIP' : 'BASE'}</span>
                  <span>
                    LVL{' '}
                    {rewardPreviewState === 'locked'
                      ? '0'
                      : editorForm.kind === 'physical_reward' && editorForm.unlockType === 'level'
                        ? editorForm.levelRequired || '1'
                        : '99'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className={ADMIN_OUTLINE_BUTTON_CLASS} onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveCard}
              disabled={savingItem || savingSlot}
              className="bg-[#ff1654] text-white hover:bg-[#ff1654]/90"
            >
              {editorForm.slotId ? 'Save draft card' : 'Create draft card'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

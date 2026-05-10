import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Package, ShieldCheck, UploadCloud } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import {
  ADMIN_DIALOG_CLASS,
  ADMIN_FIELD_CLASS,
  ADMIN_INSET_PANEL_CLASS,
  ADMIN_OUTLINE_BUTTON_CLASS,
  AdminEmptyState,
  AdminPanel,
  AdminShell,
} from '@/components/admin/AdminShell';
import { ShopCardRail } from '@/components/shop/ShopCardRail';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  useAdminShopCatalog,
  type AdminShopCardEntry,
  type AdminShopChallengeRecord,
} from '@/hooks/useAdminShopCatalog';
import { useShopClaims } from '@/hooks/useShopClaims';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  createDefaultShopPresentation,
  createShopSurfaceCard,
  defaultShopBadgeLabel,
  resolveShopCatalogImage,
  toShopCardViewModel,
  type ShopActionKey,
  type ShopCardViewModel,
  type ShopItemKind,
  type ShopPrice,
  type ShopPriceAudience,
  type ShopPriceCurrency,
  type ShopSurfaceKey,
} from '@/lib/shopCatalog';

type ShopClaimStatus = 'pending' | 'approved' | 'fulfilled' | 'rejected' | 'cancelled';
type EditorCategory = 'digital' | 'real';
type DigitalDestination = 'shop_row' | 'wallet_only';
type DigitalKind = 'coin_pack' | 'vip_membership' | 'action_card';
type RealItemMode = 'purchase' | 'unlock_level' | 'unlock_challenge';

type EditorFormState = {
  itemId: string | null;
  slotId: string | null;
  slug: string;
  category: EditorCategory;
  title: string;
  description: string;
  itemImagePath: string;
  itemImagePreview: string;
  itemFile: File | null;
  basePrice: string;
  vipPrice: string;
  position: string;
  isActive: boolean;
  digitalKind: DigitalKind;
  destination: DigitalDestination;
  coinAmount: string;
  vipDurationDays: string;
  metadataBenefits: string;
  realItemMode: RealItemMode;
  levelRequired: string;
  challengeId: string;
  preservedActionKey: ShopActionKey | '';
};

const CLAIM_STATUS_OPTIONS: Array<{ value: ShopClaimStatus; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

const FALLBACK_CARD_IMAGE = '/placeholder.svg';

function buildSafeFileName(file: File) {
  const extension = file.name.includes('.') ? file.name.split('.').pop() : 'png';
  const base = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_]+/g, '-').toLowerCase();
  return `shop-${Date.now()}-${base || 'item'}.${extension}`;
}

function slugifyValue(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function priceCurrencyForKind(kind: ShopItemKind): ShopPriceCurrency {
  return kind === 'vip_membership' ? 'coins' : 'eur';
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
      return 'BUY NOW';
  }
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

function formatAdminPrice(amountMinor: number | null, currency: ShopPriceCurrency) {
  if (amountMinor === null || amountMinor === undefined) return '';
  if (currency === 'eur') return (amountMinor / 100).toFixed(2);
  return String(amountMinor);
}

function createEffectivePrice(audience: ShopPriceAudience, currency: ShopPriceCurrency, amountMinor: number | null): ShopPrice | null {
  if (amountMinor === null) return null;
  return {
    audience,
    currency,
    amountMinor,
    compareAtMinor: null,
    label: currency === 'eur' ? `€${(amountMinor / 100).toFixed(2).replace('.', ',')}` : `${amountMinor} COINS`,
  };
}

function getFinalKind(form: EditorFormState): ShopItemKind {
  if (form.category === 'digital') return form.digitalKind;
  return form.realItemMode === 'purchase' ? 'physical_product' : 'physical_reward';
}

function getSurfaceKey(form: EditorFormState): ShopSurfaceKey {
  return form.category === 'real' ? 'shop.unlock_cards' : 'shop.featured_cards';
}

function buildAutoSubtitle(form: EditorFormState, finalKind: ShopItemKind) {
  if (finalKind === 'physical_reward') {
    return form.realItemMode === 'unlock_challenge' ? 'CHALLENGE REWARD' : 'LEVEL REWARD';
  }
  return '';
}

function buildAutomaticPresentationPayload(form: EditorFormState, finalKind: ShopItemKind, imagePath: string) {
  return {
    template_key: getSurfaceKey(form) === 'shop.unlock_cards' ? 'unlock-card' : 'featured-card',
    theme_key: 'default',
    eyebrow_text: defaultShopBadgeLabel(finalKind),
    supporting_text: '',
    primary_image_path: imagePath,
    secondary_image_path: '',
    show_badge: true,
    show_subtitle: false,
    show_supporting_text: false,
    show_secondary_image: false,
    metadata: {},
  };
}

function createEmptyDigitalForm(nextPosition: number): EditorFormState {
  return {
    itemId: null,
    slotId: null,
    slug: '',
    category: 'digital',
    title: '',
    description: '',
    itemImagePath: '',
    itemImagePreview: '',
    itemFile: null,
    basePrice: '',
    vipPrice: '',
    position: String(nextPosition),
    isActive: true,
    digitalKind: 'coin_pack',
    destination: 'shop_row',
    coinAmount: '',
    vipDurationDays: '',
    metadataBenefits: '',
    realItemMode: 'unlock_level',
    levelRequired: '1',
    challengeId: '',
    preservedActionKey: 'open_shop',
  };
}

function createEmptyRealForm(nextPosition: number): EditorFormState {
  return {
    itemId: null,
    slotId: null,
    slug: '',
    category: 'real',
    title: '',
    description: '',
    itemImagePath: '',
    itemImagePreview: '',
    itemFile: null,
    basePrice: '',
    vipPrice: '',
    position: String(nextPosition),
    isActive: true,
    digitalKind: 'coin_pack',
    destination: 'shop_row',
    coinAmount: '',
    vipDurationDays: '',
    metadataBenefits: '',
    realItemMode: 'unlock_level',
    levelRequired: '1',
    challengeId: '',
    preservedActionKey: '',
  };
}

function createEditorFormFromEntry(entry: AdminShopCardEntry): EditorFormState {
  const basePrice = entry.item.prices.find((price) => price.audience === 'base');
  const vipPrice = entry.item.prices.find((price) => price.audience === 'vip');
  const priceCurrency = priceCurrencyForKind(entry.item.kind);
  const benefits = Array.isArray(entry.item.metadata?.benefits)
    ? (entry.item.metadata.benefits as string[]).join(', ')
    : '';

  return {
    itemId: entry.item.id,
    slotId: entry.slot?.id ?? null,
    slug: entry.item.slug,
    category: entry.placement === 'real_item' ? 'real' : 'digital',
    title: entry.item.title,
    description: '',
    itemImagePath: entry.item.image_path,
    itemImagePreview: resolveShopCatalogImage(entry.item.image_path),
    itemFile: null,
    basePrice: formatAdminPrice(basePrice?.amount_minor ?? null, priceCurrency),
    vipPrice: formatAdminPrice(vipPrice?.amount_minor ?? null, priceCurrency),
    position: String((entry.slot?.sort_order ?? 0) + 1),
    isActive: entry.item.is_active,
    digitalKind: entry.item.kind === 'vip_membership'
      ? 'vip_membership'
      : entry.item.kind === 'action_card'
        ? 'action_card'
        : 'coin_pack',
    destination: entry.slot?.is_active ? 'shop_row' : 'wallet_only',
    coinAmount: entry.item.coin_amount ? String(entry.item.coin_amount) : '',
    vipDurationDays: entry.item.vip_duration_days ? String(entry.item.vip_duration_days) : '',
    metadataBenefits: benefits,
    realItemMode: entry.item.kind === 'physical_product'
      ? 'purchase'
      : entry.item.unlockRule?.unlock_type === 'challenge'
        ? 'unlock_challenge'
        : 'unlock_level',
    levelRequired: entry.item.unlockRule?.level_required ? String(entry.item.unlockRule.level_required) : '1',
    challengeId: entry.item.unlockRule?.challenge_id ?? '',
    preservedActionKey: entry.item.action_key ?? '',
  };
}

function buildPreviewCard(form: EditorFormState): ShopCardViewModel {
  const finalKind = getFinalKind(form);
  const surfaceKey = getSurfaceKey(form);
  const priceCurrency = priceCurrencyForKind(finalKind);
  const baseMinor = parseAdminPrice(form.basePrice, priceCurrency);
  const vipMinor = parseAdminPrice(form.vipPrice, priceCurrency);
  const imagePath = resolveShopCatalogImage(form.itemImagePreview || form.itemImagePath || FALLBACK_CARD_IMAGE);
  const presentation = {
    ...createDefaultShopPresentation({
      surfaceKey,
      kind: finalKind,
      imagePath,
    }),
    eyebrowText: defaultShopBadgeLabel(finalKind),
    supportingText: '',
    primaryImagePath: imagePath,
    secondaryImagePath: '',
    showBadge: true,
    showSubtitle: false,
    showSupportingText: false,
    showSecondaryImage: false,
    metadata: {},
  };

  return toShopCardViewModel(
    createShopSurfaceCard({
      slotId: form.slotId ?? 'preview-slot',
      surfaceKey,
      sortOrder: Math.max(0, Number(form.position || '1') - 1),
      cardVariant: surfaceKey === 'shop.unlock_cards' ? 'reward' : finalKind === 'action_card' ? 'action' : 'coins',
      title: form.title.trim() || 'New card',
      subtitle: buildAutoSubtitle(form, finalKind),
      ctaLabel: deriveDefaultCta(finalKind),
      presentation,
      item: {
        id: form.itemId ?? 'preview-item',
        slug: form.slug || 'preview-item',
        kind: finalKind,
        title: form.title.trim() || 'New card',
        subtitle: buildAutoSubtitle(form, finalKind),
        description: '',
        imagePath,
        ctaLabel: deriveDefaultCta(finalKind),
        actionKey: finalKind === 'action_card' ? (form.preservedActionKey || 'open_shop') : null,
        coinAmount: finalKind === 'coin_pack' ? Number(form.coinAmount || '0') || null : null,
        vipDurationDays: finalKind === 'vip_membership' ? Number(form.vipDurationDays || '0') || null : null,
        metadata: finalKind === 'vip_membership' && form.metadataBenefits.trim()
          ? { benefits: form.metadataBenefits.split(',').map((entry) => entry.trim()).filter(Boolean) }
          : {},
        effectivePrice:
          finalKind === 'physical_reward' || finalKind === 'action_card'
            ? null
            : createEffectivePrice('base', priceCurrency, baseMinor ?? vipMinor),
        unlockRule: {
          unlockType: finalKind === 'physical_reward'
            ? (form.realItemMode === 'unlock_challenge' ? 'challenge' : 'level')
            : 'none',
          levelRequired: finalKind === 'physical_reward' && form.realItemMode === 'unlock_level'
            ? Number(form.levelRequired || '0') || 1
            : null,
          challengeId: finalKind === 'physical_reward' && form.realItemMode === 'unlock_challenge'
            ? form.challengeId || null
            : null,
          claimOnce: true,
        },
        isUnlocked: finalKind !== 'physical_reward',
        claimState: null,
      },
    }),
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const candidate = error as { message?: unknown; error?: unknown; details?: unknown; hint?: unknown };
    const message = typeof candidate.message === 'string' ? candidate.message : null;
    const inner = typeof candidate.error === 'string' ? candidate.error : null;
    const details = typeof candidate.details === 'string' ? candidate.details : null;
    const hint = typeof candidate.hint === 'string' ? candidate.hint : null;
    return message || inner || details || hint || fallback;
  }
  return fallback;
}

function ScrollableRail({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);

  const scrollBy = (direction: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(280, el.clientWidth * 0.7), behavior: 'smooth' });
  };

  const buttonClass =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#3a2329] bg-[#1a0d10] text-white transition hover:bg-[#241318] active:scale-95';

  return (
    <div className="relative flex items-center gap-2">
      <button
        type="button"
        aria-label="Scroll left"
        onClick={() => scrollBy(-1)}
        className={buttonClass}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div
        ref={ref}
        className="admin-shop-rail-scroll min-w-0 max-w-full flex-1 overflow-x-auto overflow-y-hidden scroll-smooth pb-3"
      >
        <div className="w-max min-w-full">{children}</div>
      </div>
      <button
        type="button"
        aria-label="Scroll right"
        onClick={() => scrollBy(1)}
        className={buttonClass}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

export default function AdminShop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const {
    items,
    challenges,
    publicDigitalCards,
    walletOffers,
    realItems,
    saveItem,
    saveSlot,
    publishCatalog,
    hasUnpublishedChanges,
    workspaceSource,
    adminBackendAvailable,
    savingItem,
    savingSlot,
    publishingCatalog,
    isBootstrappingInitialDraft,
    isLoading,
  } = useAdminShopCatalog();
  const { claims, updateClaim, updatingClaim } = useShopClaims();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorForm, setEditorForm] = useState<EditorFormState>(createEmptyDigitalForm(1));
  const [claimNotes, setClaimNotes] = useState<Record<string, string>>({});
  const [claimStatuses, setClaimStatuses] = useState<Record<string, ShopClaimStatus>>({});

  const allEntries = useMemo(
    () => [...publicDigitalCards, ...walletOffers, ...realItems],
    [publicDigitalCards, realItems, walletOffers],
  );
  const actionCardAvailable = useMemo(
    () => items.some((item) => item.kind === 'action_card') || editorForm.digitalKind === 'action_card',
    [editorForm.digitalKind, items],
  );
  const previewCard = useMemo(() => buildPreviewCard(editorForm), [editorForm]);
  const canEditWorkspace = !isLoading;
  const isCatalogLoading = isLoading && allEntries.length === 0;

  const entryByCardKey = useMemo(() => {
    const map = new Map<string, AdminShopCardEntry>();
    for (const entry of allEntries) {
      map.set(entry.card.slotId, entry);
      map.set(entry.card.id, entry);
    }
    return map;
  }, [allEntries]);

  useEffect(() => {
    setClaimNotes((current) => {
      const next = { ...current };
      for (const claim of claims) {
        if (!(claim.id in next)) next[claim.id] = claim.admin_note ?? '';
      }
      return next;
    });
    setClaimStatuses((current) => {
      const next = { ...current };
      for (const claim of claims) {
        if (!(claim.id in next)) next[claim.id] = claim.status as ShopClaimStatus;
      }
      return next;
    });
  }, [claims]);

  useEffect(() => {
    const slotId = searchParams.get('slot');
    const itemId = searchParams.get('item');
    if (!slotId && !itemId) return;
    if (!canEditWorkspace || allEntries.length === 0) return;

    const entry = (slotId ? entryByCardKey.get(slotId) : null)
      ?? (itemId ? entryByCardKey.get(itemId) : null);

    if (!entry) return;

    setEditorForm(createEditorFormFromEntry(entry));
    setEditorOpen(true);
    setSearchParams({});
  }, [allEntries, canEditWorkspace, entryByCardKey, searchParams, setSearchParams]);

  const openNewDigitalEditor = () => {
    setEditorForm(createEmptyDigitalForm(publicDigitalCards.length + 1));
    setEditorOpen(true);
  };

  const openNewRealEditor = () => {
    setEditorForm(createEmptyRealForm(realItems.length + 1));
    setEditorOpen(true);
  };

  const openEntryEditor = (entry: AdminShopCardEntry) => {
    setEditorForm(createEditorFormFromEntry(entry));
    setEditorOpen(true);
  };

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
    if (!adminBackendAvailable) {
      toast({
        title: 'Admin backend non disponibile',
        description: 'Le migration Supabase dello shop non sono applicate. Esegui `supabase db push` per poter salvare.',
        variant: 'destructive',
      });
      return;
    }
    try {
      const finalKind = getFinalKind(editorForm);
      const surfaceKey = getSurfaceKey(editorForm);
      const priceCurrency = priceCurrencyForKind(finalKind);
      const baseMinor = parseAdminPrice(editorForm.basePrice, priceCurrency);
      const vipMinor = parseAdminPrice(editorForm.vipPrice, priceCurrency);
      const rawTitle = editorForm.title.trim();

      if (!rawTitle) {
        throw new Error('Title is required.');
      }

      if (!editorForm.itemImagePath && !editorForm.itemFile) {
        throw new Error('Image is required.');
      }

      if (
        (finalKind === 'coin_pack' || finalKind === 'vip_membership' || finalKind === 'physical_product')
        && baseMinor === null
      ) {
        throw new Error('Price is required for this card.');
      }

      if (baseMinor !== null && vipMinor !== null && vipMinor > baseMinor) {
        throw new Error('VIP price must be lower than or equal to the base price.');
      }

      if (finalKind === 'coin_pack' && Number(editorForm.coinAmount || '0') <= 0) {
        throw new Error('Coins amount must be greater than zero.');
      }

      if (finalKind === 'vip_membership' && Number(editorForm.vipDurationDays || '0') <= 0) {
        throw new Error('Duration days must be greater than zero.');
      }

      if (finalKind === 'physical_reward' && editorForm.realItemMode === 'unlock_level' && Number(editorForm.levelRequired || '0') < 1) {
        throw new Error('Level must be greater than or equal to 1.');
      }

      if (finalKind === 'physical_reward' && editorForm.realItemMode === 'unlock_challenge' && !editorForm.challengeId) {
        throw new Error('Challenge is required for challenge rewards.');
      }

      const uploadedImagePath = await uploadShopAsset(editorForm.itemFile);
      const finalImagePath = uploadedImagePath || editorForm.itemImagePath;
      const normalizedImagePath = finalImagePath.trim();
      const metadata = finalKind === 'vip_membership' && editorForm.metadataBenefits.trim()
        ? {
            benefits: editorForm.metadataBenefits
              .split(',')
              .map((entry) => entry.trim())
              .filter(Boolean),
          }
        : {};

      const persistedSlug = editorForm.slug || `${slugifyValue(rawTitle) || 'shop-card'}-${String(Date.now()).slice(-6)}`;
      const itemResult = await saveItem({
        id: editorForm.itemId,
        slug: persistedSlug,
        kind: finalKind,
        title: rawTitle,
        subtitle: buildAutoSubtitle(editorForm, finalKind),
        description: '',
        image_path: normalizedImagePath,
        cta_label: deriveDefaultCta(finalKind),
        is_active: editorForm.isActive,
        action_key: finalKind === 'action_card' ? (editorForm.preservedActionKey || 'open_shop') : null,
        coin_amount: finalKind === 'coin_pack' ? Number(editorForm.coinAmount || '0') : null,
        vip_duration_days: finalKind === 'vip_membership' ? Number(editorForm.vipDurationDays || '0') : null,
        metadata,
        prices:
          finalKind === 'physical_reward' || finalKind === 'action_card'
            ? []
            : [
                baseMinor !== null
                  ? {
                      audience: 'base' as ShopPriceAudience,
                      currency: priceCurrency,
                      amount_minor: baseMinor,
                      is_active: true,
                    }
                  : null,
                vipMinor !== null
                  ? {
                      audience: 'vip' as ShopPriceAudience,
                      currency: priceCurrency,
                      amount_minor: vipMinor,
                      is_active: true,
                    }
                  : null,
              ].filter(Boolean),
        unlock_rule:
          finalKind === 'physical_reward'
            ? {
                unlock_type: editorForm.realItemMode === 'unlock_challenge' ? 'challenge' : 'level',
                level_required: editorForm.realItemMode === 'unlock_level' ? Number(editorForm.levelRequired || '0') : null,
                challenge_id: editorForm.realItemMode === 'unlock_challenge' ? editorForm.challengeId || null : null,
                claim_once: true,
              }
            : undefined,
      }) as { id?: string };

      const itemId = itemResult?.id ?? editorForm.itemId;
      if (!itemId) {
        throw new Error('Missing draft item id after save.');
      }

      const shouldPersistSlot = editorForm.category === 'real' || editorForm.destination === 'shop_row' || Boolean(editorForm.slotId);
      if (shouldPersistSlot) {
        await saveSlot({
          id: editorForm.slotId,
          surface_key: surfaceKey,
          sort_order: Math.max(0, Number(editorForm.position || '1') - 1),
          item_id: itemId,
          card_variant: surfaceKey === 'shop.unlock_cards' ? 'reward' : finalKind === 'action_card' ? 'action' : 'coins',
          title_override: '',
          subtitle_override: '',
          cta_label_override: '',
          is_active: editorForm.category === 'real'
            ? editorForm.isActive
            : editorForm.destination === 'shop_row' && editorForm.isActive,
          presentation: buildAutomaticPresentationPayload(editorForm, finalKind, normalizedImagePath),
        });
      }

      toast({
        title: editorForm.itemId ? 'Card updated' : 'Card created',
        description: rawTitle,
      });

      setEditorOpen(false);
      setEditorForm(createEmptyDigitalForm(publicDigitalCards.length + 1));
    } catch (error) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Unable to save the shop card.'),
        variant: 'destructive',
      });
    }
  };

  const handlePublish = async () => {
    if (!adminBackendAvailable) {
      toast({
        title: 'Admin backend non disponibile',
        description: 'Applica le migration Supabase prima di pubblicare il catalogo.',
        variant: 'destructive',
      });
      return;
    }
    if (!hasUnpublishedChanges) {
      toast({
        title: 'Nothing to publish',
        description: 'There are no draft changes right now.',
      });
      return;
    }
    try {
      await publishCatalog();
      toast({
        title: 'Shop published',
        description: 'The live shop now matches the current admin draft.',
      });
    } catch (error) {
      console.error('admin_publish_shop_catalog failed:', error);
      toast({
        title: 'Publish error',
        description: getErrorMessage(error, 'Unable to publish the shop.'),
        variant: 'destructive',
      });
    }
  };

  const handleUpdateClaim = async (claimId: string) => {
    try {
      await updateClaim({
        claimId,
        status: claimStatuses[claimId] ?? 'pending',
        adminNote: claimNotes[claimId] ?? '',
      });
      toast({
        title: 'Claim updated',
        description: claimStatuses[claimId] ?? 'pending',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Unable to update the claim.'),
        variant: 'destructive',
      });
    }
  };

  const rewardChallenges = challenges as AdminShopChallengeRecord[];

  return (
    <AdminShell
      title="Shop Workspace"
      description="Edit the exact shop cards users see and publish one clean draft."
      actions={(
        <>
          <Button
            variant="outline"
            onClick={openNewDigitalEditor}
            disabled={!adminBackendAvailable}
            className={`h-11 ${ADMIN_OUTLINE_BUTTON_CLASS}`}
          >
            Card Item
          </Button>
          <Button
            variant="outline"
            onClick={openNewRealEditor}
            disabled={!adminBackendAvailable}
            className={`h-11 ${ADMIN_OUTLINE_BUTTON_CLASS}`}
          >
            Card Real Item
          </Button>
          <Button
            onClick={handlePublish}
            disabled={!adminBackendAvailable || publishingCatalog}
            className="h-11 bg-[#ff1654] text-white hover:bg-[#ff1654]/90"
          >
            {publishingCatalog ? 'Publishing...' : 'Publish'}
          </Button>
        </>
      )}
    >
      <div className="h-full min-h-0 space-y-4 overflow-y-auto pr-1">
        <div className={`rounded-[22px] border px-4 py-3 text-sm ${ADMIN_INSET_PANEL_CLASS}`}>
          <p className={hasUnpublishedChanges ? 'text-[#ffb4c7]' : 'text-[#72f1b8]'}>
            {isBootstrappingInitialDraft
              ? 'Syncing the current live shop into the draft workspace.'
              : isCatalogLoading
                ? 'Loading the current shop workspace.'
              : workspaceSource === 'public_catalog_projection'
                ? 'Admin backend non disponibile: schermata in sola lettura sul catalogo pubblico. Esegui `supabase db push` per applicare le migration dello shop.'
                : hasUnpublishedChanges
                  ? 'Draft changes are ready and not yet published.'
                  : 'Draft and live shop are aligned.'}
          </p>
        </div>

        <AdminPanel
          title="Card Items"
          description="Public digital cards shown under the VIP banner. Click any card to edit it."
          className="min-h-0 min-w-0"
          contentClassName="min-h-0 min-w-0"
        >
          {isCatalogLoading ? (
            <AdminEmptyState
              title="Loading shop cards"
              description="Syncing the public row into this workspace."
            />
          ) : publicDigitalCards.length === 0 ? (
            <AdminEmptyState
              title="No public digital cards"
              description="Create the first shop card for the top row."
            />
          ) : (
            <ScrollableRail>
              <ShopCardRail
                cards={publicDigitalCards.map((entry) => entry.card)}
                onAction={canEditWorkspace ? ((card) => {
                  const entry = entryByCardKey.get(card.slotId) ?? entryByCardKey.get(card.id);
                  if (entry) openEntryEditor(entry);
                }) : undefined}
                marqueeWhenOverflow={false}
              />
            </ScrollableRail>
          )}
        </AdminPanel>

        <AdminPanel
          title="Card Real Item"
          description="Physical products and level rewards shown below the reward banner."
          className="min-h-0"
          contentClassName="min-h-0"
        >
          {isCatalogLoading ? (
            <AdminEmptyState
              title="Loading reward cards"
              description="Syncing physical products and unlock rewards."
            />
          ) : realItems.length === 0 ? (
            <AdminEmptyState
              title="No real items"
              description="Create the first physical product or unlock reward."
            />
          ) : (
            <ScrollableRail>
              <ShopCardRail
                cards={realItems.map((entry) => entry.card)}
                onAction={canEditWorkspace ? ((card) => {
                  const entry = entryByCardKey.get(card.slotId) ?? entryByCardKey.get(card.id);
                  if (entry) openEntryEditor(entry);
                }) : undefined}
                marqueeWhenOverflow={false}
              />
            </ScrollableRail>
          )}
        </AdminPanel>

        <AdminPanel
          title="Pending Claims"
          description="Secondary moderation panel for physical reward requests."
          className="min-h-0"
          contentClassName="min-h-0"
        >
          {claims.length === 0 ? (
            <AdminEmptyState
              title="No pending claims"
              description="Physical reward claims will appear here when users request them."
            />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {claims.map((claim) => (
                <div key={claim.id} className="rounded-[22px] border border-[#302025] bg-[#171012] p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-[74px] w-[74px] items-center justify-center overflow-hidden rounded-[18px] border border-white/10 bg-[#120607]">
                      {claim.itemImage ? (
                        <img
                          src={resolveShopCatalogImage(claim.itemImage)}
                          alt={claim.itemTitle}
                          className="h-full w-full object-contain p-2"
                        />
                      ) : (
                        <ShieldCheck className="h-5 w-5 text-white/30" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-semibold text-white">{claim.itemTitle}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.24em] text-white/38">{claim.itemSlug}</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px]">
                        <div className="grid gap-2">
                          <label className="text-sm text-white/62">Admin note</label>
                          <Textarea
                            value={claimNotes[claim.id] ?? ''}
                            onChange={(event) =>
                              setClaimNotes((current) => ({
                                ...current,
                                [claim.id]: event.target.value,
                              }))
                            }
                            className={`${ADMIN_FIELD_CLASS} min-h-[92px]`}
                          />
                        </div>

                        <div className="grid gap-2">
                          <label className="text-sm text-white/62">Status</label>
                          <select
                            value={claimStatuses[claim.id] ?? claim.status}
                            onChange={(event) =>
                              setClaimStatuses((current) => ({
                                ...current,
                                [claim.id]: event.target.value as ShopClaimStatus,
                              }))
                            }
                            className={`${ADMIN_FIELD_CLASS} h-11 rounded-[16px] px-4`}
                          >
                            {CLAIM_STATUS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>

                          <Button
                            onClick={() => handleUpdateClaim(claim.id)}
                            disabled={updatingClaim}
                            className="h-11 bg-[#ff1654] text-white hover:bg-[#ff1654]/90"
                          >
                            Save claim
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
        <DialogContent className={`${ADMIN_DIALOG_CLASS} max-h-[92vh] overflow-y-auto sm:max-w-[1100px]`}>
          <DialogHeader>
            <DialogTitle>{editorForm.itemId ? 'Edit shop card' : 'Create shop card'}</DialogTitle>
            <DialogDescription className="text-white/56">
              Edit only the user-facing card details that matter: image, price, level, copy, and position.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-2 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="grid gap-5">
              {editorForm.category === 'digital' ? (
                <>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="grid gap-2">
                      <label className="text-sm text-white/64">Tipo</label>
                      <select
                        value={editorForm.digitalKind}
                        onChange={(event) =>
                          setEditorForm((current) => ({
                            ...current,
                            digitalKind: event.target.value as DigitalKind,
                            preservedActionKey: event.target.value === 'action_card'
                              ? current.preservedActionKey || 'open_shop'
                              : current.preservedActionKey,
                          }))
                        }
                        className={`${ADMIN_FIELD_CLASS} h-12 rounded-[16px] px-4`}
                      >
                        <option value="coin_pack">Coin pack</option>
                        <option value="vip_membership">VIP</option>
                        {actionCardAvailable ? <option value="action_card">Altro digitale</option> : null}
                      </select>
                    </div>

                    <div className="grid gap-2">
                      <label className="text-sm text-white/64">Destinazione</label>
                      <select
                        value={editorForm.destination}
                        onChange={(event) =>
                          setEditorForm((current) => ({
                            ...current,
                            destination: event.target.value as DigitalDestination,
                          }))
                        }
                        className={`${ADMIN_FIELD_CLASS} h-12 rounded-[16px] px-4`}
                      >
                        <option value="shop_row">Shop row</option>
                        <option value="wallet_only">Wallet only</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="grid gap-2">
                      <label className="text-sm text-white/64">Titolo</label>
                      <Input
                        value={editorForm.title}
                        onChange={(event) => setEditorForm((current) => ({ ...current, title: event.target.value }))}
                        className={ADMIN_FIELD_CLASS}
                      />
                    </div>

                    <div className={`${ADMIN_FIELD_CLASS} flex h-12 items-center justify-between rounded-[16px] px-4`}>
                      <span className="text-white/72">Attiva</span>
                      <Switch
                        checked={editorForm.isActive}
                        onCheckedChange={(checked) => setEditorForm((current) => ({ ...current, isActive: checked }))}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
                    <div className="grid gap-2">
                      <label className="text-sm text-white/64">Immagine</label>
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

                    <div className="flex h-[136px] items-center justify-center overflow-hidden rounded-[18px] border border-white/10 bg-[#171012]">
                      {editorForm.itemImagePreview ? (
                        <img src={editorForm.itemImagePreview} alt="Preview" className="h-full w-full object-contain p-4" />
                      ) : (
                        <UploadCloud className="h-7 w-7 text-white/28" />
                      )}
                    </div>
                  </div>

                  {(editorForm.digitalKind === 'coin_pack' || editorForm.digitalKind === 'vip_membership') ? (
                    <div className="grid gap-4 lg:grid-cols-3">
                      {editorForm.digitalKind === 'coin_pack' ? (
                        <div className="grid gap-2">
                          <label className="text-sm text-white/64">Coins amount</label>
                          <Input
                            value={editorForm.coinAmount}
                            onChange={(event) => setEditorForm((current) => ({ ...current, coinAmount: event.target.value }))}
                            className={ADMIN_FIELD_CLASS}
                          />
                        </div>
                      ) : (
                        <div className="grid gap-2">
                          <label className="text-sm text-white/64">Durata giorni</label>
                          <Input
                            value={editorForm.vipDurationDays}
                            onChange={(event) => setEditorForm((current) => ({ ...current, vipDurationDays: event.target.value }))}
                            className={ADMIN_FIELD_CLASS}
                          />
                        </div>
                      )}

                      <div className="grid gap-2">
                        <label className="text-sm text-white/64">Prezzo</label>
                        <Input
                          value={editorForm.basePrice}
                          onChange={(event) => setEditorForm((current) => ({ ...current, basePrice: event.target.value }))}
                          className={ADMIN_FIELD_CLASS}
                        />
                      </div>

                      <div className="grid gap-2">
                        <label className="text-sm text-white/64">Prezzo VIP</label>
                        <Input
                          value={editorForm.vipPrice}
                          onChange={(event) => setEditorForm((current) => ({ ...current, vipPrice: event.target.value }))}
                          className={ADMIN_FIELD_CLASS}
                        />
                      </div>
                    </div>
                  ) : null}

                  {editorForm.digitalKind === 'vip_membership' ? (
                    <div className="grid gap-2">
                      <label className="text-sm text-white/64">Benefits</label>
                      <Input
                        value={editorForm.metadataBenefits}
                        onChange={(event) => setEditorForm((current) => ({ ...current, metadataBenefits: event.target.value }))}
                        className={ADMIN_FIELD_CLASS}
                      />
                    </div>
                  ) : null}

                  {editorForm.destination === 'shop_row' ? (
                    <div className="grid gap-2 lg:max-w-[220px]">
                      <label className="text-sm text-white/64">Posizione</label>
                      <Input
                        value={editorForm.position}
                        onChange={(event) => setEditorForm((current) => ({ ...current, position: event.target.value }))}
                        className={ADMIN_FIELD_CLASS}
                      />
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="grid gap-2">
                      <label className="text-sm text-white/64">Modalita</label>
                      <select
                        value={editorForm.realItemMode}
                        onChange={(event) =>
                          setEditorForm((current) => ({
                            ...current,
                            realItemMode: event.target.value as RealItemMode,
                          }))
                        }
                        className={`${ADMIN_FIELD_CLASS} h-12 rounded-[16px] px-4`}
                      >
                        <option value="purchase">Prezzo</option>
                        <option value="unlock_level">Livello</option>
                        <option value="unlock_challenge">Challenge</option>
                      </select>
                    </div>

                    <div className={`${ADMIN_FIELD_CLASS} flex h-12 items-center justify-between rounded-[16px] px-4`}>
                      <span className="text-white/72">Attiva</span>
                      <Switch
                        checked={editorForm.isActive}
                        onCheckedChange={(checked) => setEditorForm((current) => ({ ...current, isActive: checked }))}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="grid gap-2">
                      <label className="text-sm text-white/64">Titolo</label>
                      <Input
                        value={editorForm.title}
                        onChange={(event) => setEditorForm((current) => ({ ...current, title: event.target.value }))}
                        className={ADMIN_FIELD_CLASS}
                      />
                    </div>

                    <div className="grid gap-2">
                      <label className="text-sm text-white/64">Posizione</label>
                      <Input
                        value={editorForm.position}
                        onChange={(event) => setEditorForm((current) => ({ ...current, position: event.target.value }))}
                        className={ADMIN_FIELD_CLASS}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
                    <div className="grid gap-2">
                      <label className="text-sm text-white/64">Immagine</label>
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

                    <div className="flex h-[136px] items-center justify-center overflow-hidden rounded-[18px] border border-white/10 bg-[#171012]">
                      {editorForm.itemImagePreview ? (
                        <img src={editorForm.itemImagePreview} alt="Preview" className="h-full w-full object-contain p-4" />
                      ) : (
                        <UploadCloud className="h-7 w-7 text-white/28" />
                      )}
                    </div>
                  </div>

                  {editorForm.realItemMode === 'purchase' ? (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="grid gap-2">
                        <label className="text-sm text-white/64">Prezzo</label>
                        <Input
                          value={editorForm.basePrice}
                          onChange={(event) => setEditorForm((current) => ({ ...current, basePrice: event.target.value }))}
                          className={ADMIN_FIELD_CLASS}
                        />
                      </div>

                      <div className="grid gap-2">
                        <label className="text-sm text-white/64">Prezzo VIP</label>
                        <Input
                          value={editorForm.vipPrice}
                          onChange={(event) => setEditorForm((current) => ({ ...current, vipPrice: event.target.value }))}
                          className={ADMIN_FIELD_CLASS}
                        />
                      </div>
                    </div>
                  ) : null}

                  {editorForm.realItemMode === 'unlock_level' ? (
                    <div className="grid gap-2 lg:max-w-[220px]">
                      <label className="text-sm text-white/64">Livello</label>
                      <Input
                        value={editorForm.levelRequired}
                        onChange={(event) => setEditorForm((current) => ({ ...current, levelRequired: event.target.value }))}
                        className={ADMIN_FIELD_CLASS}
                      />
                    </div>
                  ) : null}

                  {editorForm.realItemMode === 'unlock_challenge' ? (
                    <div className="grid gap-2">
                      <label className="text-sm text-white/64">Challenge</label>
                      <select
                        value={editorForm.challengeId}
                        onChange={(event) => setEditorForm((current) => ({ ...current, challengeId: event.target.value }))}
                        className={`${ADMIN_FIELD_CLASS} h-12 rounded-[16px] px-4`}
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
                </>
              )}
            </div>

            <div className="grid gap-4">
              <div className="rounded-[24px] border border-[#302025] bg-[#171012] p-4">
                <div className="flex items-center gap-2">
                  {editorForm.category === 'digital' ? (
                    <Package className="h-4 w-4 text-[#ff8ead]" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 text-[#72f1b8]" />
                  )}
                  <p className="text-sm uppercase tracking-[0.22em] text-white/46">Live Preview</p>
                </div>

                <div className="mt-4 overflow-hidden rounded-[20px] border border-white/8 bg-[#120607] p-4">
                  <ShopCardRail cards={[previewCard]} marqueeWhenOverflow={false} />
                </div>

                <div className="mt-4 text-sm leading-6 text-white/56">
                  <p>{editorForm.category === 'digital' ? 'This preview matches the public shop card style.' : 'This preview matches the reward row style shown under the banner.'}</p>
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
              disabled={savingItem || savingSlot || !adminBackendAvailable}
              className="bg-[#ff1654] text-white hover:bg-[#ff1654]/90"
            >
              {editorForm.itemId ? 'Save card' : 'Create card'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

import { useMemo, useState } from 'react';
import {
  Boxes,
  Eye,
  ImagePlus,
  LayoutTemplate,
  Package,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
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
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAdminShopCatalog, type AdminShopItemRecord } from '@/hooks/useAdminShopCatalog';
import { useShopClaims } from '@/hooks/useShopClaims';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import {
  SHOP_ACTION_KEYS,
  formatShopMoneyLabel,
  resolveShopCatalogImage,
  type ShopActionKey,
  type ShopCardVariant,
  type ShopItemKind,
  type ShopPriceAudience,
  type ShopPriceCurrency,
  type ShopUnlockType,
} from '@/lib/shopCatalog';

type ShopSlotRow = Database['public']['Tables']['shop_surface_slots']['Row'];
type ChallengeRow = Database['public']['Tables']['challenges']['Row'];
type ShopClaimStatus = Database['public']['Enums']['shop_claim_status'];

type ItemFormState = {
  id: string | null;
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
  imagePath: string;
  imagePreview: string;
  metadataBenefits: string;
  file: File | null;
};

type SlotFormState = {
  id: string | null;
  surfaceKey: 'shop.featured_cards' | 'shop.unlock_cards';
  sortOrder: string;
  itemId: string;
  cardVariant: ShopCardVariant;
  titleOverride: string;
  subtitleOverride: string;
  ctaLabelOverride: string;
  isActive: boolean;
};

type ClaimNoteState = Record<string, string>;

const ITEM_KIND_OPTIONS: Array<{ value: ShopItemKind; label: string }> = [
  { value: 'coin_pack', label: 'Coin pack' },
  { value: 'vip_membership', label: 'VIP membership' },
  { value: 'physical_product', label: 'Physical product' },
  { value: 'physical_reward', label: 'Physical reward' },
  { value: 'action_card', label: 'Action card' },
];

const SURFACE_OPTIONS: Array<{ value: SlotFormState['surfaceKey']; label: string }> = [
  { value: 'shop.featured_cards', label: 'Top row / featured cards' },
  { value: 'shop.unlock_cards', label: 'Bottom row / unlock cards' },
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

function canDeleteStorageObject(path: string) {
  return Boolean(path) && !path.startsWith('/') && !path.startsWith('http://') && !path.startsWith('https://');
}

function priceCurrencyForKind(kind: ShopItemKind): ShopPriceCurrency {
  return kind === 'vip_membership' ? 'coins' : 'eur';
}

function defaultCardVariant(kind: ShopItemKind): ShopCardVariant {
  if (kind === 'physical_reward') return 'reward';
  if (kind === 'action_card') return 'action';
  return 'coins';
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

function createEmptyItemForm(): ItemFormState {
  return {
    id: null,
    slug: '',
    kind: 'coin_pack',
    title: '',
    subtitle: '',
    description: '',
    ctaLabel: deriveDefaultCta('coin_pack'),
    isActive: true,
    actionKey: '',
    coinAmount: '',
    vipDurationDays: '',
    priceCurrency: 'eur',
    basePrice: '',
    vipPrice: '',
    unlockType: 'none',
    levelRequired: '',
    challengeId: '',
    claimOnce: true,
    imagePath: '',
    imagePreview: '',
    metadataBenefits: '',
    file: null,
  };
}

function createEmptySlotForm(): SlotFormState {
  return {
    id: null,
    surfaceKey: 'shop.featured_cards',
    sortOrder: '0',
    itemId: '',
    cardVariant: 'coins',
    titleOverride: '',
    subtitleOverride: '',
    ctaLabelOverride: '',
    isActive: true,
  };
}

function formFromItem(item: AdminShopItemRecord): ItemFormState {
  const primaryCurrency = item.prices[0]?.currency ?? priceCurrencyForKind(item.kind);
  const basePrice = item.prices.find((price) => price.audience === 'base');
  const vipPrice = item.prices.find((price) => price.audience === 'vip');
  const metadataBenefits = Array.isArray(item.metadata?.benefits)
    ? (item.metadata.benefits as string[]).join(', ')
    : '';

  return {
    id: item.id,
    slug: item.slug,
    kind: item.kind,
    title: item.title,
    subtitle: item.subtitle,
    description: item.description,
    ctaLabel: item.cta_label,
    isActive: item.is_active,
    actionKey: (item.action_key as ShopActionKey | null) ?? '',
    coinAmount: item.coin_amount ? String(item.coin_amount) : '',
    vipDurationDays: item.vip_duration_days ? String(item.vip_duration_days) : '',
    priceCurrency: primaryCurrency,
    basePrice: formatAdminPrice(basePrice?.amount_minor ?? null, primaryCurrency),
    vipPrice: formatAdminPrice(vipPrice?.amount_minor ?? null, primaryCurrency),
    unlockType: item.unlockRule?.unlock_type ?? 'none',
    levelRequired: item.unlockRule?.level_required ? String(item.unlockRule.level_required) : '',
    challengeId: item.unlockRule?.challenge_id ?? '',
    claimOnce: item.unlockRule?.claim_once ?? true,
    imagePath: item.image_path,
    imagePreview: resolveShopCatalogImage(item.image_path),
    metadataBenefits,
    file: null,
  };
}

function formFromSlot(slot: ShopSlotRow): SlotFormState {
  return {
    id: slot.id,
    surfaceKey: slot.surface_key as SlotFormState['surfaceKey'],
    sortOrder: String(slot.sort_order),
    itemId: slot.item_id,
    cardVariant: (slot.card_variant as ShopCardVariant) ?? 'default',
    titleOverride: slot.title_override,
    subtitleOverride: slot.subtitle_override,
    ctaLabelOverride: slot.cta_label_override,
    isActive: slot.is_active,
  };
}

function PricePreview({
  label,
  title,
  subtitle,
  value,
}: {
  label: string;
  title: string;
  subtitle: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] border border-[#302025] bg-[#171012] p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-white/46">{label}</p>
      <p className="mt-3 text-xl font-semibold text-white">{title || 'Untitled item'}</p>
      <p className="mt-1 text-sm text-white/48">{subtitle || 'Subtitle preview'}</p>
      <p className="mt-5 text-2xl font-semibold text-[#ff8ead]">{value || 'No price / unlock label'}</p>
    </div>
  );
}

function ItemEditorPreview({
  form,
  baseLabel,
  vipLabel,
}: {
  form: ItemFormState;
  baseLabel: string;
  vipLabel: string;
}) {
  const previewValue =
    form.kind === 'physical_reward'
      ? form.unlockType === 'level'
        ? `LVL ${form.levelRequired || '0'}`
        : form.unlockType === 'challenge'
          ? 'CHALLENGE'
          : 'UNLOCK'
      : baseLabel;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <PricePreview label="Base preview" title={form.title} subtitle={form.subtitle} value={previewValue} />
      <PricePreview
        label="VIP preview"
        title={form.title}
        subtitle={form.subtitle}
        value={form.kind === 'physical_reward' ? previewValue : vipLabel || baseLabel}
      />
    </div>
  );
}

export default function AdminShop() {
  const { toast } = useToast();
  const {
    items,
    slots,
    challenges,
    isLoading,
    refetch,
    saveItem,
    saveSlot,
    setItemActive,
    savingItem,
    savingSlot,
  } = useAdminShopCatalog();
  const { claims, updateClaim, updatingClaim } = useShopClaims();
  const [activeTab, setActiveTab] = useState('catalog');
  const [search, setSearch] = useState('');
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [slotDialogOpen, setSlotDialogOpen] = useState(false);
  const [itemForm, setItemForm] = useState<ItemFormState>(createEmptyItemForm());
  const [slotForm, setSlotForm] = useState<SlotFormState>(createEmptySlotForm());
  const [claimNotes, setClaimNotes] = useState<ClaimNoteState>({});

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

  const featuredCount = slots.filter((slot) => slot.surface_key === 'shop.featured_cards').length;
  const unlockCount = slots.filter((slot) => slot.surface_key === 'shop.unlock_cards').length;
  const pendingClaimsCount = claims.filter((claim) => claim.status === 'pending').length;

  const baseMinor = parseAdminPrice(itemForm.basePrice, itemForm.priceCurrency);
  const vipMinor = parseAdminPrice(itemForm.vipPrice, itemForm.priceCurrency);
  const baseLabel = baseMinor !== null ? formatShopMoneyLabel(baseMinor, itemForm.priceCurrency) : '';
  const vipLabel = vipMinor !== null ? formatShopMoneyLabel(vipMinor, itemForm.priceCurrency) : '';

  const physicalRewardItems = items.filter((item) => item.kind === 'physical_reward');
  const featuredItems = items.filter((item) => item.kind !== 'physical_reward');

  const openCreateItemDialog = () => {
    setItemForm(createEmptyItemForm());
    setItemDialogOpen(true);
  };

  const openEditItemDialog = (item: AdminShopItemRecord) => {
    setItemForm(formFromItem(item));
    setItemDialogOpen(true);
  };

  const openCreateSlotDialog = (surfaceKey?: SlotFormState['surfaceKey']) => {
    const next = createEmptySlotForm();
    if (surfaceKey) next.surfaceKey = surfaceKey;
    setSlotForm(next);
    setSlotDialogOpen(true);
  };

  const openEditSlotDialog = (slot: ShopSlotRow) => {
    setSlotForm(formFromSlot(slot));
    setSlotDialogOpen(true);
  };

  const uploadSelectedFile = async () => {
    if (!itemForm.file) {
      return itemForm.imagePath;
    }

    const path = buildSafeFileName(itemForm.file);
    const { error } = await supabase.storage.from('shop-catalog').upload(path, itemForm.file, {
      upsert: false,
      contentType: itemForm.file.type || 'image/png',
    });

    if (error) throw error;
    return path;
  };

  const handleSaveItem = async () => {
    try {
      if (!itemForm.title.trim() || !itemForm.slug.trim()) {
        throw new Error('Title and slug are required.');
      }

      if (!itemForm.imagePath && !itemForm.file) {
        throw new Error('Image is required.');
      }

      if (itemForm.kind === 'action_card' && !itemForm.actionKey) {
        throw new Error('Action cards require an action key.');
      }

      if (
        (itemForm.kind === 'coin_pack' || itemForm.kind === 'vip_membership' || itemForm.kind === 'physical_product') &&
        baseMinor === null
      ) {
        throw new Error('A base price is required for this item.');
      }

      if (baseMinor !== null && vipMinor !== null && vipMinor > baseMinor) {
        throw new Error('VIP price must be lower than or equal to the base price.');
      }

      if (itemForm.kind === 'coin_pack' && Number(itemForm.coinAmount || '0') <= 0) {
        throw new Error('Coin packs require a valid coin amount.');
      }

      if (itemForm.kind === 'vip_membership' && Number(itemForm.vipDurationDays || '0') <= 0) {
        throw new Error('VIP memberships require a valid duration in days.');
      }

      if (itemForm.kind === 'physical_reward' && itemForm.unlockType === 'none') {
        throw new Error('Physical rewards require an unlock rule.');
      }

      if (itemForm.kind === 'physical_reward' && itemForm.unlockType === 'level' && Number(itemForm.levelRequired || '0') < 1) {
        throw new Error('Level unlocks require a level greater than or equal to 1.');
      }

      if (itemForm.kind === 'physical_reward' && itemForm.unlockType === 'challenge' && !itemForm.challengeId) {
        throw new Error('Select a challenge for challenge-based unlocks.');
      }

      const uploadedPath = await uploadSelectedFile();
      const previousPath = itemForm.id
        ? items.find((item) => item.id === itemForm.id)?.image_path ?? ''
        : '';

      const prices =
        itemForm.kind === 'physical_reward' || itemForm.kind === 'action_card'
          ? []
          : [
              baseMinor !== null
                ? {
                    audience: 'base' as ShopPriceAudience,
                    currency: itemForm.priceCurrency,
                    amount_minor: baseMinor,
                    is_active: true,
                  }
                : null,
              vipMinor !== null
                ? {
                    audience: 'vip' as ShopPriceAudience,
                    currency: itemForm.priceCurrency,
                    amount_minor: vipMinor,
                    is_active: true,
                  }
                : null,
            ].filter(Boolean);

      const payload = {
        id: itemForm.id,
        slug: itemForm.slug.trim(),
        kind: itemForm.kind,
        title: itemForm.title.trim(),
        subtitle: itemForm.subtitle.trim(),
        description: itemForm.description.trim(),
        image_path: uploadedPath,
        cta_label: itemForm.ctaLabel.trim() || deriveDefaultCta(itemForm.kind),
        is_active: itemForm.isActive,
        action_key: itemForm.kind === 'action_card' ? itemForm.actionKey : null,
        coin_amount: itemForm.kind === 'coin_pack' ? Number(itemForm.coinAmount || '0') : null,
        vip_duration_days: itemForm.kind === 'vip_membership' ? Number(itemForm.vipDurationDays || '0') : null,
        metadata:
          itemForm.kind === 'vip_membership' && itemForm.metadataBenefits.trim()
            ? { benefits: itemForm.metadataBenefits.split(',').map((entry) => entry.trim()).filter(Boolean) }
            : {},
        prices,
        unlock_rule:
          itemForm.kind === 'physical_reward'
            ? {
                unlock_type: itemForm.unlockType,
                level_required: itemForm.unlockType === 'level' ? Number(itemForm.levelRequired || '0') : null,
                challenge_id: itemForm.unlockType === 'challenge' ? itemForm.challengeId || null : null,
                claim_once: itemForm.claimOnce,
              }
            : undefined,
      };

      await saveItem(payload);

      if (
        itemForm.file &&
        previousPath &&
        previousPath !== uploadedPath &&
        canDeleteStorageObject(previousPath)
      ) {
        await supabase.storage.from('shop-catalog').remove([previousPath]);
      }

      toast({
        title: itemForm.id ? 'Shop item updated' : 'Shop item created',
        description: itemForm.title,
      });
      setItemDialogOpen(false);
      setItemForm(createEmptyItemForm());
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Unable to save shop item.',
        variant: 'destructive',
      });
    }
  };

  const handleSaveSlot = async () => {
    try {
      if (!slotForm.itemId) {
        throw new Error('Select an item before placing it.');
      }

      const selectedItem = items.find((item) => item.id === slotForm.itemId);
      if (!selectedItem) {
        throw new Error('Selected item not found.');
      }

      if (slotForm.surfaceKey === 'shop.unlock_cards' && selectedItem.kind !== 'physical_reward') {
        throw new Error('Only physical rewards can be placed in the unlock row.');
      }

      if (slotForm.surfaceKey === 'shop.featured_cards' && selectedItem.kind === 'physical_reward') {
        throw new Error('Physical rewards must stay in the unlock row.');
      }

      await saveSlot({
        id: slotForm.id,
        surface_key: slotForm.surfaceKey,
        sort_order: Number(slotForm.sortOrder || '0'),
        item_id: slotForm.itemId,
        card_variant: slotForm.cardVariant,
        title_override: slotForm.titleOverride,
        subtitle_override: slotForm.subtitleOverride,
        cta_label_override: slotForm.ctaLabelOverride,
        is_active: slotForm.isActive,
      });

      toast({
        title: slotForm.id ? 'Placement updated' : 'Placement created',
        description: slotForm.surfaceKey,
      });
      setSlotDialogOpen(false);
      setSlotForm(createEmptySlotForm());
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Unable to save placement.',
        variant: 'destructive',
      });
    }
  };

  const handleToggleItem = async (item: AdminShopItemRecord) => {
    try {
      await setItemActive({ itemId: item.id, isActive: !item.is_active });
      toast({
        title: item.is_active ? 'Item deactivated' : 'Item activated',
        description: item.title,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Unable to change item status.',
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

  return (
    <AdminShell
      title="Shop Catalog"
      description="Canonical shop management for live cards, pricing, unlock rules, and claim moderation."
      actions={
        <>
          <Button variant="outline" onClick={() => refetch()} className={`h-11 ${ADMIN_OUTLINE_BUTTON_CLASS}`}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => openCreateSlotDialog()} className={`h-11 ${ADMIN_OUTLINE_BUTTON_CLASS}`}>
            <LayoutTemplate className="mr-2 h-4 w-4" />
            New placement
          </Button>
          <Button onClick={openCreateItemDialog} className="h-11 bg-[#ff1654] text-white hover:bg-[#ff1654]/90">
            <Plus className="mr-2 h-4 w-4" />
            New item
          </Button>
        </>
      }
    >
      <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="grid min-h-0 gap-4 xl:grid-rows-[repeat(4,minmax(0,120px))_minmax(0,1fr)]">
          <AdminStatCard label="Items" value={String(items.length)} icon={Package} />
          <AdminStatCard label="Featured slots" value={String(featuredCount)} icon={Boxes} accent="#72d2ff" />
          <AdminStatCard label="Unlock slots" value={String(unlockCount)} icon={ShieldCheck} accent="#72f1b8" />
          <AdminStatCard label="Pending claims" value={String(pendingClaimsCount)} icon={Sparkles} accent="#ff8a65" />

          <AdminPanel
            title="Publishing rules"
            description="The lower row is reserved for unlockable physical rewards. VIP prices must never exceed base prices."
            className="min-h-0"
            contentClassName="min-h-0 overflow-y-auto pr-1"
          >
            <div className="space-y-3 text-sm leading-6 text-white/58">
              <p>Use the catalog tab to define items, then place them into the exact public card rows from Placements.</p>
              <p>Claims stay pending until an admin marks them approved, fulfilled, rejected, or cancelled.</p>
            </div>
          </AdminPanel>
        </div>

        <AdminPanel
          title="Live shop workspace"
          description="Catalog, placements, and claim moderation are all driven by the canonical shop schema."
          className="h-full"
          contentClassName="min-h-0 h-full overflow-y-auto pr-1"
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full min-h-0 flex-col">
            <TabsList className="mb-4 w-fit bg-[#171012]">
              <TabsTrigger value="catalog">Catalog</TabsTrigger>
              <TabsTrigger value="placements">Placements</TabsTrigger>
              <TabsTrigger value="claims">Claims</TabsTrigger>
            </TabsList>

            <TabsContent value="catalog" className="mt-0 min-h-0 flex-1">
              <div className="mb-4 flex flex-wrap gap-3">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search items by title, slug, kind..."
                  className={`${ADMIN_FIELD_CLASS} max-w-[380px]`}
                />
              </div>

              {filteredItems.length === 0 && !isLoading ? (
                <AdminEmptyState
                  title="No catalog items yet"
                  description="Create the first coin pack, VIP offer, merch item, unlock reward, or action card."
                />
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {filteredItems.map((item) => {
                    const imageSrc = resolveShopCatalogImage(item.image_path);
                    const basePrice = item.prices.find((price) => price.audience === 'base');
                    const vipPrice = item.prices.find((price) => price.audience === 'vip');

                    return (
                      <div key={item.id} className="rounded-[24px] border border-[#302025] bg-[#1c1c1c] p-4">
                        <div className="flex flex-col gap-4 2xl:flex-row">
                          <div className="flex h-[148px] w-full items-center justify-center overflow-hidden rounded-[18px] border border-white/10 bg-[#1a0808] 2xl:w-[180px]">
                            {imageSrc ? (
                              <img src={imageSrc} alt={item.title} className="h-full w-full object-contain p-4" />
                            ) : (
                              <ImagePlus className="h-8 w-8 text-white/28" />
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
                                {item.is_active ? 'Active' : 'Inactive'}
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
                                CTA: <span className="font-semibold text-white">{item.cta_label || 'Default'}</span>
                              </div>
                              <div>
                                Unlock: <span className="font-semibold text-white">{item.unlockRule?.unlock_type ?? 'none'}</span>
                              </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <Button variant="outline" onClick={() => openEditItemDialog(item)} className={ADMIN_OUTLINE_BUTTON_CLASS}>
                                Edit
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

            <TabsContent value="placements" className="mt-0 min-h-0 flex-1">
              <div className="grid gap-4 xl:grid-cols-2">
                {SURFACE_OPTIONS.map((surface) => {
                  const surfaceSlots = slots.filter((slot) => slot.surface_key === surface.value);
                  return (
                    <div key={surface.value} className={`min-h-0 overflow-hidden ${ADMIN_INSET_PANEL_CLASS}`}>
                      <div className="flex items-start justify-between gap-4 border-b border-[#2b1a1f] px-4 py-4">
                        <div>
                          <h3 className="text-lg font-semibold text-white">{surface.label}</h3>
                          <p className="mt-1 text-sm leading-6 text-white/52">
                            {surface.value === 'shop.unlock_cards'
                              ? 'Only physical rewards are valid here.'
                              : 'Coin packs, VIP, products, and action cards live here.'}
                          </p>
                        </div>
                        <Button variant="outline" onClick={() => openCreateSlotDialog(surface.value)} className={ADMIN_OUTLINE_BUTTON_CLASS}>
                          Add
                        </Button>
                      </div>

                      <div className="space-y-3 p-4">
                        {surfaceSlots.length === 0 ? (
                          <AdminEmptyState
                            title="No placements yet"
                            description="Create the first live slot for this shop surface."
                          />
                        ) : (
                          surfaceSlots.map((slot) => {
                            const item = items.find((entry) => entry.id === slot.item_id);
                            return (
                              <div key={slot.id} className="rounded-[20px] border border-[#302025] bg-[#1c1c1c] p-4">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-base font-semibold text-white">{item?.title ?? 'Unknown item'}</h4>
                                  <span className="rounded-full border border-[#39242b] bg-[#171012] px-2.5 py-1 text-xs uppercase tracking-[0.2em] text-[#b7afb2]">
                                    order {slot.sort_order}
                                  </span>
                                  <span className="rounded-full border border-[#39242b] bg-[#171012] px-2.5 py-1 text-xs uppercase tracking-[0.2em] text-[#b7afb2]">
                                    {slot.card_variant}
                                  </span>
                                </div>
                                <p className="mt-2 text-sm text-white/56">
                                  Overrides: {slot.title_override || 'No title override'} / {slot.subtitle_override || 'No subtitle override'}
                                </p>
                                <div className="mt-4">
                                  <Button variant="outline" onClick={() => openEditSlotDialog(slot)} className={ADMIN_OUTLINE_BUTTON_CLASS}>
                                    Edit placement
                                  </Button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="claims" className="mt-0 min-h-0 flex-1">
              {claims.length === 0 ? (
                <AdminEmptyState
                  title="No reward claims yet"
                  description="Player claims for unlockable physical rewards will appear here."
                />
              ) : (
                <div className="space-y-4">
                  {claims.map((claim) => (
                    <div key={claim.id} className="rounded-[24px] border border-[#302025] bg-[#1c1c1c] p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-white">{claim.itemTitle}</h3>
                        <span className="rounded-full border border-[#39242b] bg-[#171012] px-2.5 py-1 text-xs uppercase tracking-[0.2em] text-[#b7afb2]">
                          {claim.status}
                        </span>
                        <span className="rounded-full border border-[#39242b] bg-[#171012] px-2.5 py-1 text-xs uppercase tracking-[0.2em] text-[#b7afb2]">
                          user {claim.user_id}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-white/58">Requested at {new Date(claim.requested_at).toLocaleString()}</p>

                      <Textarea
                        value={claimNotes[claim.id] ?? claim.admin_note}
                        onChange={(event) => setClaimNotes((current) => ({ ...current, [claim.id]: event.target.value }))}
                        className={`${ADMIN_FIELD_CLASS} mt-4 min-h-[110px]`}
                        placeholder="Admin note for this claim..."
                      />

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

      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className={`${ADMIN_DIALOG_CLASS} max-h-[90vh] overflow-y-auto sm:max-w-[980px]`}>
          <DialogHeader>
            <DialogTitle>{itemForm.id ? 'Edit shop item' : 'Create shop item'}</DialogTitle>
            <DialogDescription className="text-white/56">
              Configure item content, audience pricing, unlock rules, and the live card preview before publishing.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm text-white/64">Kind</label>
                <select
                  value={itemForm.kind}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      kind: event.target.value as ShopItemKind,
                      priceCurrency: priceCurrencyForKind(event.target.value as ShopItemKind),
                      ctaLabel: deriveDefaultCta(event.target.value as ShopItemKind),
                      actionKey: event.target.value === 'action_card' ? current.actionKey : '',
                      unlockType: event.target.value === 'physical_reward' ? current.unlockType : 'none',
                    }))
                  }
                  className={`${ADMIN_FIELD_CLASS} h-12 rounded-[16px] bg-[#171012] px-4 text-white`}
                >
                  {ITEM_KIND_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <label className="text-sm text-white/64">Slug</label>
                <Input value={itemForm.slug} onChange={(event) => setItemForm((current) => ({ ...current, slug: event.target.value }))} className={ADMIN_FIELD_CLASS} />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm text-white/64">Title</label>
                <Input value={itemForm.title} onChange={(event) => setItemForm((current) => ({ ...current, title: event.target.value }))} className={ADMIN_FIELD_CLASS} />
              </div>

              <div className="grid gap-2">
                <label className="text-sm text-white/64">Subtitle</label>
                <Input value={itemForm.subtitle} onChange={(event) => setItemForm((current) => ({ ...current, subtitle: event.target.value }))} className={ADMIN_FIELD_CLASS} />
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm text-white/64">Description</label>
              <Textarea value={itemForm.description} onChange={(event) => setItemForm((current) => ({ ...current, description: event.target.value }))} className={`${ADMIN_FIELD_CLASS} min-h-[120px]`} />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
              <div className="grid gap-2">
                <label className="text-sm text-white/64">Image path or uploaded file</label>
                <Input value={itemForm.imagePath} onChange={(event) => setItemForm((current) => ({ ...current, imagePath: event.target.value, imagePreview: resolveShopCatalogImage(event.target.value) }))} className={ADMIN_FIELD_CLASS} />
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setItemForm((current) => ({
                      ...current,
                      file,
                      imagePreview: file ? URL.createObjectURL(file) : current.imagePreview,
                    }));
                  }}
                  className={ADMIN_FIELD_CLASS}
                />
              </div>

              <div className="flex h-[140px] items-center justify-center overflow-hidden rounded-[18px] border border-white/10 bg-[#171012]">
                {itemForm.imagePreview ? (
                  <img src={itemForm.imagePreview} alt="Preview" className="h-full w-full object-contain p-4" />
                ) : (
                  <Eye className="h-7 w-7 text-white/28" />
                )}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="grid gap-2">
                <label className="text-sm text-white/64">CTA label</label>
                <Input value={itemForm.ctaLabel} onChange={(event) => setItemForm((current) => ({ ...current, ctaLabel: event.target.value }))} className={ADMIN_FIELD_CLASS} />
              </div>

              <div className="grid gap-2">
                <label className="text-sm text-white/64">Active</label>
                <div className={`${ADMIN_FIELD_CLASS} flex h-12 items-center justify-between rounded-[16px] px-4`}>
                  <span className="text-white/72">{itemForm.isActive ? 'Live' : 'Draft'}</span>
                  <Switch checked={itemForm.isActive} onCheckedChange={(checked) => setItemForm((current) => ({ ...current, isActive: checked }))} />
                </div>
              </div>

              {itemForm.kind === 'action_card' ? (
                <div className="grid gap-2">
                  <label className="text-sm text-white/64">Action key</label>
                  <select
                    value={itemForm.actionKey}
                    onChange={(event) => setItemForm((current) => ({ ...current, actionKey: event.target.value as ShopActionKey | '' }))}
                    className={`${ADMIN_FIELD_CLASS} h-12 rounded-[16px] bg-[#171012] px-4 text-white`}
                  >
                    <option value="">Select action</option>
                    {SHOP_ACTION_KEYS.map((action) => (
                      <option key={action} value={action}>
                        {action}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>

            {itemForm.kind === 'coin_pack' ? (
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="grid gap-2">
                  <label className="text-sm text-white/64">Coins granted</label>
                  <Input value={itemForm.coinAmount} onChange={(event) => setItemForm((current) => ({ ...current, coinAmount: event.target.value }))} className={ADMIN_FIELD_CLASS} />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm text-white/64">Base EUR price</label>
                  <Input value={itemForm.basePrice} onChange={(event) => setItemForm((current) => ({ ...current, basePrice: event.target.value }))} className={ADMIN_FIELD_CLASS} />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm text-white/64">VIP EUR price</label>
                  <Input value={itemForm.vipPrice} onChange={(event) => setItemForm((current) => ({ ...current, vipPrice: event.target.value }))} className={ADMIN_FIELD_CLASS} />
                </div>
              </div>
            ) : null}

            {itemForm.kind === 'vip_membership' ? (
              <div className="grid gap-4 lg:grid-cols-4">
                <div className="grid gap-2">
                  <label className="text-sm text-white/64">Duration days</label>
                  <Input value={itemForm.vipDurationDays} onChange={(event) => setItemForm((current) => ({ ...current, vipDurationDays: event.target.value }))} className={ADMIN_FIELD_CLASS} />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm text-white/64">Base coin price</label>
                  <Input value={itemForm.basePrice} onChange={(event) => setItemForm((current) => ({ ...current, basePrice: event.target.value }))} className={ADMIN_FIELD_CLASS} />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm text-white/64">VIP coin price</label>
                  <Input value={itemForm.vipPrice} onChange={(event) => setItemForm((current) => ({ ...current, vipPrice: event.target.value }))} className={ADMIN_FIELD_CLASS} />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm text-white/64">Benefits (comma separated)</label>
                  <Input value={itemForm.metadataBenefits} onChange={(event) => setItemForm((current) => ({ ...current, metadataBenefits: event.target.value }))} className={ADMIN_FIELD_CLASS} />
                </div>
              </div>
            ) : null}

            {itemForm.kind === 'physical_product' ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="grid gap-2">
                  <label className="text-sm text-white/64">Base EUR price</label>
                  <Input value={itemForm.basePrice} onChange={(event) => setItemForm((current) => ({ ...current, basePrice: event.target.value }))} className={ADMIN_FIELD_CLASS} />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm text-white/64">VIP EUR price</label>
                  <Input value={itemForm.vipPrice} onChange={(event) => setItemForm((current) => ({ ...current, vipPrice: event.target.value }))} className={ADMIN_FIELD_CLASS} />
                </div>
              </div>
            ) : null}

            {itemForm.kind === 'physical_reward' ? (
              <div className="grid gap-4 lg:grid-cols-4">
                <div className="grid gap-2">
                  <label className="text-sm text-white/64">Unlock type</label>
                  <select
                    value={itemForm.unlockType}
                    onChange={(event) => setItemForm((current) => ({ ...current, unlockType: event.target.value as ShopUnlockType }))}
                    className={`${ADMIN_FIELD_CLASS} h-12 rounded-[16px] bg-[#171012] px-4 text-white`}
                  >
                    <option value="none">None</option>
                    <option value="level">Level</option>
                    <option value="challenge">Challenge</option>
                  </select>
                </div>

                {itemForm.unlockType === 'level' ? (
                  <div className="grid gap-2">
                    <label className="text-sm text-white/64">Level required</label>
                    <Input value={itemForm.levelRequired} onChange={(event) => setItemForm((current) => ({ ...current, levelRequired: event.target.value }))} className={ADMIN_FIELD_CLASS} />
                  </div>
                ) : null}

                {itemForm.unlockType === 'challenge' ? (
                  <div className="grid gap-2 lg:col-span-2">
                    <label className="text-sm text-white/64">Challenge required</label>
                    <select
                      value={itemForm.challengeId}
                      onChange={(event) => setItemForm((current) => ({ ...current, challengeId: event.target.value }))}
                      className={`${ADMIN_FIELD_CLASS} h-12 rounded-[16px] bg-[#171012] px-4 text-white`}
                    >
                      <option value="">Select challenge</option>
                      {challenges.map((challenge: ChallengeRow) => (
                        <option key={challenge.id} value={challenge.id}>
                          {challenge.title}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <div className="grid gap-2">
                  <label className="text-sm text-white/64">Claim once</label>
                  <div className={`${ADMIN_FIELD_CLASS} flex h-12 items-center justify-between rounded-[16px] px-4`}>
                    <span className="text-white/72">{itemForm.claimOnce ? 'Yes' : 'No'}</span>
                    <Switch checked={itemForm.claimOnce} onCheckedChange={(checked) => setItemForm((current) => ({ ...current, claimOnce: checked }))} />
                  </div>
                </div>
              </div>
            ) : null}

            <ItemEditorPreview form={itemForm} baseLabel={baseLabel} vipLabel={vipLabel} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialogOpen(false)} className={ADMIN_OUTLINE_BUTTON_CLASS}>
              Cancel
            </Button>
            <Button onClick={handleSaveItem} disabled={savingItem} className="bg-[#ff1654] text-white hover:bg-[#ff1654]/90">
              {savingItem ? 'Saving...' : itemForm.id ? 'Save item' : 'Create item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={slotDialogOpen} onOpenChange={setSlotDialogOpen}>
        <DialogContent className={`${ADMIN_DIALOG_CLASS} max-h-[90vh] overflow-y-auto sm:max-w-[760px]`}>
          <DialogHeader>
            <DialogTitle>{slotForm.id ? 'Edit placement' : 'Create placement'}</DialogTitle>
            <DialogDescription className="text-white/56">
              Assign catalog items to the featured or unlock rows exactly as they should appear on the public shop page.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm text-white/64">Surface</label>
                <select
                  value={slotForm.surfaceKey}
                  onChange={(event) => {
                    const surfaceKey = event.target.value as SlotFormState['surfaceKey'];
                    setSlotForm((current) => ({
                      ...current,
                      surfaceKey,
                      cardVariant: surfaceKey === 'shop.unlock_cards' ? 'reward' : current.cardVariant,
                      itemId:
                        surfaceKey === 'shop.unlock_cards'
                          ? physicalRewardItems[0]?.id ?? ''
                          : current.itemId,
                    }));
                  }}
                  className={`${ADMIN_FIELD_CLASS} h-12 rounded-[16px] bg-[#171012] px-4 text-white`}
                >
                  {SURFACE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <label className="text-sm text-white/64">Sort order</label>
                <Input value={slotForm.sortOrder} onChange={(event) => setSlotForm((current) => ({ ...current, sortOrder: event.target.value }))} className={ADMIN_FIELD_CLASS} />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm text-white/64">Item</label>
                <select
                  value={slotForm.itemId}
                  onChange={(event) => setSlotForm((current) => ({ ...current, itemId: event.target.value }))}
                  className={`${ADMIN_FIELD_CLASS} h-12 rounded-[16px] bg-[#171012] px-4 text-white`}
                >
                  <option value="">Select item</option>
                  {(slotForm.surfaceKey === 'shop.unlock_cards' ? physicalRewardItems : featuredItems).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title} ({item.kind})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <label className="text-sm text-white/64">Card variant</label>
                <select
                  value={slotForm.cardVariant}
                  onChange={(event) => setSlotForm((current) => ({ ...current, cardVariant: event.target.value as ShopCardVariant }))}
                  className={`${ADMIN_FIELD_CLASS} h-12 rounded-[16px] bg-[#171012] px-4 text-white`}
                >
                  {['default', 'coins', 'reward', 'action'].map((variant) => (
                    <option key={variant} value={variant}>
                      {variant}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="grid gap-2">
                <label className="text-sm text-white/64">Title override</label>
                <Input value={slotForm.titleOverride} onChange={(event) => setSlotForm((current) => ({ ...current, titleOverride: event.target.value }))} className={ADMIN_FIELD_CLASS} />
              </div>
              <div className="grid gap-2">
                <label className="text-sm text-white/64">Subtitle override</label>
                <Input value={slotForm.subtitleOverride} onChange={(event) => setSlotForm((current) => ({ ...current, subtitleOverride: event.target.value }))} className={ADMIN_FIELD_CLASS} />
              </div>
              <div className="grid gap-2">
                <label className="text-sm text-white/64">CTA override</label>
                <Input value={slotForm.ctaLabelOverride} onChange={(event) => setSlotForm((current) => ({ ...current, ctaLabelOverride: event.target.value }))} className={ADMIN_FIELD_CLASS} />
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm text-white/64">Active</label>
              <div className={`${ADMIN_FIELD_CLASS} flex h-12 items-center justify-between rounded-[16px] px-4`}>
                <span className="text-white/72">{slotForm.isActive ? 'Live slot' : 'Hidden slot'}</span>
                <Switch checked={slotForm.isActive} onCheckedChange={(checked) => setSlotForm((current) => ({ ...current, isActive: checked }))} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSlotDialogOpen(false)} className={ADMIN_OUTLINE_BUTTON_CLASS}>
              Cancel
            </Button>
            <Button onClick={handleSaveSlot} disabled={savingSlot} className="bg-[#ff1654] text-white hover:bg-[#ff1654]/90">
              {savingSlot ? 'Saving...' : slotForm.id ? 'Save placement' : 'Create placement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

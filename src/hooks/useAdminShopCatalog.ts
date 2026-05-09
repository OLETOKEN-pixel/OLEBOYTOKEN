import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { supabase } from '@/integrations/supabase/client';
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

export function useAdminShopCatalog() {
  const { isAdmin } = useAdminStatus();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['admin-shop-workspaces'],
    enabled: isAdmin,
    queryFn: async () => {
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

      return {
        draft: normalizeWorkspaceSnapshot(draftPayload, 'draft'),
        live: normalizeWorkspaceSnapshot(livePayload, 'live'),
      };
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

  const draft = query.data?.draft ?? {
    workspace: 'draft' as const,
    items: [],
    slots: [],
    presentations: [],
    challenges: [],
  };
  const live = query.data?.live ?? {
    workspace: 'live' as const,
    items: [],
    slots: [],
    presentations: [],
    challenges: [],
  };

  const hasUnpublishedChanges = useMemo(
    () => stableWorkspaceHash(draft) !== stableWorkspaceHash(live),
    [draft, live],
  );

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
    hasUnpublishedChanges,
    saveItem: saveItem.mutateAsync,
    saveSlot: saveSlot.mutateAsync,
    setItemActive: setItemActive.mutateAsync,
    publishCatalog: publishCatalog.mutateAsync,
    savingItem: saveItem.isPending,
    savingSlot: saveSlot.isPending,
    togglingItem: setItemActive.isPending,
    publishingCatalog: publishCatalog.isPending,
  };
}

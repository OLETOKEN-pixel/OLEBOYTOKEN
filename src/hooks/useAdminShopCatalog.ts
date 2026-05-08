import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type ShopItemRow = Database['public']['Tables']['shop_items']['Row'];
type ShopPriceRow = Database['public']['Tables']['shop_item_prices']['Row'];
type ShopUnlockRuleRow = Database['public']['Tables']['shop_item_unlock_rules']['Row'];
type ShopSurfaceSlotRow = Database['public']['Tables']['shop_surface_slots']['Row'];
type ChallengeRow = Database['public']['Tables']['challenges']['Row'];

export type AdminShopItemRecord = ShopItemRow & {
  prices: ShopPriceRow[];
  unlockRule: ShopUnlockRuleRow | null;
};

export function useAdminShopCatalog() {
  const { isAdmin } = useAdminStatus();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['admin-shop-catalog'],
    enabled: isAdmin,
    queryFn: async () => {
      const [itemsRes, pricesRes, rulesRes, slotsRes, challengesRes] = await Promise.all([
        supabase.from('shop_items').select('*').order('created_at', { ascending: true }),
        supabase.from('shop_item_prices').select('*').order('created_at', { ascending: true }),
        supabase.from('shop_item_unlock_rules').select('*'),
        supabase.from('shop_surface_slots').select('*').order('surface_key', { ascending: true }).order('sort_order', { ascending: true }),
        supabase.from('challenges').select('*').order('type', { ascending: true }).order('sort_order', { ascending: true }),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (pricesRes.error) throw pricesRes.error;
      if (rulesRes.error) throw rulesRes.error;
      if (slotsRes.error) throw slotsRes.error;
      if (challengesRes.error) throw challengesRes.error;

      return {
        items: (itemsRes.data ?? []) as ShopItemRow[],
        prices: (pricesRes.data ?? []) as ShopPriceRow[],
        unlockRules: (rulesRes.data ?? []) as ShopUnlockRuleRow[],
        slots: (slotsRes.data ?? []) as ShopSurfaceSlotRow[],
        challenges: (challengesRes.data ?? []) as ChallengeRow[],
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
      queryClient.invalidateQueries({ queryKey: ['admin-shop-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['shop-catalog'] });
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
      queryClient.invalidateQueries({ queryKey: ['admin-shop-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['shop-catalog'] });
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
      queryClient.invalidateQueries({ queryKey: ['admin-shop-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['shop-catalog'] });
    },
  });

  const data = query.data ?? {
    items: [] as ShopItemRow[],
    prices: [] as ShopPriceRow[],
    unlockRules: [] as ShopUnlockRuleRow[],
    slots: [] as ShopSurfaceSlotRow[],
    challenges: [] as ChallengeRow[],
  };

  const itemRecords = useMemo<AdminShopItemRecord[]>(() => {
    return data.items.map((item) => ({
      ...item,
      prices: data.prices.filter((price) => price.item_id === item.id),
      unlockRule: data.unlockRules.find((rule) => rule.item_id === item.id) ?? null,
    }));
  }, [data.items, data.prices, data.unlockRules]);

  return {
    ...query,
    items: itemRecords,
    prices: data.prices,
    slots: data.slots,
    challenges: data.challenges,
    saveItem: saveItem.mutateAsync,
    saveSlot: saveSlot.mutateAsync,
    setItemActive: setItemActive.mutateAsync,
    savingItem: saveItem.isPending,
    savingSlot: saveSlot.isPending,
    togglingItem: setItemActive.isPending,
  };
}

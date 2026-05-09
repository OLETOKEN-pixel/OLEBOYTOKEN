import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  createFallbackShopCatalog,
  normalizeShopCatalogPayload,
  toShopCardViewModel,
  type ShopCatalogPayload,
} from '@/lib/shopCatalog';

export function useShopCatalog() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['shop-catalog', user?.id ?? 'guest'],
    initialData: createFallbackShopCatalog({
      userId: user?.id ?? null,
      isAuthenticated: Boolean(user),
    }),
    queryFn: async () => {
      const response = await supabase.rpc('get_shop_catalog');
      if (!response || typeof response !== 'object') {
        return createFallbackShopCatalog({
          userId: user?.id ?? null,
          isAuthenticated: Boolean(user),
        });
      }

      const { data, error } = response as { data?: unknown; error?: unknown };

      if (error) {
        console.error('Error fetching shop catalog:', error);
        return createFallbackShopCatalog({
          userId: user?.id ?? null,
          isAuthenticated: Boolean(user),
        });
      }

      return normalizeShopCatalogPayload(data, {
        userId: user?.id ?? null,
        isAuthenticated: Boolean(user),
      });
    },
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (typeof supabase.channel !== 'function' || typeof supabase.removeChannel !== 'function') {
      return;
    }

    const tables = ['shop_items', 'shop_item_prices', 'shop_item_unlock_rules', 'shop_surface_slots', 'shop_slot_presentations'] as const;
    const channels = tables.map((table) =>
      supabase
        .channel(`shop-catalog-${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
          queryClient.invalidateQueries({ queryKey: ['shop-catalog'] });
        })
        .subscribe(),
    );

    const claimChannel = user
      ? supabase
          .channel(`shop-catalog-claims-${user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'shop_item_claims',
              filter: `user_id=eq.${user.id}`,
            },
            () => {
              queryClient.invalidateQueries({ queryKey: ['shop-catalog'] });
            },
          )
          .subscribe()
      : null;

    return () => {
      channels.forEach((channel) => supabase.removeChannel(channel));
      if (claimChannel) supabase.removeChannel(claimChannel);
    };
  }, [queryClient, user]);

  const claimMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { data, error } = await supabase.rpc('claim_shop_reward', { p_item_id: itemId });
      if (error) throw error;
      return data as { success?: boolean; error?: string; status?: string; claim_id?: string } | null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-catalog'] });
    },
  });

  const catalog = (query.data ?? createFallbackShopCatalog({
    userId: user?.id ?? null,
    isAuthenticated: Boolean(user),
  })) as ShopCatalogPayload;

  return {
    ...query,
    catalog,
    featuredCards: catalog.featuredCards.map(toShopCardViewModel),
    unlockCards: catalog.unlockCards.map(toShopCardViewModel),
    coinPacks: catalog.coinPacks,
    vipOffer: catalog.vipOffer,
    claimReward: claimMutation.mutateAsync,
    isClaiming: claimMutation.isPending,
  };
}

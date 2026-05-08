import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type ClaimRow = Database['public']['Tables']['shop_item_claims']['Row'];
type ShopItemRow = Database['public']['Tables']['shop_items']['Row'];

export type AdminShopClaimRecord = ClaimRow & {
  itemTitle: string;
  itemSlug: string;
  itemImage: string;
};

export function useShopClaims() {
  const { isAdmin } = useAdminStatus();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['admin-shop-claims'],
    enabled: isAdmin,
    queryFn: async () => {
      const [claimsRes, itemsRes] = await Promise.all([
        supabase.from('shop_item_claims').select('*').order('requested_at', { ascending: false }),
        supabase.from('shop_items').select('*'),
      ]);

      if (claimsRes.error) throw claimsRes.error;
      if (itemsRes.error) throw itemsRes.error;

      return {
        claims: (claimsRes.data ?? []) as ClaimRow[],
        items: (itemsRes.data ?? []) as ShopItemRow[],
      };
    },
    staleTime: 5_000,
    refetchOnWindowFocus: false,
  });

  const updateClaim = useMutation({
    mutationFn: async ({
      claimId,
      status,
      adminNote,
    }: {
      claimId: string;
      status: string;
      adminNote: string;
    }) => {
      const { data, error } = await supabase.rpc('admin_update_shop_claim', {
        p_claim_id: claimId,
        p_status: status,
        p_admin_note: adminNote,
      });
      if (error) throw error;
      const result = data as { success?: boolean; error?: string } | null;
      if (!result?.success) {
        throw new Error(result?.error || 'Unable to update claim.');
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shop-claims'] });
      queryClient.invalidateQueries({ queryKey: ['shop-catalog'] });
    },
  });

  const data = query.data ?? {
    claims: [] as ClaimRow[],
    items: [] as ShopItemRow[],
  };

  const claims = useMemo<AdminShopClaimRecord[]>(() => {
    return data.claims.map((claim) => {
      const item = data.items.find((entry) => entry.id === claim.item_id);
      return {
        ...claim,
        itemTitle: item?.title ?? 'Unknown item',
        itemSlug: item?.slug ?? claim.item_id,
        itemImage: item?.image_path ?? '',
      };
    });
  }, [data.claims, data.items]);

  return {
    ...query,
    claims,
    updateClaim: updateClaim.mutateAsync,
    updatingClaim: updateClaim.isPending,
  };
}

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LEVEL_REWARDS, mapShopLevelReward, sortLevelRewards, type LevelReward } from '@/lib/levelRewards';

type UseShopLevelRewardsOptions = {
  includeInactive?: boolean;
};

export function useShopLevelRewards(options: UseShopLevelRewardsOptions = {}) {
  const { includeInactive = false } = options;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['shop-level-rewards', includeInactive ? 'all' : 'active'],
    initialData: includeInactive ? ([] as LevelReward[]) : LEVEL_REWARDS,
    queryFn: async () => {
      let queryBuilder = supabase
        .from('shop_level_rewards')
        .select('*')
        .order('level_required', { ascending: true });

      if (!includeInactive) {
        queryBuilder = queryBuilder.eq('is_active', true);
      }

      const { data, error } = await queryBuilder;

      if (error) {
        console.error('Error fetching shop rewards:', error);
        return includeInactive ? [] : LEVEL_REWARDS;
      }

      const rewards = ((data || []).map(mapShopLevelReward));

      if (!includeInactive && rewards.length === 0) {
        return LEVEL_REWARDS;
      }

      return sortLevelRewards(rewards);
    },
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`shop-level-rewards-${includeInactive ? 'all' : 'active'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shop_level_rewards',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['shop-level-rewards'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [includeInactive, queryClient]);

  return {
    ...query,
    rewards: query.data ?? (includeInactive ? [] : LEVEL_REWARDS),
  };
}

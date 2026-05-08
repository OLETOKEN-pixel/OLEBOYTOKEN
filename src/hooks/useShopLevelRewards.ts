import { useMemo } from 'react';
import { useShopCatalog } from '@/hooks/useShopCatalog';
import { LEVEL_REWARDS, sortLevelRewards, type LevelReward } from '@/lib/levelRewards';
import { mapCatalogToLevelRewards } from '@/lib/shopCatalog';

type UseShopLevelRewardsOptions = {
  includeInactive?: boolean;
};

export function useShopLevelRewards(_options: UseShopLevelRewardsOptions = {}) {
  const catalogQuery = useShopCatalog();

  const rewards = useMemo<LevelReward[]>(() => {
    const mapped = mapCatalogToLevelRewards(catalogQuery.catalog);
    return mapped.length > 0 ? sortLevelRewards(mapped) : LEVEL_REWARDS;
  }, [catalogQuery.catalog]);

  return {
    ...catalogQuery,
    rewards,
    data: rewards,
    refetch: catalogQuery.refetch,
  };
}

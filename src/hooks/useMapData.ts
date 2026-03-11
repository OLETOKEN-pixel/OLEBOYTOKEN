import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { fetchMapVersions, fetchCurrentMap, fetchPOIs } from '@/services/fortniteMapService';

const FIVE_MINUTES = 5 * 60 * 1000;

export function useMapVersions() {
  return useQuery({
    queryKey: queryKeys.strategy.mapVersions,
    queryFn: fetchMapVersions,
    staleTime: FIVE_MINUTES,
  });
}

export function useCurrentMap() {
  return useQuery({
    queryKey: queryKeys.strategy.currentMap,
    queryFn: fetchCurrentMap,
    staleTime: FIVE_MINUTES,
  });
}

export function useMapPOIs(mapVersionId: string) {
  return useQuery({
    queryKey: queryKeys.strategy.pois(mapVersionId),
    queryFn: () => fetchPOIs(mapVersionId),
    enabled: !!mapVersionId,
    staleTime: FIVE_MINUTES,
  });
}

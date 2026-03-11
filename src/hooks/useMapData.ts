import { useMemo } from 'react';
import { currentMapConfig } from '@/data/mapConfig';
import { pois } from '@/data/pois';
import { chestSpawns, chestStats } from '@/data/chestSpawns';

/**
 * Phase 1: All data is static (embedded in code).
 * No API calls needed. These hooks provide a clean interface
 * for components and can be swapped to fetch from API in Phase 2.
 */

export function useMapConfig() {
  return currentMapConfig;
}

export function usePOIData() {
  return pois;
}

export function useChestData() {
  return useMemo(() => ({
    chests: chestSpawns,
    stats: chestStats,
  }), []);
}

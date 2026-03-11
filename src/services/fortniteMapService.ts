/**
 * Fortnite Map Service
 *
 * Phase 1: All data is static (embedded in TypeScript files).
 * See src/data/mapConfig.ts, src/data/pois.ts, src/data/chestSpawns.ts
 *
 * Phase 2: This file will contain API calls to fetch map data
 * from our own backend or from verified external APIs.
 *
 * Source verification: docs/SOURCE_VERIFICATION_REPORT.md
 */

// Re-export data for convenience
export { currentMapConfig } from '@/data/mapConfig';
export { pois } from '@/data/pois';
export { chestSpawns, chestStats } from '@/data/chestSpawns';

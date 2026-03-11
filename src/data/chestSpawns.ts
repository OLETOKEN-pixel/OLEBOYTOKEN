import type { ChestSpawn, ChestType } from '@/types/strategy';

/**
 * Chest spawn dataset for Chapter 7 Season 1 (patch 39.51).
 *
 * Source: manual_curation
 * Confidence: estimated
 *
 * IMPORTANT: These positions are ESTIMATED based on POI locations.
 * They are NOT extracted from game files. All entries are marked
 * confidence: 'estimated'. For verified positions, use FModel to
 * extract from game pak files and update this dataset.
 *
 * Methodology:
 * - Chests distributed around known POI positions
 * - Named locations get more chests (12-20 regular, 2-4 rare)
 * - Landmarks get fewer (3-8 regular, 0-2 rare)
 * - Small random offsets simulate in-building distribution
 * - Spawn rates are estimates (0.7-0.9 for regular, 0.3-0.6 for rare)
 */

// Coordinate bounds matching pois.ts
const GAME_MIN = -90000;
const GAME_RANGE = 180000;

function g2n(gameX: number, gameY: number): { xNorm: number; yNorm: number } {
  return {
    xNorm: (gameX - GAME_MIN) / GAME_RANGE,
    yNorm: 1 - (gameY - GAME_MIN) / GAME_RANGE,
  };
}

// Deterministic pseudo-random offset based on seed
function offset(seed: number, range: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return ((x - Math.floor(x)) - 0.5) * 2 * range;
}

interface LocationDef {
  name: string;
  x: number;
  y: number;
  regularCount: number;
  rareCount: number;
  spread: number; // game units spread around center
}

// Named locations: more chests, larger spread
const namedLocations: LocationDef[] = [
  { name: 'Bumpy Bay', x: -66464, y: -1875, regularCount: 18, rareCount: 3, spread: 4000 },
  { name: 'Fore Fields', x: 89184, y: -5843, regularCount: 15, rareCount: 3, spread: 3500 },
  { name: 'Sandy Strip', x: 52320, y: -13202, regularCount: 16, rareCount: 3, spread: 3500 },
  { name: 'Sunset Falls', x: -16601, y: -31256, regularCount: 14, rareCount: 2, spread: 3000 },
  { name: 'Lethal Labs', x: -11187, y: -38, regularCount: 16, rareCount: 3, spread: 3500 },
  { name: 'Serenity Pools', x: 23172, y: -19156, regularCount: 12, rareCount: 2, spread: 3000 },
  { name: 'Storm Station', x: -21669, y: -89944, regularCount: 14, rareCount: 3, spread: 3000 },
  { name: 'Tiptop Terrace', x: -77920, y: -52192, regularCount: 12, rareCount: 2, spread: 3000 },
  { name: 'Wonkeeland', x: -41761, y: -55346, regularCount: 15, rareCount: 3, spread: 3500 },
  { name: 'Latte Landing', x: 39008, y: -75666, regularCount: 14, rareCount: 2, spread: 3000 },
  { name: 'Painted Palms', x: 57319, y: -53005, regularCount: 14, rareCount: 2, spread: 3000 },
  { name: 'Classified Canyon', x: 46614, y: 58827, regularCount: 15, rareCount: 3, spread: 3500 },
  { name: 'Humble Hills', x: -57248, y: 27758, regularCount: 12, rareCount: 2, spread: 3000 },
  { name: 'Ripped Tides', x: -82848, y: 58478, regularCount: 12, rareCount: 2, spread: 3000 },
  { name: 'Sus Studios', x: 11190, y: 51586, regularCount: 14, rareCount: 3, spread: 3000 },
  { name: 'Perfect Plunge', x: 5924, y: 79928, regularCount: 12, rareCount: 2, spread: 3000 },
  { name: 'Fun Factory', x: 23028, y: 23344, regularCount: 16, rareCount: 3, spread: 3500 },
  { name: 'Battlewood Boulevard', x: -28672, y: 68608, regularCount: 14, rareCount: 2, spread: 3500 },
];

// Landmarks: fewer chests, smaller spread
const landmarks: LocationDef[] = [
  { name: "Looper's Leap", x: 49592, y: 39944, regularCount: 6, rareCount: 1, spread: 2000 },
  { name: 'Clawsy Lodge', x: -2136, y: -64876, regularCount: 5, rareCount: 1, spread: 1500 },
  { name: "Ol' Stumpy", x: -61368, y: -33824, regularCount: 4, rareCount: 0, spread: 1500 },
  { name: 'Carmine Lodge', x: 7436, y: 7128, regularCount: 6, rareCount: 1, spread: 2000 },
  { name: 'Pumping Station', x: 23527, y: -45946, regularCount: 5, rareCount: 1, spread: 1500 },
  { name: 'Espresso Experiments', x: 15741, y: -70365, regularCount: 6, rareCount: 1, spread: 2000 },
  { name: "Nature's Vine Restaurant", x: -22604, y: 29896, regularCount: 4, rareCount: 1, spread: 1500 },
  { name: 'Peelian Swamp', x: 42956, y: -51952, regularCount: 5, rareCount: 1, spread: 2000 },
  { name: 'Fore Shores', x: 89360, y: -25900, regularCount: 4, rareCount: 0, spread: 1500 },
  { name: "Slice O' Shore", x: 89972, y: 32716, regularCount: 4, rareCount: 1, spread: 1500 },
  { name: 'Mezzo-Piano Tunnel', x: 8964, y: -8216, regularCount: 5, rareCount: 1, spread: 1500 },
  { name: 'Toybox Docks', x: -74444, y: -77396, regularCount: 6, rareCount: 1, spread: 2000 },
  { name: 'Artsy RVs', x: 70776, y: 60840, regularCount: 4, rareCount: 0, spread: 1500 },
  { name: 'Bayside Mansion', x: -85336, y: 15516, regularCount: 5, rareCount: 1, spread: 1800 },
  { name: "Hiker's Haven", x: 69448, y: 7956, regularCount: 4, rareCount: 1, spread: 1500 },
  { name: 'Cosmic Durr', x: 31272, y: 44584, regularCount: 5, rareCount: 1, spread: 1500 },
  { name: 'The Basement', x: 6692, y: -26644, regularCount: 6, rareCount: 1, spread: 1500 },
  { name: 'Peelian Colony', x: 89360, y: -61984, regularCount: 5, rareCount: 1, spread: 1800 },
  { name: 'Battlewood Sign', x: -35700, y: 33536, regularCount: 3, rareCount: 0, spread: 1200 },
  { name: 'The Orchard House', x: -1440, y: 27336, regularCount: 5, rareCount: 1, spread: 1500 },
  { name: 'Collider Corridor X', x: -7215, y: -300, regularCount: 4, rareCount: 1, spread: 1200 },
  { name: 'Collider Corridor Theta', x: 32418, y: -11254, regularCount: 4, rareCount: 1, spread: 1200 },
  { name: 'Collider Corridor Beta', x: 51448, y: 21472, regularCount: 4, rareCount: 1, spread: 1200 },
  { name: 'Collider Corridor Gamma', x: -9992, y: 41884, regularCount: 4, rareCount: 1, spread: 1200 },
  { name: 'Collider Corridor Alpha', x: 33428, y: 50380, regularCount: 4, rareCount: 1, spread: 1200 },
];

function generateChests(locations: LocationDef[]): ChestSpawn[] {
  const chests: ChestSpawn[] = [];
  let id = 0;

  for (const loc of locations) {
    // Generate regular chests
    for (let i = 0; i < loc.regularCount; i++) {
      const seed = id * 7 + i * 13;
      const gx = loc.x + offset(seed, loc.spread);
      const gy = loc.y + offset(seed + 1, loc.spread);
      const { xNorm, yNorm } = g2n(gx, gy);

      chests.push({
        id: `chest-r-${id++}`,
        chestType: 'regular_chest',
        xNorm: Math.max(0, Math.min(1, xNorm)),
        yNorm: Math.max(0, Math.min(1, yNorm)),
        locationName: loc.name,
        spawnRate: 0.75 + (offset(seed + 2, 0.15)),
        confidence: 'estimated',
        source: 'manual_curation',
      });
    }

    // Generate rare chests
    for (let i = 0; i < loc.rareCount; i++) {
      const seed = id * 11 + i * 17 + 999;
      const gx = loc.x + offset(seed, loc.spread * 0.6);
      const gy = loc.y + offset(seed + 1, loc.spread * 0.6);
      const { xNorm, yNorm } = g2n(gx, gy);

      chests.push({
        id: `chest-g-${id++}`,
        chestType: 'rare_chest',
        xNorm: Math.max(0, Math.min(1, xNorm)),
        yNorm: Math.max(0, Math.min(1, yNorm)),
        locationName: loc.name,
        spawnRate: 0.35 + (offset(seed + 2, 0.2)),
        confidence: 'estimated',
        source: 'manual_curation',
      });
    }
  }

  return chests;
}

export const chestSpawns: ChestSpawn[] = generateChests([...namedLocations, ...landmarks]);

// Summary stats
export const chestStats = {
  regular: chestSpawns.filter(c => c.chestType === 'regular_chest').length,
  rare: chestSpawns.filter(c => c.chestType === 'rare_chest').length,
  total: chestSpawns.length,
};

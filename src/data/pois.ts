import type { PointOfInterest } from '@/types/strategy';

/**
 * POI data for Chapter 7 Season 1 (patch 39.51).
 *
 * Source: yaelbrinkert/fortnite-archives (latest/39_51.json)
 * Verified: 2026-03-11
 * 43 locations total.
 *
 * Coordinate conversion from game coords to normalized [0,1]:
 *   Game coord range (calibrated from POI data):
 *     x: -90000 to 90000
 *     y: -90000 to 90000
 *
 *   xNorm = (gameX + 90000) / 180000
 *   yNorm = 1 - (gameY + 90000) / 180000  (Y inverted: game Y+ is up, norm Y+ is down)
 */

// Game coordinate bounds (calibrated from actual POI positions)
const GAME_MIN = -90000;
const GAME_RANGE = 180000;

function g2n(gameX: number, gameY: number): { xNorm: number; yNorm: number } {
  return {
    xNorm: (gameX - GAME_MIN) / GAME_RANGE,
    yNorm: 1 - (gameY - GAME_MIN) / GAME_RANGE,
  };
}

// Raw POI data from fortnite-archives (patch 39.51)
const rawPois: Array<{ name: string; x: number; y: number; type: 'named' | 'landmark' }> = [
  { name: 'BUMPY BAY', x: -66464, y: -1875, type: 'named' },
  { name: 'FORE FIELDS', x: 89184, y: -5843, type: 'named' },
  { name: 'SANDY STRIP', x: 52320, y: -13202, type: 'named' },
  { name: 'SUNSET FALLS', x: -16601, y: -31256, type: 'named' },
  { name: 'LETHAL LABS', x: -11187, y: -38, type: 'named' },
  { name: 'SERENITY POOLS', x: 23172, y: -19156, type: 'named' },
  { name: 'STORM STATION', x: -21669, y: -89944, type: 'named' },
  { name: 'TIPTOP TERRACE', x: -77920, y: -52192, type: 'named' },
  { name: 'WONKEELAND', x: -41761, y: -55346, type: 'named' },
  { name: 'LATTE LANDING', x: 39008, y: -75666, type: 'named' },
  { name: 'PAINTED PALMS', x: 57319, y: -53005, type: 'named' },
  { name: 'CLASSIFIED CANYON', x: 46614, y: 58827, type: 'named' },
  { name: 'HUMBLE HILLS', x: -57248, y: 27758, type: 'named' },
  { name: 'RIPPED TIDES', x: -82848, y: 58478, type: 'named' },
  { name: 'SUS STUDIOS', x: 11190, y: 51586, type: 'named' },
  { name: 'PERFECT PLUNGE', x: 5924, y: 79928, type: 'named' },
  { name: 'FUN FACTORY', x: 23028, y: 23344, type: 'named' },
  { name: 'BATTLEWOOD BOULEVARD', x: -28672, y: 68608, type: 'named' },

  // Landmarks / smaller locations
  { name: 'COLLIDER CORRIDOR X', x: -7215, y: -300, type: 'landmark' },
  { name: 'COLLIDER CORRIDOR THETA', x: 32418, y: -11254, type: 'landmark' },
  { name: 'COLLIDER CORRIDOR BETA', x: 51448, y: 21472, type: 'landmark' },
  { name: 'COLLIDER CORRIDOR GAMMA', x: -9992, y: 41884, type: 'landmark' },
  { name: 'COLLIDER CORRIDOR ALPHA', x: 33428, y: 50380, type: 'landmark' },
  { name: "LOOPER'S LEAP", x: 49592, y: 39944, type: 'landmark' },
  { name: 'CLAWSY LODGE', x: -2136, y: -64876, type: 'landmark' },
  { name: "OL' STUMPY", x: -61368, y: -33824, type: 'landmark' },
  { name: 'CARMINE LODGE', x: 7436, y: 7128, type: 'landmark' },
  { name: 'PUMPING STATION', x: 23527, y: -45946, type: 'landmark' },
  { name: 'ESPRESSO EXPERIMENTS', x: 15741, y: -70365, type: 'landmark' },
  { name: "NATURE'S VINE RESTAURANT", x: -22604, y: 29896, type: 'landmark' },
  { name: 'PEELIAN SWAMP', x: 42956, y: -51952, type: 'landmark' },
  { name: 'FORE SHORES', x: 89360, y: -25900, type: 'landmark' },
  { name: "SLICE O' SHORE", x: 89972, y: 32716, type: 'landmark' },
  { name: 'MEZZO-PIANO TUNNEL', x: 8964, y: -8216, type: 'landmark' },
  { name: 'TOYBOX DOCKS', x: -74444, y: -77396, type: 'landmark' },
  { name: 'ARTSY RVS', x: 70776, y: 60840, type: 'landmark' },
  { name: 'BAYSIDE MANSION', x: -85336, y: 15516, type: 'landmark' },
  { name: "HIKER'S HAVEN", x: 69448, y: 7956, type: 'landmark' },
  { name: 'COSMIC DURR', x: 31272, y: 44584, type: 'landmark' },
  { name: 'THE BASEMENT', x: 6692, y: -26644, type: 'landmark' },
  { name: 'PEELIAN COLONY', x: 89360, y: -61984, type: 'landmark' },
  { name: 'BATTLEWOOD SIGN', x: -35700, y: 33536, type: 'landmark' },
  { name: 'THE ORCHARD HOUSE', x: -1440, y: 27336, type: 'landmark' },
];

export const pois: PointOfInterest[] = rawPois.map((raw, i) => {
  const { xNorm, yNorm } = g2n(raw.x, raw.y);
  return {
    id: `poi-${i}`,
    name: raw.name,
    type: raw.type,
    xNorm,
    yNorm,
  };
});

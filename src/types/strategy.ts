// Fortnite Map Module — Type Definitions
// Coordinate convention: normalized [0, 1]
//   xNorm=0 → left edge, xNorm=1 → right edge
//   yNorm=0 → top edge,  yNorm=1 → bottom edge

// ── Map Configuration ──

export interface MapConfig {
  id: string;
  chapter: number;
  season: number;
  patch: string;
  label: string;
  tileUrl: string;
  bounds: [[number, number], [number, number]];
  center: [number, number];
  minZoom: number;
  maxZoom: number;
  tileSize: number;
  tms: boolean;
  mapWidth: number;
  mapHeight: number;
}

// ── POI ──

export interface PointOfInterest {
  id: string;
  name: string;
  type: 'named' | 'landmark';
  xNorm: number;
  yNorm: number;
}

// ── Chest Spawns ──

export type ChestType = 'regular_chest' | 'rare_chest';

export interface ChestSpawn {
  id: string;
  chestType: ChestType;
  xNorm: number;
  yNorm: number;
  locationName: string;
  spawnRate: number;
  confidence: 'verified' | 'estimated' | 'approximate';
  source: string;
}

// ── Coordinate Conversion ──

const MAP_CRS_WIDTH = 2048;
const MAP_CRS_HEIGHT = 2048;

/**
 * Convert normalized [0,1] to CRS.Simple coordinates.
 * TMS bounds from tilemapresource.xml:
 *   BoundingBox: x=[0, 2048], y=[-2048, 0]
 *   Origin: (0, -2048)
 *
 * CRS.Simple: [lat, lng] where lat=Y, lng=X
 */
export function normToCRS(xNorm: number, yNorm: number): [number, number] {
  const lng = xNorm * MAP_CRS_WIDTH;
  const lat = -yNorm * MAP_CRS_HEIGHT;
  return [lat, lng];
}

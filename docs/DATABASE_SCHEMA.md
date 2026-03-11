# DATABASE SCHEMA

Phase 1 uses TypeScript types with static data files. No database needed yet.
These models define the canonical data shape for future migration to Supabase/PostgreSQL.

---

## Models

### MapVersion

```typescript
interface MapVersion {
  id: string;              // e.g., "39_51"
  chapter: number;         // e.g., 7
  season: number;          // e.g., 1
  patch: string;           // e.g., "39.51"
  label: string;           // e.g., "Chapter 7 Season 1"
  source: string;          // e.g., "fortnite-archives"
  width: number;           // e.g., 2048 (map units)
  height: number;          // e.g., 2048
  tileScheme: TileScheme;  // tile configuration
  createdAt: string;       // ISO 8601
}
```

### MapTileSet

```typescript
interface MapTileSet {
  id: string;
  mapVersionId: string;
  minZoom: number;         // e.g., 0
  maxZoom: number;         // e.g., 5
  tileSize: number;        // e.g., 256
  storagePath: string;     // URL template: ".../{z}/{x}/{y}.png"
  format: 'png' | 'jpg';
}

interface TileScheme {
  tileSet: MapTileSet;
  bounds: [[number, number], [number, number]]; // CRS bounds
  origin: [number, number];
  tms: boolean;            // true = Y-axis inverted (TMS standard)
}
```

### PointOfInterest

```typescript
interface PointOfInterest {
  id: string;
  mapVersionId: string;
  name: string;
  type: 'named' | 'landmark';
  xNorm: number;           // 0..1 normalized (left to right)
  yNorm: number;           // 0..1 normalized (top to bottom)
  source: string;          // e.g., "fortnite-archives"
  metadata: Record<string, unknown> | null;
}
```

### ChestSpawn

```typescript
type ChestType = 'regular_chest' | 'rare_chest';

interface ChestSpawn {
  id: string;
  mapVersionId: string;
  chestType: ChestType;
  xNorm: number;           // 0..1 normalized
  yNorm: number;           // 0..1 normalized
  locationName: string;    // nearest POI name
  spawnRate: number;       // 0..1 probability (estimated)
  source: string;          // e.g., "manual_curation"
  confidence: 'verified' | 'estimated' | 'approximate';
  notes: string | null;
  isVerified: boolean;
}
```

---

## Coordinate Convention

All stored coordinates use **normalized [0, 1]** system:
- `xNorm = 0` → left edge of map
- `xNorm = 1` → right edge of map
- `yNorm = 0` → top edge of map
- `yNorm = 1` → bottom edge of map

### Conversion to CRS.Simple (at render time)

```typescript
const MAP_BOUNDS_X = 2048; // from tilemapresource.xml
const MAP_BOUNDS_Y = 2048;

function normToCRS(xNorm: number, yNorm: number): [number, number] {
  const lat = -yNorm * MAP_BOUNDS_Y;  // CRS Y goes negative downward
  const lng = xNorm * MAP_BOUNDS_X;
  return [lat, lng];
}
```

### Conversion from Game Coords (import time)

```typescript
// Bounds calibrated from fortnite-archives POI data
const GAME_BOUNDS = { xMin: -90000, xMax: 90000, yMin: -90000, yMax: 90000 };

function gameToNorm(gameX: number, gameY: number): { xNorm: number; yNorm: number } {
  const range = GAME_BOUNDS.xMax - GAME_BOUNDS.xMin;
  return {
    xNorm: (gameX - GAME_BOUNDS.xMin) / range,
    yNorm: 1 - (gameY - GAME_BOUNDS.yMin) / (GAME_BOUNDS.yMax - GAME_BOUNDS.yMin),
  };
}
```

---

## Phase 2: Supabase Migration

When ready to persist:
- `map_versions` table matches MapVersion
- `map_tile_sets` table matches MapTileSet
- `points_of_interest` table matches PointOfInterest
- `chest_spawns` table matches ChestSpawn

All with `mapVersionId` foreign key for data versioning.

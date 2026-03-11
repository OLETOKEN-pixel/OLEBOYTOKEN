# ARCHITECTURE DECISION

## Stack Decision: Phase 1

| Component | Decision | Rationale |
|-----------|----------|-----------|
| **Map library** | Leaflet + CRS.Simple | Industry standard for tile-based maps; CRS.Simple designed for non-geographic maps; already in project dependencies |
| **Tile rendering** | Raster TMS tiles via TileLayer | Pre-generated tiles from fortnite-archives; no server needed; zoom 0-5 with native resolution |
| **Tile size** | 256x256 PNG | Standard tile size; matches fortnite-archives output |
| **Coordinate system** | Normalized 0..1 (canonical) → pixel coords at render time | Decouples data from any specific map resolution; future-proof |
| **Data model** | TypeScript types + static data files | No database needed for Phase 1; data lives in code |
| **Caching** | React Query with 30min stale time for remote data; static data needs no caching | Minimal network overhead |
| **React bindings** | react-leaflet v4 | Already installed; compatible with React 18 |

## Map Rendering Architecture

```
┌──────────────────────────────────────────────────┐
│ Browser                                          │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │ Leaflet MapContainer (CRS.Simple)           │ │
│  │                                             │ │
│  │  ┌──────────────────────────────────────┐   │ │
│  │  │ TileLayer (TMS)                      │   │ │
│  │  │ Source: GitHub raw CDN               │   │ │
│  │  │ URL: .../tiles/latest/{z}/{x}/{y}.png│   │ │
│  │  │ Zoom: 0-5, tileSize: 256            │   │ │
│  │  │ tms: true (Y-axis inverted)         │   │ │
│  │  └──────────────────────────────────────┘   │ │
│  │                                             │ │
│  │  ┌──────────────────────────────────────┐   │ │
│  │  │ POI Overlay (LayerGroup)             │   │ │
│  │  │ Source: static TypeScript data       │   │ │
│  │  │ Coords: normalized 0..1 → CRS       │   │ │
│  │  └──────────────────────────────────────┘   │ │
│  │                                             │ │
│  │  ┌──────────────────────────────────────┐   │ │
│  │  │ Chest Overlay (LayerGroup)           │   │ │
│  │  │ Source: static TypeScript data       │   │ │
│  │  │ Types: regular_chest, rare_chest     │   │ │
│  │  │ Coords: normalized 0..1 → CRS       │   │ │
│  │  └──────────────────────────────────────┘   │ │
│  │                                             │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │ Sidebar (React component)                   │ │
│  │ - Layer toggles: regular_chest, rare_chest  │ │
│  │ - POI list with search                      │ │
│  │ - Selected marker details                   │ │
│  └─────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

## Coordinate System

### Canonical: Normalized [0, 1]

All data stores coordinates as `xNorm` and `yNorm` in range [0, 1]:
- (0, 0) = top-left corner of map
- (1, 1) = bottom-right corner of map

### CRS.Simple Mapping

The fortnite-archives tiles use TMS with bounds:
- BoundingBox: x=[0, 2048], y=[-2048, 0]
- Origin: (0, -2048)

Conversion from normalized to CRS.Simple:
```typescript
function normToCRS(xNorm: number, yNorm: number): [number, number] {
  // lat = Y in CRS.Simple, lng = X in CRS.Simple
  // TMS Y-axis: 0 at bottom, -2048 at top... but with tms:true, Leaflet handles this
  // For CRS.Simple with our bounds:
  const lat = -yNorm * 2048;  // 0 → 0 (top), 1 → -2048 (bottom)
  const lng = xNorm * 2048;   // 0 → 0 (left), 1 → 2048 (right)
  return [lat, lng];
}
```

### Game Coordinates → Normalized

From fortnite-archives POI data (game coords ~-85000 to +89000):
```typescript
// These bounds should be calibrated from actual POI data
const GAME_X_MIN = -90000;
const GAME_X_MAX = 90000;
const GAME_Y_MIN = -90000;
const GAME_Y_MAX = 90000;

function gameToNorm(gameX: number, gameY: number): { xNorm: number; yNorm: number } {
  return {
    xNorm: (gameX - GAME_X_MIN) / (GAME_X_MAX - GAME_X_MIN),
    yNorm: (GAME_Y_MIN - gameY) / (GAME_Y_MIN - GAME_Y_MAX), // Y inverted
  };
}
```

**Important**: The exact game coord bounds must be calibrated by testing with known POI positions against the actual tile map. This is a Phase 1 calibration task.

## Tile Serving Strategy

### Phase 1: GitHub Raw CDN (no backend needed)
```
https://raw.githubusercontent.com/yaelbrinkert/fortnite-archives/main/tiles/latest/{z}/{x}/{y}.png
```

Pros:
- Zero infrastructure cost
- No server to maintain
- Globally distributed CDN

Cons:
- Dependent on GitHub availability
- Rate limits for very high traffic (unlikely for our use case)

### Phase 2 (future): Own CDN
- Download tiles to own S3/Cloudflare R2 bucket
- Serve via own CDN
- Full control, no external dependency

## Data Versioning

Every overlay dataset (POIs, chests) is linked to a specific `mapVersionId` (e.g., "39.51").
When the map updates:
1. New tiles are generated/downloaded for the new version
2. POI coordinates are re-imported
3. Chest coordinates are re-validated
4. Old versions remain accessible

## Non-functional Requirements

- Map loads in < 3 seconds on broadband
- Zoom transitions are smooth (native tile loading)
- No visible pixelation at any zoom level
- Sidebar filter toggles are instant (no re-fetch)
- Works on mobile (responsive sidebar)

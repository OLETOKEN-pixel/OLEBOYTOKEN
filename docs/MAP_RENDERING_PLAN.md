# MAP RENDERING PLAN

## How Zoom Works (Why Tiles Matter)

**Single image approach (current, broken):**
- Load one 2048x2048 PNG
- Zoom = browser scales the image → pixelated at 4x+
- No additional detail at any zoom level

**Tile approach (correct):**
- At zoom 0: load 1 tile covering entire map (256x256)
- At zoom 5: load 32x32 tiles (8192px total detail)
- Each zoom level has pre-rendered tiles at native resolution
- Zooming loads MORE tiles with MORE detail → never pixelated

## Leaflet Configuration

```typescript
const mapConfig = {
  // Tile source
  tileUrl: 'https://raw.githubusercontent.com/yaelbrinkert/fortnite-archives/main/tiles/latest/{z}/{x}/{y}.png',

  // TMS standard (Y-axis inverted vs standard slippy map)
  tms: true,

  // CRS.Simple for non-geographic map
  crs: L.CRS.Simple,

  // From tilemapresource.xml
  bounds: [[0, 0], [-2048, 2048]] as L.LatLngBoundsExpression,
  // Note: In CRS.Simple with TMS, lat goes negative downward
  // Top-left: [0, 0], Bottom-right: [-2048, 2048]

  // Zoom range matching available tiles
  minZoom: 0,
  maxZoom: 5,

  // Start zoomed to see full map
  defaultZoom: 1,
  defaultCenter: [-1024, 1024] as L.LatLngExpression,

  // Tile config
  tileSize: 256,

  // Prevent panning outside map
  maxBoundsViscosity: 1.0,

  // Dark background for areas outside map
  backgroundColor: '#04080f',
};
```

## Coordinate Mapping Detail

### Problem
POI data uses game coordinates (x: -7214, y: -299).
Tiles use TMS coordinate system (bounds [0,2048] x [-2048,0]).
We need to map between them correctly.

### Solution: Two-Step Conversion

**Step 1: Game coords → Normalized [0,1]**
```
xNorm = (gameX - gameXMin) / (gameXMax - gameXMin)
yNorm = 1 - (gameY - gameYMin) / (gameYMax - gameYMin)
```

**Step 2: Normalized → CRS.Simple**
```
lng = xNorm * 2048      // X axis (left=0, right=2048)
lat = -yNorm * 2048     // Y axis (top=0, bottom=-2048)
```

### Calibration Required
The exact `gameXMin`, `gameXMax`, etc. values need calibration:
1. Pick 3-4 known POIs with obvious map positions
2. Check where they render on the tile map
3. Adjust bounds until POIs align with their visual positions
4. Document final calibrated values

## Tile Loading Behavior

```
Zoom 0:  1×1 tile   =    256px  (overview)
Zoom 1:  2×2 tiles  =    512px
Zoom 2:  4×4 tiles  =  1,024px
Zoom 3:  8×8 tiles  =  2,048px
Zoom 4: 16×16 tiles =  4,096px
Zoom 5: 32×32 tiles =  8,192px  (max detail)
```

Only tiles within the viewport are loaded (Leaflet handles this automatically).
Typical view at zoom 3-4 loads 8-16 tiles.

## Performance Considerations

- Tiles are PNG (lossless, slightly larger than JPG but better quality)
- GitHub raw CDN has good global latency
- React Query or browser cache prevents re-fetching viewed tiles
- Leaflet natively caches loaded tiles in memory
- Chest markers use L.divIcon (DOM elements) — efficient for 100-200 markers
- If marker count exceeds 500, consider L.canvas renderer or marker clustering

## Fallback Strategy

If GitHub raw CDN fails:
1. Show error state with retry button
2. Fall back to fortnite-api.com single image (ImageOverlay, degraded quality)
3. Log error for monitoring

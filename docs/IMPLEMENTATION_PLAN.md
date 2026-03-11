# IMPLEMENTATION PLAN

## Phase 1 — POC: Basemap + Chest Overlay

### Step 1: Define data types
**File:** `src/types/strategy.ts`
- MapConfig, PointOfInterest, ChestSpawn, ChestType types
- Normalized coordinate types
- Coordinate conversion utilities

### Step 2: Create static data files
**File:** `src/data/mapConfig.ts`
- Tile URL, bounds, zoom range, tile size
- Current map version metadata

**File:** `src/data/pois.ts`
- 43 POIs from fortnite-archives (pre-converted to normalized coords)
- Imported from latest/39_51.json at build time

**File:** `src/data/chestSpawns.ts`
- Curated dataset of regular and rare chests
- Distributed around known POIs
- Each entry has: id, type, xNorm, yNorm, locationName, confidence
- Source: "manual_curation" (honest about provenance)
- All marked `confidence: 'estimated'`

### Step 3: Rewrite MapViewer with TileLayer
**File:** `src/components/strategy/MapViewer.tsx`
- Replace ImageOverlay with TileLayer
- Use TMS tile URL from mapConfig
- CRS.Simple, zoom 0-5
- Bounds from tilemapresource.xml
- Embed POILayer and ChestLayer as LayerGroups

### Step 4: Create ChestLayer component
**File:** `src/components/strategy/ChestLayer.tsx`
- CircleMarker or DivIcon for each chest
- Regular: orange fill (#FFA500)
- Rare: gold fill (#FFD700) with blue border (#4488FF)
- Tooltip on hover: chest type + location name
- Popup on click: full details + confidence level

### Step 5: Update POILayer for CRS coords
**File:** `src/components/strategy/POILayer.tsx`
- Convert normalized coords to CRS at render time
- Keep existing marker styling

### Step 6: Rewrite Sidebar
**File:** `src/components/strategy/MapSidebar.tsx`
- Layer toggles: Regular Chests, Rare Chests, POI Names
- Count badges for each layer
- Search bar for POIs
- Selected marker detail panel
- Dark theme consistent with rest of app

### Step 7: Rewrite Strategy page
**File:** `src/pages/Strategy.tsx`
- State: enabled layers, selected marker, search
- Load static data (no API call needed for Phase 1)
- Wire sidebar callbacks to map layers

### Step 8: Update MapLoadingState
**File:** `src/components/strategy/MapLoadingState.tsx`
- Loading state while tiles load
- Error state if tile source fails

### Step 9: Update hooks
**File:** `src/hooks/useMapData.ts`
- Simple hooks that return static data
- useMapConfig(), useChestData(), usePOIData()
- No API calls in Phase 1

### Step 10: Update CSS
**File:** `src/index.css`
- Leaflet tile layer overrides
- Marker tooltip styling
- Sidebar overlay styling

### Step 11: Verify
- `npm run build` passes
- Map renders with tiles (zoom 0-5)
- POI markers visible at correct positions
- Chest markers visible with correct colors
- Sidebar toggles work
- No pixelation at max zoom

### Step 12: Commit and push

---

## Definition of Done — Phase 1

- [ ] Basemap loads from verified tile source (fortnite-archives)
- [ ] Zoom 0-5 works with native tile resolution (no pixelation)
- [ ] POI markers render at approximately correct positions
- [ ] Regular chest markers visible with toggle
- [ ] Rare chest markers visible with toggle
- [ ] Sidebar shows layer controls and POI search
- [ ] Click on marker shows details
- [ ] `npm run build` passes
- [ ] All data sources documented in SOURCE_VERIFICATION_REPORT.md
- [ ] Coordinate calibration values documented
- [ ] Chest data explicitly marked as `confidence: 'estimated'`
- [ ] No dependency on fortnite.gg runtime
- [ ] No invented endpoints or URLs
- [ ] Pushed to `claude/restructure-deploy-vercel-CqPdv`

---

## Known Blockers

1. **Coordinate calibration**: Game coords → normalized mapping needs testing in browser. The exact bounds (-90000 to 90000) are estimated and may need adjustment.

2. **Chest data accuracy**: All chest positions are estimates based on POI locations. Real data requires FModel extraction (user's responsibility).

3. **TMS tile Y-axis**: Need to verify `tms: true` works correctly with Leaflet CRS.Simple + fortnite-archives tiles. May need Y-flip adjustment.

4. **GitHub raw CDN rate limits**: Unlikely to be a problem for development, but production should use own CDN.

# API CONTRACTS

Phase 1 uses static data and client-side tile loading. No internal API endpoints needed yet.
This document defines the data contracts between layers.

---

## External Dependencies (Client-Side)

### Tile Loading

```
GET https://raw.githubusercontent.com/yaelbrinkert/fortnite-archives/main/tiles/latest/{z}/{x}/{y}.png
```

- Called by: Leaflet TileLayer (browser)
- Auth: none
- Response: 256x256 PNG image
- Error: 404 for tiles outside bounds (expected, handled by Leaflet)
- Fallback: none needed (tiles are static files)

### POI Data (optional, for auto-import)

```
GET https://raw.githubusercontent.com/yaelbrinkert/fortnite-archives/main/latest/39_51.json
```

- Response: JSON array of `{ name: string, x: number, y: number, z: number }`
- Used at: build time or initial import, NOT runtime dependency
- For Phase 1: data is embedded in TypeScript file instead

---

## Internal Data Contracts

### MapConfig → MapViewer

```typescript
interface MapConfig {
  tileUrl: string;        // URL template with {z}/{x}/{y}
  bounds: [[number, number], [number, number]];
  minZoom: number;
  maxZoom: number;
  tileSize: number;
  tms: boolean;
}
```

### ChestData → ChestLayer

```typescript
interface ChestLayerData {
  chests: ChestSpawn[];
  enabledTypes: Set<ChestType>;
}
```

### POIData → POILayer

```typescript
interface POILayerData {
  pois: PointOfInterest[];
  visible: boolean;
  selectedId: string | null;
}
```

### Sidebar ↔ Strategy Page

```typescript
interface SidebarCallbacks {
  onToggleChestType: (type: ChestType) => void;
  onTogglePOIs: () => void;
  onSelectPOI: (id: string | null) => void;
  onSearch: (query: string) => void;
}
```

---

## Phase 2: REST API (future)

When backend is needed:

```
GET /api/map/versions          → MapVersion[]
GET /api/map/versions/:id      → MapVersion
GET /api/map/pois/:versionId   → PointOfInterest[]
GET /api/map/chests/:versionId → ChestSpawn[]
POST /api/map/chests           → ChestSpawn (admin only)
```

# SOURCE VERIFICATION REPORT

Generated: 2026-03-11
Environment: Server-side HTTP requests blocked by egress proxy (host whitelist).
All verification done via WebFetch/WebSearch. Client-side (browser) access is unrestricted.

---

## A. Basemap Candidate Sources

### 1. yaelbrinkert/fortnite-archives (GitHub)

| Field | Value |
|-------|-------|
| **Name** | fortnite-archives |
| **URL** | https://github.com/yaelbrinkert/fortnite-archives |
| **What it provides** | Map images (JPG), POI JSON data, pre-generated TMS tiles (PNG 256x256), manifest with 206 versions |
| **Format** | JPG (map images), JSON (POI coords), PNG (tiles), XML (tilemapresource) |
| **Verified?** | YES — raw file URLs confirmed accessible via WebFetch |
| **Current map?** | YES — latest/ contains patch 39.51 (Chapter 7 Season 1) |
| **Historical maps?** | YES — 206 versions from Chapter 1 (v1.6.0) through Chapter 7 |
| **POI data?** | YES — 43 POIs for current patch with game coordinates (x, y, z) |
| **Tile system?** | YES — TMS tiles, zoom 0-5, 256x256 PNG, bounding box [0,2048]x[-2048,0] |
| **External dependency?** | GitHub raw content CDN (jsdelivr.net alternative available) |
| **Risk: technical** | LOW — static files on GitHub, no rate limits for reasonable usage |
| **Risk: legal** | MEDIUM — community-sourced from game files; falls under Epic Fan Content Policy |
| **Decision** | **ACCEPT** — verified, structured, TMS-ready, actively maintained |

**Tile URL pattern (verified):**
```
https://raw.githubusercontent.com/yaelbrinkert/fortnite-archives/main/tiles/latest/{z}/{x}/{y}.png
```

**Tile config (from tilemapresource.xml):**
- Tile size: 256x256 px
- Format: image/png
- Bounding box: minx=0, miny=-2048, maxx=2048, maxy=0
- Origin: (0, -2048)
- Zoom levels: 0 (32 units/px) → 5 (1 unit/px)
- Max resolution: zoom 5 = 32x32 tiles = 8192px equivalent coverage

**POI data sample (from latest/39_51.json):**
```json
{
  "name": "BUMPY BAY",
  "x": -7214.907058721472,
  "y": -299.6087438846602,
  "z": 1227.0095205117686
}
```
43 POIs total. Coordinates in game world units (approx -85000 to +89000 range).

---

### 2. fortnite-api.com

| Field | Value |
|-------|-------|
| **Name** | Fortnite-API |
| **URL** | https://fortnite-api.com/v1/map |
| **What it provides** | Map images (blank + POI-labeled), POI list with game coordinates |
| **Format** | JSON with image URLs and POI array |
| **Verified?** | PARTIALLY — blocked by server proxy; documented as free/no-key; 100% uptime reported |
| **Current map?** | YES (auto-updated) |
| **Historical maps?** | NO |
| **POI data?** | YES — with game coordinates (x, y, z) |
| **Tile system?** | NO — single images only (2048x2048) |
| **External dependency?** | Runtime API call (client-side) |
| **Risk: technical** | MEDIUM — depends on third-party uptime; single image pixelates on zoom |
| **Risk: legal** | LOW — established community API |
| **Decision** | **HOLD** — useful as supplementary POI source or fallback; not suitable as basemap due to single-image limitation |

---

### 3. fortnite.gg (tile scraping)

| Field | Value |
|-------|-------|
| **Name** | fortnite.gg |
| **URL** | https://fortnite.gg/maps/{patch}/{z}/{x}/{y}.jpg |
| **What it provides** | HD tiles up to 16384px (zoom 0-6) |
| **Verified?** | INDIRECTLY — URL pattern confirmed from crypoxyz/fnmap repo source code |
| **Decision** | **REJECT** — scraping a commercial site as runtime dependency violates our non-negoziabile rules; hotlink protection likely; no permission |

---

### 4. fortniteapi.io

| Field | Value |
|-------|-------|
| **Name** | FortniteAPI.io |
| **URL** | https://fortniteapi.io |
| **What it provides** | POI list, loot spawn chances, map image |
| **Verified?** | PARTIALLY — documentation URLs blocked by proxy |
| **Decision** | **REJECT** — requires API key; service announced as closing; not stable |

---

## B. Chest Dataset Candidate Sources

### 1. Public API for chest spawn coordinates
**Status: NOT FOUND**

After searching:
- fortnite-api.com — provides POI names and map images only, no chest spawns
- fortniteapi.io — provides loot spawn *probabilities* per game mode, not spatial coordinates
- Epic official API — no public endpoint for chest spawns
- Community APIs — none found with verified chest coordinate data

**Conclusion: Public chest spawn source not verified; custom dataset pipeline required.**

### 2. FModel game file extraction
**Status: NOT AVAILABLE IN THIS ENVIRONMENT**

FModel is a Windows desktop tool for extracting Unreal Engine game assets.
Cannot run in this server environment. Would require manual extraction by user.

### 3. Custom curated dataset
**Status: RECOMMENDED APPROACH**

Create a TypeScript dataset file with chest spawn locations:
- Place chests at/around the 43 verified POI locations
- Use game coordinate system consistent with yaelbrinkert/fortnite-archives POI data
- Mark each entry with `confidence: 'estimated'` and `source: 'manual_curation'`
- Can be updated later with verified data from FModel or community sources

---

## C. Final Source Decision

### Basemap: yaelbrinkert/fortnite-archives ✅

**Rationale:**
- Only source with pre-generated TMS tiles ready for Leaflet
- 206 historical versions with consistent structure
- Actively maintained (last update: 2026-03-09)
- GitHub raw CDN is reliable and fast
- No API key needed
- TMS standard compatible with Leaflet out of the box

**How to use:**
- Tiles: `https://raw.githubusercontent.com/yaelbrinkert/fortnite-archives/main/tiles/latest/{z}/{x}/{y}.png`
- POI data: `https://raw.githubusercontent.com/yaelbrinkert/fortnite-archives/main/latest/39_51.json`
- Manifest: `https://raw.githubusercontent.com/yaelbrinkert/fortnite-archives/main/manifest.json`

### Chest Dataset: Custom curated TypeScript file ✅

**Rationale:**
- No verified public API exists for chest spawn coordinates
- Dataset must be treated as proprietary/versionated
- Coordinates normalized 0..1 relative to map bounds
- Each entry tagged with source and confidence level
- Updatable when better data becomes available

---

## What Is Verifiable Right Now

1. ✅ yaelbrinkert/fortnite-archives exists and serves tile files via GitHub raw URLs
2. ✅ TMS tile config: 256x256 PNG, zoom 0-5, bounds [0,2048]x[-2048,0]
3. ✅ 43 POI locations with game coordinates for patch 39.51
4. ✅ 206 map versions from Chapter 1 through Chapter 7
5. ✅ fortnite-api.com/v1/map exists (documented, wrapper libraries exist) but blocked by server proxy

## What Is NOT Verifiable Right Now

1. ❌ No public API for individual chest spawn coordinates
2. ❌ Cannot test fortnite-api.com from server side (proxy blocks it)
3. ❌ Cannot confirm exact game coordinate → tile coordinate mapping without testing in browser
4. ❌ FModel extraction not possible in this environment
5. ❌ Exact number of regular/rare chests per POI — requires game file data

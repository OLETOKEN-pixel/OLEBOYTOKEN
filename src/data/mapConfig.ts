import type { MapConfig } from '@/types/strategy';

/**
 * Map configuration for the current Fortnite map.
 *
 * Tiles source: yaelbrinkert/fortnite-archives (GitHub)
 * Verified: 2026-03-11
 * TMS config from: tiles/latest/tilemapresource.xml
 */
export const currentMapConfig: MapConfig = {
  id: '39_51',
  chapter: 7,
  season: 1,
  patch: '39.51',
  label: 'Chapter 7 Season 1',
  tileUrl: 'https://raw.githubusercontent.com/yaelbrinkert/fortnite-archives/main/tiles/latest/{z}/{x}/{y}.png',
  // TMS bounds from tilemapresource.xml: x=[0,2048], y=[-2048,0]
  // CRS.Simple: [[south, west], [north, east]] = [[bottom, left], [top, right]]
  bounds: [[-2048, 0], [0, 2048]],
  center: [-1024, 1024],
  minZoom: 0,
  maxZoom: 5,
  tileSize: 256,
  tms: true,
  mapWidth: 2048,
  mapHeight: 2048,
};

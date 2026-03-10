// Competitive Strategy Module - Type Definitions

// ── Internal Models (stored in Supabase) ──

export interface MapVersion {
  id: string;
  chapter: number;
  season: number;
  patch: string;
  name: string;
  blank_image_url: string;
  poi_image_url: string;
  image_width: number;
  image_height: number;
  is_current: boolean;
  source_api: string;
  released_at: string | null;
  synced_at: string;
  created_at: string;
}

export type POIType = 'named' | 'landmark' | 'hot_drop' | 'mobility' | 'reboot' | 'custom';

export interface PointOfInterest {
  id: string;
  map_version_id: string;
  external_id: string | null;
  name: string;
  type: POIType;
  x: number; // 0..1 normalized
  y: number; // 0..1 normalized
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ── External API Response (fortnite-api.com) ──

export interface FortniteApiMapResponse {
  status: number;
  data: {
    images: {
      blank: string;
      pois: string;
    };
    pois: Array<{
      id: string;
      name: string;
      location: { x: number; y: number; z: number };
    }>;
  };
}

// ── Map Viewer State ──

export type MapStyle = 'blank' | 'labeled';

export interface MapViewerState {
  selectedVersionId: string | null;
  mapStyle: MapStyle;
  showPOIs: boolean;
  zoom: number;
  center: [number, number];
}

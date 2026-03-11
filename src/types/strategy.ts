// Competitive Strategy Module - Type Definitions

// ── POI Types ──

export type POIType = 'named' | 'landmark' | 'hot_drop' | 'mobility' | 'reboot' | 'custom';

export interface PointOfInterest {
  id: string;
  name: string;
  type: POIType;
  x: number; // pixel coordinate on map image
  y: number; // pixel coordinate on map image
}

// ── Map Data (from fortnite-api.com) ──

export interface FortniteMapData {
  images: {
    blank: string;
    pois: string;
  };
  pois: PointOfInterest[];
  imageWidth: number;
  imageHeight: number;
}

// ── External API Response (fortnite-api.com /v1/map) ──

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
  mapStyle: MapStyle;
  showPOIs: boolean;
  zoom: number;
  center: [number, number];
}

// ── Filter Categories ──

export interface POICategory {
  type: POIType;
  label: string;
  color: string;
  enabled: boolean;
}

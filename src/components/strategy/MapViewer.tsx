import { useMemo, useCallback } from 'react';
import { MapContainer, ImageOverlay, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { POILayer } from './POILayer';
import { MapControls } from './MapControls';
import type { MapVersion, PointOfInterest, MapStyle } from '@/types/strategy';

interface MapViewerProps {
  mapVersion: MapVersion;
  pois: PointOfInterest[];
  mapStyle: MapStyle;
  showPOIs: boolean;
  overlayLayers?: React.ReactNode[];
}

function ResetViewButton({ bounds }: { bounds: L.LatLngBoundsExpression }) {
  const map = useMap();
  const resetView = useCallback(() => {
    map.fitBounds(bounds as L.LatLngBounds);
  }, [map, bounds]);

  return <MapControls onResetView={resetView} />;
}

export function MapViewer({ mapVersion, pois, mapStyle, showPOIs, overlayLayers }: MapViewerProps) {
  const imageUrl = mapStyle === 'blank'
    ? mapVersion.blank_image_url
    : mapVersion.poi_image_url;

  // Leaflet CRS.Simple: y-axis inverted. Image bounds = [[0,0], [height, width]]
  const bounds = useMemo<L.LatLngBoundsExpression>(
    () => [[0, 0], [mapVersion.image_height, mapVersion.image_width]],
    [mapVersion.image_height, mapVersion.image_width]
  );

  const center = useMemo<L.LatLngExpression>(
    () => [mapVersion.image_height / 2, mapVersion.image_width / 2],
    [mapVersion.image_height, mapVersion.image_width]
  );

  return (
    <div className="w-full h-full strategy-map-container">
      <MapContainer
        center={center}
        zoom={-1}
        minZoom={-2}
        maxZoom={3}
        crs={L.CRS.Simple}
        maxBounds={bounds}
        maxBoundsViscosity={0.8}
        zoomControl={false}
        attributionControl={false}
        className="w-full h-full bg-[#04080f] rounded-lg"
        style={{ background: '#04080f' }}
      >
        <ImageOverlay url={imageUrl} bounds={bounds} />

        {showPOIs && pois.length > 0 && (
          <POILayer
            pois={pois}
            imageWidth={mapVersion.image_width}
            imageHeight={mapVersion.image_height}
          />
        )}

        {overlayLayers}

        <ResetViewButton bounds={bounds} />
      </MapContainer>
    </div>
  );
}

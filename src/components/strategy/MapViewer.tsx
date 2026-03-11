import { useMemo, useCallback } from 'react';
import { MapContainer, ImageOverlay, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { POILayer } from './POILayer';
import { MapControls } from './MapControls';
import type { FortniteMapData, PointOfInterest, MapStyle } from '@/types/strategy';

interface MapViewerProps {
  mapData: FortniteMapData;
  pois: PointOfInterest[];
  mapStyle: MapStyle;
  showPOIs: boolean;
  selectedPOI: string | null;
  onSelectPOI: (id: string | null) => void;
}

function ResetViewButton({ bounds }: { bounds: L.LatLngBoundsExpression }) {
  const map = useMap();
  const resetView = useCallback(() => {
    map.fitBounds(bounds as L.LatLngBounds);
  }, [map, bounds]);

  return <MapControls onResetView={resetView} />;
}

export function MapViewer({ mapData, pois, mapStyle, showPOIs, selectedPOI, onSelectPOI }: MapViewerProps) {
  const imageUrl = mapStyle === 'blank'
    ? mapData.images.blank
    : mapData.images.pois;

  const bounds = useMemo<L.LatLngBoundsExpression>(
    () => [[0, 0], [mapData.imageHeight, mapData.imageWidth]],
    [mapData.imageHeight, mapData.imageWidth]
  );

  const center = useMemo<L.LatLngExpression>(
    () => [mapData.imageHeight / 2, mapData.imageWidth / 2],
    [mapData.imageHeight, mapData.imageWidth]
  );

  return (
    <div className="w-full h-full strategy-map-container">
      <MapContainer
        center={center}
        zoom={0}
        minZoom={-1}
        maxZoom={4}
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
            selectedPOI={selectedPOI}
            onSelectPOI={onSelectPOI}
          />
        )}

        <ResetViewButton bounds={bounds} />
      </MapContainer>
    </div>
  );
}

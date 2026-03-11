import { useCallback } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { POILayer } from './POILayer';
import { ChestLayer } from './ChestLayer';
import { MapControls } from './MapControls';
import type { MapConfig, PointOfInterest, ChestSpawn, ChestType } from '@/types/strategy';

interface MapViewerProps {
  config: MapConfig;
  pois: PointOfInterest[];
  chests: ChestSpawn[];
  showPOIs: boolean;
  enabledChestTypes: Set<ChestType>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

function ResetViewButton({ config }: { config: MapConfig }) {
  const map = useMap();
  const resetView = useCallback(() => {
    map.fitBounds(config.bounds as L.LatLngBounds);
  }, [map, config.bounds]);

  return <MapControls onResetView={resetView} />;
}

export function MapViewer({
  config,
  pois,
  chests,
  showPOIs,
  enabledChestTypes,
  selectedId,
  onSelect,
}: MapViewerProps) {
  const filteredChests = chests.filter((c) => enabledChestTypes.has(c.chestType));

  return (
    <div className="w-full h-full strategy-map-container">
      <MapContainer
        center={config.center}
        zoom={1}
        minZoom={config.minZoom}
        maxZoom={config.maxZoom}
        crs={L.CRS.Simple}
        maxBounds={config.bounds}
        maxBoundsViscosity={1.0}
        zoomControl={false}
        attributionControl={false}
        className="w-full h-full bg-[#04080f] rounded-lg"
        style={{ background: '#04080f' }}
      >
        <TileLayer
          url={config.tileUrl}
          tileSize={config.tileSize}
          minZoom={config.minZoom}
          maxZoom={config.maxZoom}
          tms={config.tms}
          noWrap={true}
          bounds={config.bounds}
        />

        {showPOIs && (
          <POILayer
            pois={pois}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        )}

        {filteredChests.length > 0 && (
          <ChestLayer
            chests={filteredChests}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        )}

        <ResetViewButton config={config} />
      </MapContainer>
    </div>
  );
}

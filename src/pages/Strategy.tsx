import { MainLayout } from '@/components/layout/MainLayout';
import { MapViewer } from '@/components/strategy/MapViewer';
import { MapSidebar } from '@/components/strategy/MapSidebar';
import { MapLoadingState } from '@/components/strategy/MapLoadingState';
import { useCurrentMap, useMapPOIs } from '@/hooks/useMapData';
import { useState } from 'react';
import type { MapStyle } from '@/types/strategy';

export default function Strategy() {
  const { data: currentMap, isLoading: mapLoading } = useCurrentMap();
  const { data: pois, isLoading: poisLoading } = useMapPOIs(currentMap?.id ?? '');
  const [mapStyle, setMapStyle] = useState<MapStyle>('labeled');
  const [showPOIs, setShowPOIs] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isLoading = mapLoading || poisLoading;

  return (
    <MainLayout>
      <div className="flex h-[calc(100vh-70px-2rem)] -mx-4 lg:-mx-10 -mt-4">
        {/* Sidebar */}
        <MapSidebar
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          mapStyle={mapStyle}
          onMapStyleChange={setMapStyle}
          showPOIs={showPOIs}
          onShowPOIsChange={setShowPOIs}
          pois={pois ?? []}
          currentMap={currentMap ?? null}
        />

        {/* Map Area */}
        <div className="flex-1 relative">
          {isLoading || !currentMap ? (
            <MapLoadingState />
          ) : (
            <MapViewer
              mapVersion={currentMap}
              pois={pois ?? []}
              mapStyle={mapStyle}
              showPOIs={showPOIs}
            />
          )}
        </div>
      </div>
    </MainLayout>
  );
}

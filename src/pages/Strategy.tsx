import { MainLayout } from '@/components/layout/MainLayout';
import { MapViewer } from '@/components/strategy/MapViewer';
import { MapSidebar } from '@/components/strategy/MapSidebar';
import { MapLoadingState } from '@/components/strategy/MapLoadingState';
import { useFortniteMap } from '@/hooks/useMapData';
import { useState, useMemo } from 'react';
import type { MapStyle, POIType } from '@/types/strategy';

export default function Strategy() {
  const { data: mapData, isLoading, error } = useFortniteMap();
  const [mapStyle, setMapStyle] = useState<MapStyle>('labeled');
  const [showPOIs, setShowPOIs] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [enabledTypes, setEnabledTypes] = useState<Set<POIType>>(
    new Set(['named', 'landmark'])
  );
  const [selectedPOI, setSelectedPOI] = useState<string | null>(null);

  const filteredPOIs = useMemo(() => {
    if (!mapData?.pois) return [];
    return mapData.pois.filter((poi) => enabledTypes.has(poi.type));
  }, [mapData?.pois, enabledTypes]);

  const toggleType = (type: POIType) => {
    setEnabledTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  return (
    <MainLayout>
      <div className="flex h-[calc(100vh-70px-2rem)] -mx-4 lg:-mx-10 -mt-4">
        <MapSidebar
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          mapStyle={mapStyle}
          onMapStyleChange={setMapStyle}
          showPOIs={showPOIs}
          onShowPOIsChange={setShowPOIs}
          pois={mapData?.pois ?? []}
          enabledTypes={enabledTypes}
          onToggleType={toggleType}
          selectedPOI={selectedPOI}
          onSelectPOI={setSelectedPOI}
        />

        <div className="flex-1 relative">
          {isLoading || !mapData ? (
            <MapLoadingState error={error?.message} />
          ) : (
            <MapViewer
              mapData={mapData}
              pois={filteredPOIs}
              mapStyle={mapStyle}
              showPOIs={showPOIs}
              selectedPOI={selectedPOI}
              onSelectPOI={setSelectedPOI}
            />
          )}
        </div>
      </div>
    </MainLayout>
  );
}

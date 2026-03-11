import { MainLayout } from '@/components/layout/MainLayout';
import { MapViewer } from '@/components/strategy/MapViewer';
import { MapSidebar } from '@/components/strategy/MapSidebar';
import { useMapConfig, usePOIData, useChestData } from '@/hooks/useMapData';
import { useState } from 'react';
import type { ChestType } from '@/types/strategy';

export default function Strategy() {
  const config = useMapConfig();
  const pois = usePOIData();
  const { chests, stats } = useChestData();

  const [showPOIs, setShowPOIs] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [enabledChestTypes, setEnabledChestTypes] = useState<Set<ChestType>>(
    new Set(['regular_chest', 'rare_chest'])
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const toggleChestType = (type: ChestType) => {
    setEnabledChestTypes((prev) => {
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
          showPOIs={showPOIs}
          onShowPOIsChange={setShowPOIs}
          pois={pois}
          chests={chests}
          chestStats={stats}
          enabledChestTypes={enabledChestTypes}
          onToggleChestType={toggleChestType}
          selectedId={selectedId}
          onSelect={setSelectedId}
          mapLabel={config.label}
        />

        <div className="flex-1 relative">
          <MapViewer
            config={config}
            pois={pois}
            chests={chests}
            showPOIs={showPOIs}
            enabledChestTypes={enabledChestTypes}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
      </div>
    </MainLayout>
  );
}

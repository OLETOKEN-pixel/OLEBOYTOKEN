import { ChevronLeft, ChevronRight, Eye, EyeOff, MapPin, Search, Map } from 'lucide-react';
import { useState } from 'react';
import type { PointOfInterest, ChestType, ChestSpawn } from '@/types/strategy';

interface MapSidebarProps {
  open: boolean;
  onToggle: () => void;
  showPOIs: boolean;
  onShowPOIsChange: (show: boolean) => void;
  pois: PointOfInterest[];
  chests: ChestSpawn[];
  chestStats: { regular: number; rare: number; total: number };
  enabledChestTypes: Set<ChestType>;
  onToggleChestType: (type: ChestType) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  mapLabel: string;
}

const CHEST_LAYER_CONFIG: Array<{ type: ChestType; label: string; color: string }> = [
  { type: 'regular_chest', label: 'Regular Chests', color: '#FFA500' },
  { type: 'rare_chest', label: 'Rare Chests', color: '#FFD700' },
];

export function MapSidebar({
  open,
  onToggle,
  showPOIs,
  onShowPOIsChange,
  pois,
  chestStats,
  enabledChestTypes,
  onToggleChestType,
  selectedId,
  onSelect,
  mapLabel,
}: MapSidebarProps) {
  const [search, setSearch] = useState('');

  const filteredPOIs = pois.filter((poi) =>
    poi.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={onToggle}
        className="absolute top-4 left-4 z-[1000] w-8 h-8 flex items-center justify-center bg-[#1a1a1a]/90 border border-white/10 rounded-lg text-white/70 hover:text-white hover:bg-[#252525] transition-colors lg:hidden"
      >
        {open ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {/* Sidebar */}
      <div
        className={`${
          open ? 'w-[280px]' : 'w-0'
        } transition-all duration-200 overflow-hidden bg-[#0a0a0a] border-r border-white/[0.06] flex flex-col shrink-0`}
      >
        <div className="w-[280px] h-full flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/[0.06] bg-[#0f0f0f]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Map className="w-5 h-5 text-[#FFC805]" />
                <h2 className="font-teko font-bold text-[20px] text-white uppercase tracking-wider">
                  Fortnite Map
                </h2>
              </div>
              <button
                onClick={onToggle}
                className="w-7 h-7 flex items-center justify-center rounded-md text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-white/30 mt-1">{mapLabel}</p>
          </div>

          {/* Layer Toggles */}
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2 font-medium">
              Layers
            </p>

            {/* Chest layers */}
            {CHEST_LAYER_CONFIG.map((layer) => {
              const enabled = enabledChestTypes.has(layer.type);
              const count = layer.type === 'regular_chest' ? chestStats.regular : chestStats.rare;
              return (
                <button
                  key={layer.type}
                  onClick={() => onToggleChestType(layer.type)}
                  className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-xs transition-colors mb-1 ${
                    enabled
                      ? 'bg-white/[0.06] text-white/90'
                      : 'text-white/30 hover:text-white/50'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{
                      backgroundColor: enabled ? layer.color : 'transparent',
                      border: `2px solid ${layer.color}`,
                      opacity: enabled ? 1 : 0.4,
                    }}
                  />
                  <span className="flex-1 text-left">{layer.label}</span>
                  <span className="text-[10px] text-white/30">{count}</span>
                </button>
              );
            })}

            {/* POI toggle */}
            <button
              onClick={() => onShowPOIsChange(!showPOIs)}
              className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-xs transition-colors ${
                showPOIs
                  ? 'bg-white/[0.06] text-white/90'
                  : 'text-white/30 hover:text-white/50'
              }`}
            >
              {showPOIs ? (
                <Eye className="w-3.5 h-3.5 text-[#FFC805]" />
              ) : (
                <EyeOff className="w-3.5 h-3.5" />
              )}
              <span className="flex-1 text-left">POI Names</span>
              <span className="text-[10px] text-white/30">{pois.length}</span>
            </button>
          </div>

          {/* Search */}
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input
                type="text"
                placeholder="Search locations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-[#FFC805]/30"
              />
            </div>
          </div>

          {/* POI List */}
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {filteredPOIs.length === 0 ? (
              <p className="text-xs text-white/20 text-center py-4">No results</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {filteredPOIs.map((poi) => {
                  const isSelected = selectedId === poi.id;
                  const color = poi.type === 'named' ? '#FFC805' : '#8B8B8B';
                  return (
                    <button
                      key={poi.id}
                      onClick={() => onSelect(isSelected ? null : poi.id)}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors text-left ${
                        isSelected
                          ? 'bg-[#FFC805]/10 border border-[#FFC805]/20'
                          : 'hover:bg-white/[0.04] border border-transparent'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color }} />
                      <div className="min-w-0">
                        <p className={`text-xs truncate ${isSelected ? 'text-[#FFC805]' : 'text-white/80'}`}>
                          {poi.name}
                        </p>
                        <p className="text-[10px] text-white/30 capitalize">{poi.type}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-white/[0.06] bg-[#0f0f0f]">
            <p className="text-[10px] text-white/20 text-center">
              {chestStats.total} chests &bull; {pois.length} POIs
            </p>
            <p className="text-[9px] text-white/10 text-center mt-0.5">
              Chest data: estimated &bull; Source: fortnite-archives
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

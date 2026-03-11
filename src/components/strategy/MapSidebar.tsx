import { ChevronLeft, ChevronRight, Eye, EyeOff, Image, Tag, MapPin, Search, Map } from 'lucide-react';
import { useState } from 'react';
import type { PointOfInterest, MapStyle, POIType } from '@/types/strategy';

interface MapSidebarProps {
  open: boolean;
  onToggle: () => void;
  mapStyle: MapStyle;
  onMapStyleChange: (style: MapStyle) => void;
  showPOIs: boolean;
  onShowPOIsChange: (show: boolean) => void;
  pois: PointOfInterest[];
  enabledTypes: Set<POIType>;
  onToggleType: (type: POIType) => void;
  selectedPOI: string | null;
  onSelectPOI: (id: string | null) => void;
}

const CATEGORIES: Array<{ type: POIType; label: string; color: string }> = [
  { type: 'named', label: 'Named Locations', color: '#FFC805' },
  { type: 'landmark', label: 'Landmarks', color: '#8B8B8B' },
  { type: 'hot_drop', label: 'Hot Drops', color: '#FF4444' },
  { type: 'mobility', label: 'Mobility', color: '#44BBFF' },
  { type: 'reboot', label: 'Reboot Vans', color: '#44FF88' },
];

export function MapSidebar({
  open,
  onToggle,
  mapStyle,
  onMapStyleChange,
  showPOIs,
  onShowPOIsChange,
  pois,
  enabledTypes,
  onToggleType,
  selectedPOI,
  onSelectPOI,
}: MapSidebarProps) {
  const [search, setSearch] = useState('');

  const filteredPOIs = pois.filter(
    (poi) =>
      enabledTypes.has(poi.type) &&
      poi.name.toLowerCase().includes(search.toLowerCase())
  );

  const getCategoryCount = (type: POIType) =>
    pois.filter((p) => p.type === type).length;

  return (
    <>
      {/* Toggle button (mobile) */}
      <button
        onClick={onToggle}
        className="absolute top-4 left-4 z-[1000] w-8 h-8 flex items-center justify-center bg-[#1a1a1a]/90 border border-white/10 rounded-lg text-white/70 hover:text-white hover:bg-[#252525] transition-colors lg:hidden"
      >
        {open ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {/* Sidebar panel */}
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
            <p className="text-[10px] text-white/30 mt-1">
              Interactive Battle Royale Map
            </p>
          </div>

          {/* Map Style Toggle */}
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2 font-medium">
              Map Style
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => onMapStyleChange('labeled')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  mapStyle === 'labeled'
                    ? 'bg-[#FFC805]/10 text-[#FFC805] border border-[#FFC805]/30'
                    : 'bg-white/[0.04] text-white/50 border border-white/[0.06] hover:text-white/70'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                POI Labels
              </button>
              <button
                onClick={() => onMapStyleChange('blank')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  mapStyle === 'blank'
                    ? 'bg-[#FFC805]/10 text-[#FFC805] border border-[#FFC805]/30'
                    : 'bg-white/[0.04] text-white/50 border border-white/[0.06] hover:text-white/70'
                }`}
              >
                <Image className="w-3.5 h-3.5" />
                Clean
              </button>
            </div>
          </div>

          {/* Category Filters */}
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium">
                Markers
              </p>
              <button
                onClick={() => onShowPOIsChange(!showPOIs)}
                className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
                  showPOIs
                    ? 'text-[#FFC805] bg-[#FFC805]/10'
                    : 'text-white/30 hover:text-white/50'
                }`}
                title={showPOIs ? 'Hide all markers' : 'Show all markers'}
              >
                {showPOIs ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {CATEGORIES.map((cat) => {
                const count = getCategoryCount(cat.type);
                if (count === 0) return null;
                const enabled = enabledTypes.has(cat.type);
                return (
                  <button
                    key={cat.type}
                    onClick={() => onToggleType(cat.type)}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                      enabled
                        ? 'bg-white/[0.06] text-white/90'
                        : 'text-white/30 hover:text-white/50'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{
                        backgroundColor: enabled ? cat.color : 'transparent',
                        border: `2px solid ${cat.color}`,
                        opacity: enabled ? 1 : 0.4,
                      }}
                    />
                    <span className="flex-1 text-left">{cat.label}</span>
                    <span className="text-[10px] text-white/30">{count}</span>
                  </button>
                );
              })}
            </div>
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
              <p className="text-xs text-white/20 text-center py-4">
                {pois.length === 0 ? 'Loading locations...' : 'No results'}
              </p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {filteredPOIs.map((poi) => {
                  const isSelected = selectedPOI === poi.id;
                  const catColor =
                    CATEGORIES.find((c) => c.type === poi.type)?.color ?? '#FFC805';
                  return (
                    <button
                      key={poi.id}
                      onClick={() => onSelectPOI(isSelected ? null : poi.id)}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors text-left ${
                        isSelected
                          ? 'bg-[#FFC805]/10 border border-[#FFC805]/20'
                          : 'hover:bg-white/[0.04] border border-transparent'
                      }`}
                    >
                      <MapPin
                        className="w-3.5 h-3.5 shrink-0"
                        style={{ color: catColor }}
                      />
                      <div className="min-w-0">
                        <p
                          className={`text-sm truncate ${
                            isSelected ? 'text-[#FFC805]' : 'text-white/80'
                          }`}
                        >
                          {poi.name}
                        </p>
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
              {pois.length} locations &bull; fortnite-api.com
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

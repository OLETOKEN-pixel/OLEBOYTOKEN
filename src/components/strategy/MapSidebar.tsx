import { ChevronLeft, ChevronRight, Eye, EyeOff, Image, Tag, MapPin, Search } from 'lucide-react';
import { useState } from 'react';
import type { MapVersion, PointOfInterest, MapStyle } from '@/types/strategy';

interface MapSidebarProps {
  open: boolean;
  onToggle: () => void;
  mapStyle: MapStyle;
  onMapStyleChange: (style: MapStyle) => void;
  showPOIs: boolean;
  onShowPOIsChange: (show: boolean) => void;
  pois: PointOfInterest[];
  currentMap: MapVersion | null;
}

export function MapSidebar({
  open,
  onToggle,
  mapStyle,
  onMapStyleChange,
  showPOIs,
  onShowPOIsChange,
  pois,
  currentMap,
}: MapSidebarProps) {
  const [search, setSearch] = useState('');

  const filteredPOIs = pois.filter((poi) =>
    poi.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* Toggle button */}
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
        } transition-all duration-200 overflow-hidden bg-[#0f0f0f] border-r border-white/[0.06] flex flex-col shrink-0`}
      >
        <div className="w-[280px] h-full flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center justify-between">
              <h2 className="font-teko font-bold text-[20px] text-white uppercase tracking-wider">
                Strategy Map
              </h2>
              <button
                onClick={onToggle}
                className="w-7 h-7 flex items-center justify-center rounded-md text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
            {currentMap && (
              <p className="text-xs text-white/40 mt-1">
                {currentMap.name} &bull; Patch {currentMap.patch}
              </p>
            )}
          </div>

          {/* Map Style Toggle */}
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-2 font-medium">Map Style</p>
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
                Labeled
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

          {/* POI Toggle + Search */}
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-white/40 uppercase tracking-wider font-medium">
                Points of Interest
              </p>
              <button
                onClick={() => onShowPOIsChange(!showPOIs)}
                className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
                  showPOIs
                    ? 'text-[#FFC805] bg-[#FFC805]/10'
                    : 'text-white/30 hover:text-white/50'
                }`}
                title={showPOIs ? 'Hide POIs' : 'Show POIs'}
              >
                {showPOIs ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input
                type="text"
                placeholder="Search POIs..."
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
                {pois.length === 0 ? 'No POIs loaded' : 'No results'}
              </p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {filteredPOIs.map((poi) => (
                  <div
                    key={poi.id}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/[0.04] transition-colors cursor-default"
                  >
                    <MapPin className="w-3.5 h-3.5 text-[#FFC805] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-white/80 truncate">{poi.name}</p>
                      <p className="text-[10px] text-white/30 capitalize">{poi.type.replace('_', ' ')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-white/[0.06]">
            <p className="text-[10px] text-white/20 text-center">
              {pois.length} POIs &bull; Data from fortnite-api.com
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

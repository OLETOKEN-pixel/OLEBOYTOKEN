import { Map } from 'lucide-react';

export function MapLoadingState() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0a0a0a] rounded-lg">
      <div className="flex flex-col items-center gap-4 animate-pulse">
        <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
          <Map className="w-8 h-8 text-[#FFC805]/40" />
        </div>
        <div className="text-center">
          <p className="font-teko text-lg text-white/40 uppercase tracking-wider">Loading Map</p>
          <p className="text-xs text-white/20 mt-1">Fetching Fortnite map data...</p>
        </div>
      </div>
    </div>
  );
}

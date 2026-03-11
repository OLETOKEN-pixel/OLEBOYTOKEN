import { Map, AlertTriangle } from 'lucide-react';

interface MapLoadingStateProps {
  error?: string;
}

export function MapLoadingState({ error }: MapLoadingStateProps) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0a0a0a] rounded-lg">
      {error ? (
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-red-500/[0.08] border border-red-500/[0.15] flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-400/60" />
          </div>
          <div className="text-center max-w-xs">
            <p className="font-teko text-lg text-white/50 uppercase tracking-wider">Map Error</p>
            <p className="text-xs text-white/30 mt-1">{error}</p>
            <p className="text-xs text-white/20 mt-2">Try refreshing the page</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
            <Map className="w-8 h-8 text-[#FFC805]/40" />
          </div>
          <div className="text-center">
            <p className="font-teko text-lg text-white/40 uppercase tracking-wider">Loading Map</p>
            <p className="text-xs text-white/20 mt-1">Fetching Fortnite map data...</p>
          </div>
        </div>
      )}
    </div>
  );
}

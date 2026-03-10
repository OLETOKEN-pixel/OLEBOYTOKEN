import { useMap } from 'react-leaflet';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface MapControlsProps {
  onResetView: () => void;
}

export function MapControls({ onResetView }: MapControlsProps) {
  const map = useMap();

  return (
    <div className="leaflet-top leaflet-right">
      <div className="leaflet-control flex flex-col gap-1 p-1">
        <button
          onClick={() => map.zoomIn()}
          className="w-9 h-9 flex items-center justify-center bg-[#1a1a1a]/90 border border-white/10 rounded-lg text-white/70 hover:text-white hover:bg-[#252525] transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => map.zoomOut()}
          className="w-9 h-9 flex items-center justify-center bg-[#1a1a1a]/90 border border-white/10 rounded-lg text-white/70 hover:text-white hover:bg-[#252525] transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={onResetView}
          className="w-9 h-9 flex items-center justify-center bg-[#1a1a1a]/90 border border-white/10 rounded-lg text-white/70 hover:text-white hover:bg-[#252525] transition-colors"
          title="Reset view"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

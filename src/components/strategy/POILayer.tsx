import { LayerGroup, CircleMarker, Tooltip } from 'react-leaflet';
import type { PointOfInterest } from '@/types/strategy';

interface POILayerProps {
  pois: PointOfInterest[];
  selectedPOI: string | null;
  onSelectPOI: (id: string | null) => void;
}

const POI_COLORS: Record<string, string> = {
  named: '#FFC805',
  landmark: '#8B8B8B',
  hot_drop: '#FF4444',
  mobility: '#44BBFF',
  reboot: '#44FF88',
  custom: '#BB88FF',
};

export function POILayer({ pois, selectedPOI, onSelectPOI }: POILayerProps) {
  return (
    <LayerGroup>
      {pois.map((poi) => {
        // Coordinates are already in pixel space (matching Leaflet CRS.Simple)
        // In CRS.Simple: lat = y (from top), lng = x (from left)
        const lat = poi.y;
        const lng = poi.x;
        const color = POI_COLORS[poi.type] ?? POI_COLORS.named;
        const isSelected = selectedPOI === poi.id;

        return (
          <CircleMarker
            key={poi.id}
            center={[lat, lng]}
            radius={isSelected ? 10 : 7}
            pathOptions={{
              fillColor: color,
              fillOpacity: isSelected ? 1 : 0.85,
              color: isSelected ? '#fff' : '#000',
              weight: isSelected ? 3 : 2,
              opacity: 0.9,
            }}
            eventHandlers={{
              click: () => onSelectPOI(isSelected ? null : poi.id),
            }}
          >
            <Tooltip
              direction="top"
              offset={[0, -10]}
              className="strategy-poi-tooltip"
              permanent={isSelected}
            >
              <div className="px-2 py-1">
                <p className="font-bold text-sm text-white">{poi.name}</p>
                <p className="text-xs text-gray-400 capitalize">{poi.type.replace('_', ' ')}</p>
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </LayerGroup>
  );
}

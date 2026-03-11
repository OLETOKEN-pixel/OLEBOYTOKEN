import { LayerGroup, CircleMarker, Tooltip } from 'react-leaflet';
import type { PointOfInterest } from '@/types/strategy';
import { normToCRS } from '@/types/strategy';

interface POILayerProps {
  pois: PointOfInterest[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

const POI_COLORS: Record<string, string> = {
  named: '#FFC805',
  landmark: '#8B8B8B',
};

export function POILayer({ pois, selectedId, onSelect }: POILayerProps) {
  return (
    <LayerGroup>
      {pois.map((poi) => {
        const [lat, lng] = normToCRS(poi.xNorm, poi.yNorm);
        const color = POI_COLORS[poi.type] ?? POI_COLORS.named;
        const isSelected = selectedId === poi.id;

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
              click: () => onSelect(isSelected ? null : poi.id),
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
                <p className="text-xs text-gray-400 capitalize">{poi.type}</p>
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </LayerGroup>
  );
}

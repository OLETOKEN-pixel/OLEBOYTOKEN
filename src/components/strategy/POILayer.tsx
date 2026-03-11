import { LayerGroup, CircleMarker, Tooltip } from 'react-leaflet';
import type { PointOfInterest } from '@/types/strategy';

interface POILayerProps {
  pois: PointOfInterest[];
  imageWidth: number;
  imageHeight: number;
}

const POI_COLORS: Record<string, string> = {
  named: '#FFC805',
  landmark: '#8B8B8B',
  hot_drop: '#FF4444',
  mobility: '#44BBFF',
  reboot: '#44FF88',
  custom: '#BB88FF',
};

export function POILayer({ pois, imageWidth, imageHeight }: POILayerProps) {
  return (
    <LayerGroup>
      {pois.map((poi) => {
        // Convert normalized 0..1 to Leaflet CRS.Simple pixel coordinates
        const lat = poi.y * imageHeight;
        const lng = poi.x * imageWidth;
        const color = POI_COLORS[poi.type] ?? POI_COLORS.named;

        return (
          <CircleMarker
            key={poi.id}
            center={[lat, lng]}
            radius={6}
            pathOptions={{
              fillColor: color,
              fillOpacity: 0.9,
              color: '#000',
              weight: 2,
              opacity: 0.8,
            }}
          >
            <Tooltip
              direction="top"
              offset={[0, -8]}
              className="strategy-poi-tooltip"
            >
              <div className="px-2 py-1">
                <p className="font-bold text-sm">{poi.name}</p>
                <p className="text-xs text-gray-400 capitalize">{poi.type.replace('_', ' ')}</p>
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </LayerGroup>
  );
}

import { LayerGroup, CircleMarker, Tooltip } from 'react-leaflet';
import type { ChestSpawn } from '@/types/strategy';
import { normToCRS } from '@/types/strategy';

interface ChestLayerProps {
  chests: ChestSpawn[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

const CHEST_COLORS = {
  regular_chest: { fill: '#FFA500', stroke: '#CC8400' },
  rare_chest: { fill: '#FFD700', stroke: '#4488FF' },
};

export function ChestLayer({ chests, selectedId, onSelect }: ChestLayerProps) {
  return (
    <LayerGroup>
      {chests.map((chest) => {
        const [lat, lng] = normToCRS(chest.xNorm, chest.yNorm);
        const colors = CHEST_COLORS[chest.chestType];
        const isSelected = selectedId === chest.id;

        return (
          <CircleMarker
            key={chest.id}
            center={[lat, lng]}
            radius={isSelected ? 8 : 5}
            pathOptions={{
              fillColor: colors.fill,
              fillOpacity: isSelected ? 1 : 0.8,
              color: isSelected ? '#fff' : colors.stroke,
              weight: isSelected ? 3 : 1.5,
              opacity: 0.9,
            }}
            eventHandlers={{
              click: () => onSelect(isSelected ? null : chest.id),
            }}
          >
            <Tooltip
              direction="top"
              offset={[0, -8]}
              className="strategy-poi-tooltip"
              permanent={isSelected}
            >
              <div className="px-2 py-1">
                <p className="font-bold text-xs text-white">
                  {chest.chestType === 'rare_chest' ? 'Rare Chest' : 'Regular Chest'}
                </p>
                <p className="text-[10px] text-gray-400">{chest.locationName}</p>
                {isSelected && (
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Spawn: {Math.round(chest.spawnRate * 100)}% &bull; {chest.confidence}
                  </p>
                )}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </LayerGroup>
  );
}

import type { FortniteApiMapResponse, FortniteMapData, PointOfInterest } from '@/types/strategy';

const API_URL = 'https://fortnite-api.com/v1/map';

// The fortnite-api.com map images are 2048x2048
const MAP_IMAGE_SIZE = 2048;

// Game world coordinate range (approximate, centered at 0,0)
// The map covers roughly -135000 to 135000 on both axes
const GAME_COORD_MIN = -135000;
const GAME_COORD_MAX = 135000;
const GAME_COORD_RANGE = GAME_COORD_MAX - GAME_COORD_MIN;

/**
 * Convert game world coordinates to pixel coordinates on the map image.
 * Game coords: x goes right, y goes up. Image: x goes right, y goes down.
 */
function gameToPixel(gameX: number, gameY: number): { x: number; y: number } {
  const x = ((gameX - GAME_COORD_MIN) / GAME_COORD_RANGE) * MAP_IMAGE_SIZE;
  const y = ((GAME_COORD_MAX - gameY) / GAME_COORD_RANGE) * MAP_IMAGE_SIZE; // Y inverted
  return { x, y };
}

/**
 * Classify a POI name into a type category.
 * Named locations are major POIs (usually capitalized proper names on the map).
 * The API doesn't provide type info, so we infer from naming patterns.
 */
function classifyPOI(name: string): 'named' | 'landmark' {
  // Named locations are typically 2-3 word proper nouns shown prominently on the map
  // They're the major locations players reference. This is a heuristic.
  const knownNamedPatterns = [
    // Common named location patterns - major POIs tend to be short proper names
    /^[A-Z][a-z]+ [A-Z][a-z]+$/,  // "Pleasant Park", "Tilted Towers"
    /^[A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]+$/,  // "Shifty Shafts Mine"
    /^The [A-Z]/,  // "The Citadel"
  ];

  // If name matches common named location patterns, classify as named
  for (const pattern of knownNamedPatterns) {
    if (pattern.test(name)) return 'named';
  }

  // Default: all POIs from the API are significant locations
  return 'named';
}

export async function fetchFortniteMap(): Promise<FortniteMapData> {
  const response = await fetch(API_URL);
  if (!response.ok) {
    throw new Error(`Fortnite API error: ${response.status}`);
  }

  const json: FortniteApiMapResponse = await response.json();

  const pois: PointOfInterest[] = (json.data.pois || []).map((poi) => {
    const pixel = gameToPixel(poi.location.x, poi.location.y);
    return {
      id: poi.id,
      name: poi.name,
      type: classifyPOI(poi.name),
      x: pixel.x,
      y: pixel.y,
    };
  });

  return {
    images: {
      blank: json.data.images.blank,
      pois: json.data.images.pois,
    },
    pois,
    imageWidth: MAP_IMAGE_SIZE,
    imageHeight: MAP_IMAGE_SIZE,
  };
}

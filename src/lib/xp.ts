/** XP required to go from level N to level N+1 */
export function getLevelXpRequired(level: number): number {
  return level < 5 ? 100 : 200;
}

/** Compute level from total XP */
export function getLevel(xp: number): number {
  if (xp < 500) return Math.floor(xp / 100);
  return 5 + Math.floor((xp - 500) / 200);
}

/** XP accumulated within the current level */
export function getXpInLevel(xp: number): number {
  const level = getLevel(xp);
  if (level < 5) return xp - level * 100;
  return xp - (500 + (level - 5) * 200);
}

/** XP still needed to reach next level */
export function getXpToNext(xp: number): number {
  return getLevelXpRequired(getLevel(xp)) - getXpInLevel(xp);
}

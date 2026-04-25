export type LevelReward = {
  id: 'mousepad' | 'mouse';
  name: string;
  image: string;
  levelRequired: number;
};

export const LEVEL_REWARDS: LevelReward[] = [
  {
    id: 'mousepad',
    name: 'TAPPETINO',
    image: '/shop/tappetino.png',
    levelRequired: 15,
  },
  {
    id: 'mouse',
    name: 'MOUSE',
    image: '/shop/mouse.webp',
    levelRequired: 30,
  },
];

export function getNextLevelReward(level: number): LevelReward | null {
  return LEVEL_REWARDS.find((reward) => level < reward.levelRequired) ?? null;
}

export function isLevelRewardUnlocked(level: number, reward: LevelReward) {
  return level >= reward.levelRequired;
}

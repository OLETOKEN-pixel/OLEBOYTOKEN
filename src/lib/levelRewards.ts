import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type ShopLevelRewardRow = Database['public']['Tables']['shop_level_rewards']['Row'];

export type LevelReward = {
  id: string;
  name: string;
  description?: string;
  image: string;
  imagePath?: string;
  levelRequired: number;
  isActive?: boolean;
};

export const LEVEL_REWARDS: LevelReward[] = [
  {
    id: 'mousepad',
    name: 'TAPPETINO',
    description: 'Official OleBoy mousepad reward.',
    image: '/shop/tappetino.png',
    imagePath: '/shop/tappetino.png',
    levelRequired: 15,
    isActive: true,
  },
  {
    id: 'mouse',
    name: 'MOUSE',
    description: 'Official OleBoy mouse reward.',
    image: '/shop/mouse.webp',
    imagePath: '/shop/mouse.webp',
    levelRequired: 30,
    isActive: true,
  },
];

export function resolveLevelRewardImage(imagePath: string) {
  if (!imagePath) return '';
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://') || imagePath.startsWith('/')) {
    return imagePath;
  }

  return supabase.storage.from('shop-rewards').getPublicUrl(imagePath).data.publicUrl;
}

export function mapShopLevelReward(row: ShopLevelRewardRow): LevelReward {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    image: resolveLevelRewardImage(row.image_path),
    imagePath: row.image_path,
    levelRequired: row.level_required,
    isActive: row.is_active,
  };
}

export function sortLevelRewards<T extends { levelRequired: number }>(rewards: T[]) {
  return [...rewards].sort((a, b) => a.levelRequired - b.levelRequired);
}

export function getNextLevelReward(level: number, rewards: LevelReward[] = LEVEL_REWARDS): LevelReward | null {
  return sortLevelRewards(rewards).find((reward) => reward.isActive !== false && level < reward.levelRequired) ?? null;
}

export function isLevelRewardUnlocked(level: number, reward: LevelReward) {
  return level >= reward.levelRequired;
}

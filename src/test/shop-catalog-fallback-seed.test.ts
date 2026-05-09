import { describe, expect, it, vi } from 'vitest';
import { createFallbackAdminShopSeed } from '@/lib/shopCatalog';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://storage.test/${path}` },
        }),
      }),
    },
  },
}));

describe('shop fallback admin seed', () => {
  it('builds the current public shop cards as an admin draft seed', () => {
    const seed = createFallbackAdminShopSeed();
    const featuredSlots = seed.slots.filter((slot) => slot.surface_key === 'shop.featured_cards');
    const unlockSlots = seed.slots.filter((slot) => slot.surface_key === 'shop.unlock_cards');

    expect(seed.items).toHaveLength(9);
    expect(featuredSlots).toHaveLength(5);
    expect(unlockSlots).toHaveLength(2);
    expect(seed.items.some((item) => item.slug === 'fallback-vip-30d')).toBe(true);
    expect(seed.items.some((item) => item.slug === 'fallback-pack-50')).toBe(true);
    expect(unlockSlots.every((slot) => slot.presentation.template_key === 'unlock-card')).toBe(true);
    expect(featuredSlots.every((slot) => slot.presentation.template_key === 'featured-card')).toBe(true);
  });
});

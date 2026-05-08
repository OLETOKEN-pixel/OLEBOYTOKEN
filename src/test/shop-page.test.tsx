import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Shop from '@/pages/Shop';

const here = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(here, '..', '..');

const mocks = vi.hoisted(() => ({
  isMobile: false,
  openWalletPurchase: vi.fn(),
  claimReward: vi.fn(),
  refreshWallet: vi.fn(),
  toast: vi.fn(),
  featuredCards: [
    {
      id: 'coin-pack-3',
      slotId: 'featured-1',
      surfaceKey: 'shop.featured_cards',
      sortOrder: 0,
      cardVariant: 'coins',
      title: '3 COINS',
      subtitle: 'STARTER',
      description: 'Starter pack',
      image: '/coin.png',
      kind: 'coin_pack',
      ctaLabel: 'BUY NOW',
      actionKey: null,
      coinAmount: 3,
      vipDurationDays: null,
      priceLabel: '€3,00',
      priceCurrency: 'eur',
      unlockLabel: null,
      levelRequired: null,
      challengeId: null,
      isLocked: false,
      isClaimed: false,
      claimStatus: null,
      badgeLabel: 'x3',
      metadata: { badge: 'x3' },
      searchText: '3 coins starter starter pack €3,00 x3 coin_pack',
    },
    {
      id: 'coin-pack-5',
      slotId: 'featured-2',
      surfaceKey: 'shop.featured_cards',
      sortOrder: 1,
      cardVariant: 'coins',
      title: '5 COINS',
      subtitle: 'BOOST',
      description: 'Boost pack',
      image: '/coin.png',
      kind: 'coin_pack',
      ctaLabel: 'BUY NOW',
      actionKey: null,
      coinAmount: 5,
      vipDurationDays: null,
      priceLabel: '€5,00',
      priceCurrency: 'eur',
      unlockLabel: null,
      levelRequired: null,
      challengeId: null,
      isLocked: false,
      isClaimed: false,
      claimStatus: null,
      badgeLabel: 'x5',
      metadata: { badge: 'x5' },
      searchText: '5 coins boost boost pack €5,00 x5 coin_pack',
    },
    {
      id: 'coin-pack-10',
      slotId: 'featured-3',
      surfaceKey: 'shop.featured_cards',
      sortOrder: 2,
      cardVariant: 'coins',
      title: '10 COINS',
      subtitle: 'MOST WANTED',
      description: 'Most wanted pack',
      image: '/coin.png',
      kind: 'coin_pack',
      ctaLabel: 'BUY NOW',
      actionKey: null,
      coinAmount: 10,
      vipDurationDays: null,
      priceLabel: '€10,00',
      priceCurrency: 'eur',
      unlockLabel: null,
      levelRequired: null,
      challengeId: null,
      isLocked: false,
      isClaimed: false,
      claimStatus: null,
      badgeLabel: 'x10',
      metadata: { badge: 'x10' },
      searchText: '10 coins most wanted most wanted pack €10,00 x10 coin_pack',
    },
    {
      id: 'coin-pack-15',
      slotId: 'featured-4',
      surfaceKey: 'shop.featured_cards',
      sortOrder: 3,
      cardVariant: 'coins',
      title: '15 COINS',
      subtitle: 'CLIMBER',
      description: 'Climber pack',
      image: '/coin.png',
      kind: 'coin_pack',
      ctaLabel: 'BUY NOW',
      actionKey: null,
      coinAmount: 15,
      vipDurationDays: null,
      priceLabel: '€15,00',
      priceCurrency: 'eur',
      unlockLabel: null,
      levelRequired: null,
      challengeId: null,
      isLocked: false,
      isClaimed: false,
      claimStatus: null,
      badgeLabel: 'x15',
      metadata: { badge: 'x15' },
      searchText: '15 coins climber climber pack €15,00 x15 coin_pack',
    },
    {
      id: 'coin-pack-25',
      slotId: 'featured-5',
      surfaceKey: 'shop.featured_cards',
      sortOrder: 4,
      cardVariant: 'coins',
      title: '25 COINS',
      subtitle: 'BEST SELLER',
      description: 'Best seller pack',
      image: '/coin.png',
      kind: 'coin_pack',
      ctaLabel: 'BUY NOW',
      actionKey: null,
      coinAmount: 25,
      vipDurationDays: null,
      priceLabel: '€25,00',
      priceCurrency: 'eur',
      unlockLabel: null,
      levelRequired: null,
      challengeId: null,
      isLocked: false,
      isClaimed: false,
      claimStatus: null,
      badgeLabel: 'x25',
      metadata: { badge: 'x25' },
      searchText: '25 coins best seller best seller pack €25,00 x25 coin_pack',
    },
  ],
  unlockCards: [
    {
      id: 'reward-15',
      slotId: 'unlock-1',
      surfaceKey: 'shop.unlock_cards',
      sortOrder: 0,
      cardVariant: 'reward',
      title: 'TAPPETINO',
      subtitle: 'LEVEL REWARD',
      description: 'Official OleBoy mousepad reward.',
      image: '/shop/tappetino.png',
      kind: 'physical_reward',
      ctaLabel: 'CLAIM',
      actionKey: null,
      coinAmount: null,
      vipDurationDays: null,
      priceLabel: null,
      priceCurrency: null,
      unlockLabel: 'LVL 15',
      levelRequired: 15,
      challengeId: null,
      isLocked: true,
      isClaimed: false,
      claimStatus: null,
      badgeLabel: null,
      metadata: {},
      searchText: 'tappetino level reward official oleboy mousepad reward lvl 15 physical_reward',
    },
    {
      id: 'reward-30',
      slotId: 'unlock-2',
      surfaceKey: 'shop.unlock_cards',
      sortOrder: 1,
      cardVariant: 'reward',
      title: 'MOUSE',
      subtitle: 'LEVEL REWARD',
      description: 'Official OleBoy mouse reward.',
      image: '/shop/mouse.webp',
      kind: 'physical_reward',
      ctaLabel: 'CLAIM',
      actionKey: null,
      coinAmount: null,
      vipDurationDays: null,
      priceLabel: null,
      priceCurrency: null,
      unlockLabel: 'LVL 30',
      levelRequired: 30,
      challengeId: null,
      isLocked: true,
      isClaimed: false,
      claimStatus: null,
      badgeLabel: null,
      metadata: {},
      searchText: 'mouse level reward official oleboy mouse reward lvl 30 physical_reward',
    },
  ],
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    rpc: vi.fn(),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    refreshWallet: mocks.refreshWallet,
  }),
}));

vi.mock('@/hooks/useShopCatalog', () => ({
  useShopCatalog: () => ({
    catalog: {
      viewer: {
        isVip: false,
        level: 12,
      },
    },
    featuredCards: mocks.featuredCards,
    unlockCards: mocks.unlockCards,
    claimReward: mocks.claimReward,
    isClaiming: false,
  }),
}));

vi.mock('@/components/layout/PublicLayout', () => ({
  PublicLayout: ({ children }: { children: ReactNode }) => <div data-testid="public-layout">{children}</div>,
}));

vi.mock('@/components/home/sections/FooterSection', () => ({
  FooterSection: () => <footer data-testid="shop-footer" />,
}));

vi.mock('@/contexts/WalletPurchaseContext', () => ({
  useWalletPurchase: () => ({
    openWalletPurchase: mocks.openWalletPurchase,
  }),
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => mocks.isMobile,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mocks.toast,
  }),
}));

function renderShop() {
  return render(
    <MemoryRouter initialEntries={['/shop']}>
      <Routes>
        <Route path="/shop" element={<Shop />} />
        <Route path="/privacy" element={<div data-testid="privacy-page">PRIVACY</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Shop page', () => {
  beforeEach(() => {
    mocks.isMobile = false;
    mocks.openWalletPurchase.mockReset();
    mocks.claimReward.mockReset();
    mocks.refreshWallet.mockReset();
    mocks.toast.mockReset();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('registers the standalone /shop route in the app shell', () => {
    const appFile = fs.readFileSync(path.join(rootDir, 'src', 'App.tsx'), 'utf8');

    expect(appFile).toContain('path="/shop"');
  });

  it('renders the desktop shop page with local assets and live catalog cards', () => {
    const { container } = renderShop();
    const srcs = Array.from(container.querySelectorAll('img'))
      .map((img) => img.getAttribute('src'))
      .filter((src): src is string => Boolean(src));
    const localNeons = srcs.filter((src) => src === '/figma-assets/figma-neon.png');

    expect(screen.getByTestId('shop-page')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search for items by title or price')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'POLICY' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'WALLET' })).toBeInTheDocument();
    expect(screen.getByText('GET VIP NOW!')).toBeInTheDocument();
    expect(screen.getByText(/REACH/i)).toBeInTheDocument();
    expect(screen.getByText('€3,00')).toBeInTheDocument();
    expect(screen.getByText('€25,00')).toBeInTheDocument();
    expect(screen.getByText('LVL 15')).toBeInTheDocument();
    expect(screen.getByText('LVL 30')).toBeInTheDocument();
    expect(screen.getByText('LVL 12')).toBeInTheDocument();
    expect(screen.getByTestId('shop-footer')).toBeInTheDocument();
    expect(container.querySelector('[data-wallet-coin="true"]')).not.toBeNull();
    expect(srcs).toContain('/figma-assets/shop-spaccato-title.svg');
    expect(srcs).toContain('/figma-assets/shop/search-icon.svg');
    expect(srcs).toContain('/figma-assets/shop/vip-hero-overlay.svg');
    expect(srcs).toContain('/figma-assets/shop/reward-mousepad.png?v=3');
    expect(srcs).toContain('/shop/tappetino.png');
    expect(srcs).toContain('/shop/mouse.webp');
    expect(srcs).toContain('/coin.png');
    expect(localNeons).toHaveLength(1);
    expect(srcs.some((src) => src.startsWith('https://www.figma.com/api/mcp/asset/'))).toBe(false);
  });

  it('wires policy, wallet, VIP and rewards actions to the intended flows', () => {
    renderShop();

    fireEvent.click(screen.getByRole('button', { name: 'WALLET' }));
    expect(mocks.openWalletPurchase).toHaveBeenCalledWith('coins');

    fireEvent.click(screen.getAllByRole('button', { name: 'KNOW MORE' })[0]);
    expect(mocks.openWalletPurchase).toHaveBeenCalledWith('vip');

    fireEvent.click(screen.getAllByRole('button', { name: 'KNOW MORE' })[1]);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'POLICY' }));
    expect(screen.getByTestId('privacy-page')).toBeInTheDocument();
  });

  it('filters the rendered catalog client-side from the search field', () => {
    const { container } = renderShop();
    const input = screen.getByPlaceholderText('Search for items by title or price');

    expect(container.querySelectorAll('[data-shop-card]').length).toBe(7);

    fireEvent.change(input, { target: { value: 'lvl' } });
    expect(container.querySelectorAll('[data-shop-card]').length).toBe(2);

    fireEvent.change(input, { target: { value: 'starter' } });
    expect(container.querySelectorAll('[data-shop-card]').length).toBe(1);

    fireEvent.change(input, { target: { value: '' } });
    expect(container.querySelectorAll('[data-shop-card]').length).toBe(7);
  });

  it('renders the responsive mobile adaptation', () => {
    mocks.isMobile = true;

    renderShop();

    expect(screen.getByTestId('shop-page')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search for items by title or price')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'POLICY' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'WALLET' })).toBeInTheDocument();
  });
});

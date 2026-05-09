import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Shop from '@/pages/Shop';
import type { ShopCardViewModel } from '@/lib/shopCatalog';

const here = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(here, '..', '..');

function makeFeaturedCard(
  id: string,
  slotId: string,
  sortOrder: number,
  title: string,
  subtitle: string,
  description: string,
  coinAmount: number,
  priceLabel: string,
  badgeLabel: string,
): ShopCardViewModel {
  return {
    id,
    slotId,
    surfaceKey: 'shop.featured_cards',
    sortOrder,
    cardVariant: 'coins',
    templateKey: 'featured-card',
    themeKey: 'default',
    title,
    subtitle,
    description,
    supportingText: '',
    image: '/coin.png',
    primaryImage: '/coin.png',
    secondaryImage: '',
    kind: 'coin_pack',
    ctaLabel: 'BUY NOW',
    actionKey: null,
    coinAmount,
    vipDurationDays: null,
    priceLabel,
    priceCurrency: 'eur',
    unlockLabel: null,
    levelRequired: null,
    challengeId: null,
    isLocked: false,
    isClaimed: false,
    claimStatus: null,
    badgeLabel,
    showBadge: true,
    showSubtitle: true,
    showSupportingText: false,
    showSecondaryImage: false,
    metadata: { badge: badgeLabel },
    searchText: `${title} ${subtitle} ${description} ${priceLabel} ${badgeLabel}`.toLowerCase(),
  };
}

function makeUnlockCard(
  id: string,
  slotId: string,
  sortOrder: number,
  title: string,
  description: string,
  image: string,
  levelRequired: number,
): ShopCardViewModel {
  return {
    id,
    slotId,
    surfaceKey: 'shop.unlock_cards',
    sortOrder,
    cardVariant: 'reward',
    templateKey: 'unlock-card',
    themeKey: 'default',
    title,
    subtitle: 'LEVEL REWARD',
    description,
    supportingText: description,
    image,
    primaryImage: image,
    secondaryImage: '',
    kind: 'physical_reward',
    ctaLabel: 'CLAIM',
    actionKey: null,
    coinAmount: null,
    vipDurationDays: null,
    priceLabel: null,
    priceCurrency: null,
    unlockLabel: `LVL ${levelRequired}`,
    levelRequired,
    challengeId: null,
    isLocked: true,
    isClaimed: false,
    claimStatus: null,
    badgeLabel: 'UNLOCK',
    showBadge: true,
    showSubtitle: true,
    showSupportingText: true,
    showSecondaryImage: false,
    metadata: {},
    searchText: `${title} level reward ${description} lvl ${levelRequired}`.toLowerCase(),
  };
}

const mocks = vi.hoisted(() => ({
  isMobile: false,
  isAdmin: false,
  openWalletPurchase: vi.fn(),
  claimReward: vi.fn(),
  refreshWallet: vi.fn(),
  toast: vi.fn(),
  featuredCards: [
    makeFeaturedCard('coin-pack-3', 'featured-1', 0, '3 COINS', 'STARTER PACK', 'Starter pack', 3, '€3,00', 'COINS'),
    makeFeaturedCard('coin-pack-5', 'featured-2', 1, '5 COINS', 'COIN PACK', 'Boost pack', 5, '€5,00', 'COINS'),
    makeFeaturedCard('coin-pack-10', 'featured-3', 2, '10 COINS', 'COIN PACK', 'Most wanted pack', 10, '€10,00', 'COINS'),
    makeFeaturedCard('coin-pack-15', 'featured-4', 3, '15 COINS', 'COIN PACK', 'Climber pack', 15, '€15,00', 'COINS'),
    makeFeaturedCard('coin-pack-25', 'featured-5', 4, '25 COINS', 'COIN PACK', 'Best seller pack', 25, '€25,00', 'COINS'),
  ] satisfies ShopCardViewModel[],
  unlockCards: [
    makeUnlockCard('reward-15', 'unlock-1', 0, 'TAPPETINO', 'Official OleBoy mousepad reward.', '/shop/tappetino.png', 15),
    makeUnlockCard('reward-30', 'unlock-2', 1, 'MOUSE', 'Official OleBoy mouse reward.', '/shop/mouse.webp', 30),
  ] satisfies ShopCardViewModel[],
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

vi.mock('@/hooks/useAdminStatus', () => ({
  useAdminStatus: () => ({
    user: null,
    authLoading: false,
    isAdmin: mocks.isAdmin,
    isLoading: false,
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

function createWrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function AdminLocationProbe() {
  const location = useLocation();
  return <div data-testid="admin-location">{`${location.pathname}${location.search}`}</div>;
}

function renderShop() {
  return render(
    <MemoryRouter initialEntries={['/shop']}>
      <Routes>
        <Route path="/shop" element={<Shop />} />
        <Route path="/privacy" element={<div data-testid="privacy-page">PRIVACY</div>} />
        <Route path="/admin/shop" element={<AdminLocationProbe />} />
      </Routes>
    </MemoryRouter>,
    { wrapper: createWrapper },
  );
}

describe('Shop page', () => {
  beforeEach(() => {
    mocks.isMobile = false;
    mocks.isAdmin = false;
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
    expect(container.querySelectorAll('[data-shop-rail-mode="fixed"]')).toHaveLength(2);
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

  it('deep-links admins from a public card into the admin shop editor workspace', () => {
    mocks.isAdmin = true;
    renderShop();

    fireEvent.click(screen.getByRole('button', { name: 'Edit 3 COINS' }));

    expect(screen.getByTestId('admin-location')).toHaveTextContent(
      '/admin/shop?slot=featured-1&surface=shop.featured_cards&item=coin-pack-3',
    );
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

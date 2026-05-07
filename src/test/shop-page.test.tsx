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
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('registers the standalone /shop route in the app shell', () => {
    const appFile = fs.readFileSync(path.join(rootDir, 'src', 'App.tsx'), 'utf8');

    expect(appFile).toContain('path="/shop"');
  });

  it('renders the desktop Figma shop page with only local assets', () => {
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
    expect(screen.getAllByText('\u20AC9,99')).toHaveLength(5);
    expect(screen.queryByText('â‚¬9,99')).not.toBeInTheDocument();
    expect(screen.queryByText('Ã¢â€šÂ¬9,99')).not.toBeInTheDocument();
    expect(screen.getByTestId('shop-footer')).toBeInTheDocument();
    expect(container.querySelector('[data-wallet-coin="true"]')).not.toBeNull();
    expect(srcs).toContain('/figma-assets/shop-spaccato-title.svg');
    expect(localNeons).toHaveLength(1);
    expect(srcs).toContain('/figma-assets/shop/search-icon.svg');
    expect(srcs).toContain('/figma-assets/shop/reward-figure.png');
    expect(srcs).toContain('/figma-assets/shop/vip-hero-overlay.svg');
    expect(srcs).toContain('/figma-assets/shop/reward-mousepad.png');
    expect(srcs).toContain('/figma-assets/shop/reward-triangles-left.svg');
    expect(srcs).toContain('/figma-assets/shop/reward-triangles-right.svg');
    expect(srcs).toContain('/figma-assets/shop/reward-vector-large.svg');
    expect(srcs).toContain('/figma-assets/shop/reward-vector-small.svg');
    expect(srcs).toContain('/figma-assets/shop/reward-star-shape.svg');
    expect(srcs).not.toContain('/figma-assets/figma-star-shape.svg');
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

    expect(container.querySelectorAll('[data-shop-card]').length).toBe(10);

    fireEvent.change(input, { target: { value: 'x100' } });
    expect(container.querySelectorAll('[data-shop-card]').length).toBe(4);

    fireEvent.change(input, { target: { value: '' } });
    expect(container.querySelectorAll('[data-shop-card]').length).toBe(10);
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

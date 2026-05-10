import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletPurchaseProvider, useWalletPurchase } from '@/contexts/WalletPurchaseContext';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  toast: vi.fn(),
  redirectToCheckout: vi.fn(),
  refreshWallet: vi.fn(),
  createShopCheckout: vi.fn(),
}));

const mockCoinPacks = [3, 5, 10, 15, 25, 50].map((coins) => ({
  id: `pack-${coins}`,
  coinAmount: coins,
  metadata: { badge: `x${coins}` },
  effectivePrice: { label: `€${coins},00` },
}));

const mockVipOffer = {
  id: 'vip-30d',
  vipDurationDays: 30,
  metadata: {
    benefits: ['Real rewards', 'Giveaways', 'Less levels, more prizes'],
  },
  effectivePrice: {
    label: '5 COINS',
  },
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mocks.rpc,
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'player@example.com' },
    wallet: { balance: 9.9 },
    refreshWallet: mocks.refreshWallet,
  }),
}));

vi.mock('@/hooks/useShopCatalog', () => ({
  useShopCatalog: () => ({
    coinPacks: mockCoinPacks,
    vipOffer: mockVipOffer,
    catalog: {
      viewer: {
        isVip: false,
      },
    },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock('@/lib/checkoutRedirect', () => ({
  redirectToCheckout: mocks.redirectToCheckout,
}));

vi.mock('@/lib/shopCheckout', () => ({
  createShopCheckout: mocks.createShopCheckout,
}));

function Trigger({ children = 'OPEN WALLET' }: { children?: ReactNode }) {
  const { openWalletPurchase } = useWalletPurchase();
  return (
    <button type="button" onClick={() => openWalletPurchase()}>
      {children}
    </button>
  );
}

function TriggerVip() {
  const { openWalletPurchase } = useWalletPurchase();
  return (
    <button type="button" onClick={() => openWalletPurchase('vip')}>
      OPEN VIP
    </button>
  );
}

function renderOverlay() {
  return render(
    <MemoryRouter>
      <WalletPurchaseProvider>
        <Trigger />
      </WalletPurchaseProvider>
    </MemoryRouter>,
  );
}

describe('WalletPurchaseOverlay', () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.toast.mockReset();
    mocks.redirectToCheckout.mockReset();
    mocks.refreshWallet.mockReset();
    mocks.createShopCheckout.mockReset();
  });

  it('renders the Figma wallet modal with the live coin packages', () => {
    renderOverlay();

    fireEvent.click(screen.getByRole('button', { name: 'OPEN WALLET' }));

    expect(screen.getByRole('heading', { name: 'WALLET' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'TOKENS COINS' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'VIP MEMBERSHIP' })).toBeInTheDocument();

    for (const label of ['x3', 'x5', 'x10', 'x15', 'x25', 'x50']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    expect(screen.getByText('Accept our')).toBeInTheDocument();
    expect(screen.getByText('Terms & Conditions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Purchase 5 coins' })).toHaveTextContent('PURCHASE 5 COINS');
  });

  it('updates the purchase button and starts the generic shop checkout for the selected package', async () => {
    mocks.createShopCheckout.mockResolvedValue('https://checkout.stripe.test/session');

    renderOverlay();

    fireEvent.click(screen.getByRole('button', { name: 'OPEN WALLET' }));
    fireEvent.click(screen.getByRole('button', { name: /x25/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Purchase 25 coins' }));

    await waitFor(() => {
      expect(mocks.createShopCheckout).toHaveBeenCalledWith({
        itemId: 'pack-25',
        slug: null,
        kind: 'coin_pack',
        coinAmount: 25,
      });
    });
    expect(mocks.redirectToCheckout).toHaveBeenCalledWith('https://checkout.stripe.test/session');
  });

  it('switches to the VIP section inside the same overlay', () => {
    renderOverlay();

    fireEvent.click(screen.getByRole('button', { name: 'OPEN WALLET' }));
    fireEvent.click(screen.getByRole('button', { name: 'VIP MEMBERSHIP' }));

    expect(screen.getByText('BENEFITS:')).toBeInTheDocument();
    expect(screen.getByText('Real rewards')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Get VIP for 5 COINS' })).toHaveTextContent('GET VIP for 5 COINS');
  });

  it('starts the catalog-backed VIP purchase from the VIP tab', async () => {
    mocks.rpc.mockResolvedValue({ data: { success: true }, error: null });

    renderOverlay();

    fireEvent.click(screen.getByRole('button', { name: 'OPEN WALLET' }));
    fireEvent.click(screen.getByRole('button', { name: 'VIP MEMBERSHIP' }));
    fireEvent.click(screen.getByRole('button', { name: 'Get VIP for 5 COINS' }));

    await waitFor(() => {
      expect(mocks.rpc).toHaveBeenCalledWith('purchase_shop_wallet_item', {
        p_item_id: 'vip-30d',
      });
    });
    expect(mocks.refreshWallet).toHaveBeenCalled();
  });

  it('opens directly on the VIP tab when requested', () => {
    render(
      <MemoryRouter>
        <WalletPurchaseProvider>
          <TriggerVip />
        </WalletPurchaseProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'OPEN VIP' }));

    expect(screen.getByText('BENEFITS:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Get VIP for/i })).toHaveTextContent('GET VIP for 5 COINS');
  });
});

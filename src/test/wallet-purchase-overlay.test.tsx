import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletPurchaseProvider, useWalletPurchase } from '@/contexts/WalletPurchaseContext';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  toast: vi.fn(),
  redirectToCheckout: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: mocks.invoke,
    },
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'player@example.com' },
    wallet: { balance: 9.9 },
    refreshWallet: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock('@/lib/checkoutRedirect', () => ({
  redirectToCheckout: mocks.redirectToCheckout,
}));

vi.mock('@/components/vip/VipModal', () => ({
  VipModal: ({ open }: { open: boolean; onOpenChange: (open: boolean) => void; onBuyCoins?: () => void }) =>
    open ? <div data-testid="vip-modal">VIP MODAL OPEN</div> : null,
}));

function Trigger({ children = 'OPEN WALLET' }: { children?: ReactNode }) {
  const { openWalletPurchase } = useWalletPurchase();
  return (
    <button type="button" onClick={openWalletPurchase}>
      {children}
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
    mocks.invoke.mockReset();
    mocks.toast.mockReset();
    mocks.redirectToCheckout.mockReset();
  });

  it('renders the Figma wallet modal with the coin packages', () => {
    renderOverlay();

    fireEvent.click(screen.getByRole('button', { name: 'OPEN WALLET' }));

    expect(screen.getByRole('heading', { name: 'WALLET' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'TOKENS COINS' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'VIP MEMBERSHIP' })).toBeInTheDocument();

    for (const label of ['3 COINS', '5 COINS', '10 COINS', '15 COINS', '25 COINS', '50 COINS']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    expect(screen.getByRole('button', { name: 'Purchase 5 coins' })).toHaveTextContent('PURCHASE 5 COINS');
  });

  it('updates the purchase button and starts Stripe checkout for the selected package', async () => {
    mocks.invoke.mockResolvedValue({ data: { url: 'https://checkout.stripe.test/session' }, error: null });

    renderOverlay();

    fireEvent.click(screen.getByRole('button', { name: 'OPEN WALLET' }));
    fireEvent.click(screen.getByRole('button', { name: /25 COINS/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Purchase 25 coins' }));

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith('create-checkout', {
        body: { packageId: 'pack-25' },
      });
    });
    expect(mocks.redirectToCheckout).toHaveBeenCalledWith('https://checkout.stripe.test/session');
  });

  it('opens the existing VIP modal from the VIP tab', () => {
    renderOverlay();

    fireEvent.click(screen.getByRole('button', { name: 'OPEN WALLET' }));
    fireEvent.click(screen.getByRole('button', { name: 'VIP MEMBERSHIP' }));

    expect(screen.getByTestId('vip-modal')).toBeInTheDocument();
  });
});

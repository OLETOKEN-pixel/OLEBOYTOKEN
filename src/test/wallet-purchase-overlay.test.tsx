import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletPurchaseProvider, useWalletPurchase } from '@/contexts/WalletPurchaseContext';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  rpc: vi.fn(),
  toast: vi.fn(),
  redirectToCheckout: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: mocks.invoke,
    },
    rpc: mocks.rpc,
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
    mocks.rpc.mockReset();
    mocks.toast.mockReset();
    mocks.redirectToCheckout.mockReset();
  });

  it('renders the Figma wallet modal with the coin packages', () => {
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

  it('updates the purchase button and starts Stripe checkout for the selected package', async () => {
    mocks.invoke.mockResolvedValue({ data: { url: 'https://checkout.stripe.test/session' }, error: null });

    renderOverlay();

    fireEvent.click(screen.getByRole('button', { name: 'OPEN WALLET' }));
    fireEvent.click(screen.getByRole('button', { name: /x25/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Purchase 25 coins' }));

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith('create-checkout', {
        body: { packageId: 'pack-25' },
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
    expect(screen.getByRole('button', { name: 'Get VIP for €9,99' })).toHaveTextContent('GET VIP for €9,99');
  });

  it('starts the VIP purchase from the VIP tab', async () => {
    mocks.rpc.mockResolvedValue({ data: { success: true }, error: null });

    renderOverlay();

    fireEvent.click(screen.getByRole('button', { name: 'OPEN WALLET' }));
    fireEvent.click(screen.getByRole('button', { name: 'VIP MEMBERSHIP' }));
    fireEvent.click(screen.getByRole('button', { name: 'Get VIP for €9,99' }));

    await waitFor(() => {
      expect(mocks.rpc).toHaveBeenCalledWith('purchase_vip');
    });
  });
});

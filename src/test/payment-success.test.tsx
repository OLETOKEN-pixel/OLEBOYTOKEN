import type React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PaymentSuccess from '@/pages/PaymentSuccess';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  refreshWallet: vi.fn(),
  user: { id: 'user-1' } as { id: string } | null,
}));

vi.mock('@/components/layout/PublicLayout', () => ({
  PublicLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mocks.user,
    refreshWallet: mocks.refreshWallet,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: mocks.invoke,
    },
  },
}));

describe('PaymentSuccess', () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
    mocks.refreshWallet.mockReset();
    mocks.user = { id: 'user-1' };
  });

  it('confirms the Stripe session and refreshes the wallet', async () => {
    mocks.invoke.mockResolvedValue({
      data: { success: true, credited: true, coins: 3 },
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/payment/success?provider=stripe&session_id=cs_test_123']}>
        <PaymentSuccess />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith('confirm-checkout-session', {
        body: { sessionId: 'cs_test_123' },
      });
    });
    await waitFor(() => expect(mocks.refreshWallet).toHaveBeenCalled());
    expect(await screen.findByText('Your coins have been credited. Your wallet is updated.')).toBeInTheDocument();
  });

  it('keeps a processing message when Stripe has not marked the payment paid yet', async () => {
    mocks.invoke.mockResolvedValue({
      data: { success: true, pending: true },
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/payment/success?provider=stripe&session_id=cs_test_pending']}>
        <PaymentSuccess />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText('Stripe is still processing this payment method. The wallet will update as soon as it is paid.'),
    ).toBeInTheDocument();
    expect(mocks.refreshWallet).not.toHaveBeenCalled();
  });
});

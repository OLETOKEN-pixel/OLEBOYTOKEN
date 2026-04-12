import type { ReactNode } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

const mocks = vi.hoisted(() => {
  let authCallback: ((event: string, session: unknown) => void) | null = null;

  const profileMaybeSingle = vi.fn(async () => ({
    data: {
      id: 'profile-1',
      user_id: 'user-1',
      username: 'oleboy',
      epic_username: 'oleboy',
    },
    error: null,
  }));

  const walletMaybeSingle = vi.fn(async () => ({
    data: {
      id: 'wallet-1',
      user_id: 'user-1',
      balance: 7,
      locked_balance: 0.5,
    },
    error: null,
  }));

  const fromMock = vi.fn((table: string) => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: table === 'profiles' ? profileMaybeSingle : walletMaybeSingle,
      })),
    })),
  }));

  const channel = {
    on: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  };
  channel.on.mockReturnValue(channel);
  channel.subscribe.mockReturnValue(channel);

  return {
    auth: {
      onAuthStateChange: vi.fn((callback: (event: string, session: unknown) => void) => {
        authCallback = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      getSession: vi.fn(async () => ({ data: { session: null } })),
      refreshSession: vi.fn(),
      signOut: vi.fn(),
    },
    channelMock: vi.fn(() => channel),
    fromMock,
    getAuthCallback: () => authCallback,
    profileMaybeSingle,
    rpcMock: vi.fn(async () => ({ data: { success: true, refunded_total: 0 }, error: null })),
    walletMaybeSingle,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: mocks.auth,
    channel: mocks.channelMock,
    from: mocks.fromMock,
    rpc: mocks.rpcMock,
  },
}));

function WalletProbe({ children }: { children?: ReactNode }) {
  const { wallet } = useAuth();

  return (
    <div>
      <span data-testid="wallet-balance">{wallet?.balance ?? 'none'}</span>
      {children}
    </div>
  );
}

describe('AuthProvider match expiry refresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs fast expiry checks and refreshes the wallet when a refund is processed', async () => {
    render(
      <AuthProvider>
        <WalletProbe />
      </AuthProvider>,
    );

    await act(async () => {
      mocks.getAuthCallback()?.('SIGNED_IN', {
        user: { id: 'user-1', user_metadata: {} },
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.rpcMock).toHaveBeenCalledWith('expire_stale_matches');

    const walletReadsBeforeRefund = mocks.walletMaybeSingle.mock.calls.length;
    mocks.rpcMock.mockResolvedValueOnce({
      data: { success: true, refunded_total: 0.5 },
      error: null,
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
      await Promise.resolve();
    });

    expect(mocks.walletMaybeSingle.mock.calls.length).toBeGreaterThan(walletReadsBeforeRefund);
  });
});

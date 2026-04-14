import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateMatchOverlay } from '@/components/matches/CreateMatchOverlay';

const {
  mockToast,
  mockRefreshWallet,
  mockRpc,
  mockOnCreated,
  mockRequestPermission,
  mockShowNotification,
  mockGetRegistration,
  mockRegisterServiceWorker,
} = vi.hoisted(() => ({
  mockToast: vi.fn(),
  mockRefreshWallet: vi.fn(),
  mockRpc: vi.fn(),
  mockOnCreated: vi.fn(),
  mockRequestPermission: vi.fn(),
  mockShowNotification: vi.fn(),
  mockGetRegistration: vi.fn(),
  mockRegisterServiceWorker: vi.fn(),
}));

let notificationPermission: NotificationPermission = 'granted';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    profile: {
      username: 'Tester',
      avatar_url: null,
      preferred_region: 'EU',
      preferred_platform: 'PC',
      epic_username: 'TesterEpic',
    },
    wallet: {
      id: 'wallet-1',
      user_id: 'user-1',
      balance: 100,
      locked_balance: 0,
      created_at: '',
      updated_at: '',
    },
    isProfileComplete: true,
    refreshWallet: mockRefreshWallet,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mockRpc,
  },
}));

vi.mock('@/components/teams/PaymentModeSelector', () => ({
  PaymentModeSelector: ({
    paymentMode,
    onChangePaymentMode,
  }: {
    paymentMode: 'cover' | 'split';
    onChangePaymentMode: (mode: 'cover' | 'split') => void;
  }) => (
    <div data-testid="payment-mode-selector">
      <button type="button" onClick={() => onChangePaymentMode('cover')}>
        Cover All
      </button>
      <button type="button" onClick={() => onChangePaymentMode('split')}>
        Split Pay
      </button>
      <span data-testid="payment-mode-value">{paymentMode}</span>
    </div>
  ),
}));

vi.mock('@/components/teams/TeamSelector', () => ({
  TeamSelector: ({
    selectedTeamId,
    onSelectTeam,
  }: {
    selectedTeamId: string | null;
    onSelectTeam: (team: any | null) => void;
  }) => (
    <div data-testid="team-selector">
      <button
        type="button"
        onClick={() =>
          onSelectTeam({
            id: 'team-1',
            name: 'Mock Team',
            tag: 'MT',
            members: [],
            acceptedMemberCount: 2,
            memberBalances: [
              { user_id: 'user-2', username: 'Mate', balance: 100, has_sufficient_balance: true },
            ],
          })
        }
      >
        Select Mock Team
      </button>
      <span data-testid="selected-team-id">{selectedTeamId ?? 'none'}</span>
    </div>
  ),
}));

function renderOverlay() {
  return render(
    <MemoryRouter>
      <CreateMatchOverlay open onClose={vi.fn()} onCreated={mockOnCreated} />
    </MemoryRouter>,
  );
}

function installNotificationMocks() {
  const registration = {
    showNotification: mockShowNotification,
  };

  Object.defineProperty(window, 'isSecureContext', {
    configurable: true,
    value: true,
  });

  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: {
      get permission() {
        return notificationPermission;
      },
      requestPermission: mockRequestPermission,
    },
  });

  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      getRegistration: mockGetRegistration,
      register: mockRegisterServiceWorker,
    },
  });

  mockGetRegistration.mockResolvedValue(registration);
  mockRegisterServiceWorker.mockResolvedValue(registration);
}

async function flushAsyncNotifications() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('CreateMatchOverlay', () => {
  beforeEach(() => {
    mockToast.mockReset();
    mockRefreshWallet.mockReset();
    mockRefreshWallet.mockResolvedValue(undefined);
    mockRpc.mockReset();
    mockOnCreated.mockReset();
    mockRequestPermission.mockReset();
    mockRequestPermission.mockImplementation((callback?: (permission: NotificationPermission) => void) => {
      callback?.(notificationPermission);
      return Promise.resolve(notificationPermission);
    });
    mockShowNotification.mockReset();
    mockShowNotification.mockResolvedValue(undefined);
    mockGetRegistration.mockReset();
    mockRegisterServiceWorker.mockReset();
    notificationPermission = 'granted';
    installNotificationMocks();
  });

  it('keeps 1v1 as a two-step game to tokens flow', async () => {
    renderOverlay();

    expect(screen.getByTestId('create-match-overlay').className).toContain('z-[70]');
    expect(screen.getByTestId('create-match-scrim')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'GAME' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('tab', { name: 'TEAMS' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next step/i }));

    expect(screen.getByRole('tab', { name: 'TOKENS' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('tab', { name: 'TEAMS' })).not.toBeInTheDocument();
  });

  it('inserts a teams step for team matches and blocks tokens until a team is selected', async () => {
    renderOverlay();

    fireEvent.click(screen.getByRole('button', { name: '2v2' }));

    expect(screen.getByRole('tab', { name: 'TEAMS' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next step/i }));

    expect(screen.getByRole('tab', { name: 'TEAMS' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: /next step/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create token/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'TOKENS' }));

    expect(screen.getByRole('tab', { name: 'TEAMS' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('selected-team-id')).toHaveTextContent('none');
  });

  it('removes teams and clears team-only state when switching back to 1v1', async () => {
    renderOverlay();

    fireEvent.click(screen.getByRole('button', { name: '2v2' }));
    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    fireEvent.click(screen.getByRole('button', { name: /select mock team/i }));

    expect(screen.getByTestId('selected-team-id')).toHaveTextContent('team-1');

    fireEvent.click(screen.getByRole('tab', { name: 'GAME' }));
    fireEvent.click(screen.getByRole('button', { name: '1v1' }));

    expect(screen.queryByRole('tab', { name: 'TEAMS' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '2v2' }));
    fireEvent.click(screen.getByRole('button', { name: /next step/i }));

    expect(screen.getByTestId('selected-team-id')).toHaveTextContent('none');
  });

  it('updates total pool and prize when the entry fee changes', async () => {
    renderOverlay();

    fireEvent.click(screen.getByRole('button', { name: /next step/i }));

    expect(screen.getByLabelText('Entry fee')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '10.00' }));

    expect(screen.getByTestId('total-pool-value')).toHaveTextContent('20.00');
    expect(screen.getByTestId('prize-value')).toHaveTextContent('19.00');
  });

  it('creates a 1v1 match with hidden defaults from profile preferences', async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, match_id: 'match-123' },
      error: null,
    });

    renderOverlay();

    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    fireEvent.click(screen.getByRole('button', { name: /create token/i }));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('create_match_1v1', {
        p_entry_fee: 5,
        p_region: 'EU',
        p_platform: 'PC',
        p_mode: 'Box Fight',
      });
    });

    await waitFor(() => {
      expect(mockRefreshWallet).toHaveBeenCalled();
      expect(mockOnCreated).toHaveBeenCalledWith('match-123');
    });

    await waitFor(() => {
      expect(mockShowNotification).toHaveBeenCalledWith(
        '1V1 BOX FIGHT',
        expect.objectContaining({
          body: 'ENTRY 5.00 COINS · WIN 9.50 COINS',
          icon: '/favicon-oleboy.png',
          badge: '/favicon-oleboy.png',
          tag: 'oleboy-match-match-123',
          data: {
            matchId: 'match-123',
            url: '/matches/match-123',
          },
        }),
      );
    });
  });

  it('creates the match when notifications are denied', async () => {
    notificationPermission = 'denied';
    installNotificationMocks();
    mockRpc.mockResolvedValue({
      data: { success: true, match_id: 'match-denied' },
      error: null,
    });

    renderOverlay();

    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    fireEvent.click(screen.getByRole('button', { name: /create token/i }));

    await waitFor(() => {
      expect(mockOnCreated).toHaveBeenCalledWith('match-denied');
    });

    await flushAsyncNotifications();

    expect(mockRpc).toHaveBeenCalled();
    expect(mockShowNotification).not.toHaveBeenCalled();
  });

  it('creates the match when browser notifications are unsupported', async () => {
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: undefined,
    });
    mockRpc.mockResolvedValue({
      data: { success: true, match_id: 'match-unsupported' },
      error: null,
    });

    renderOverlay();

    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    fireEvent.click(screen.getByRole('button', { name: /create token/i }));

    await waitFor(() => {
      expect(mockOnCreated).toHaveBeenCalledWith('match-unsupported');
    });

    await flushAsyncNotifications();

    expect(mockRpc).toHaveBeenCalled();
    expect(mockShowNotification).not.toHaveBeenCalled();
  });
});

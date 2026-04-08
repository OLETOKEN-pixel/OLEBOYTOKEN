import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateMatchOverlay } from '@/components/matches/CreateMatchOverlay';

const { mockToast, mockRefreshWallet, mockRpc, mockOnCreated } = vi.hoisted(() => ({
  mockToast: vi.fn(),
  mockRefreshWallet: vi.fn(),
  mockRpc: vi.fn(),
  mockOnCreated: vi.fn(),
}));

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

function renderOverlay() {
  return render(
    <MemoryRouter>
      <CreateMatchOverlay open onClose={vi.fn()} onCreated={mockOnCreated} />
    </MemoryRouter>,
  );
}

describe('CreateMatchOverlay', () => {
  beforeEach(() => {
    mockToast.mockReset();
    mockRefreshWallet.mockReset();
    mockRefreshWallet.mockResolvedValue(undefined);
    mockRpc.mockReset();
    mockOnCreated.mockReset();
  });

  it('moves between steps and preserves the current game selection', async () => {
    renderOverlay();

    expect(screen.getByRole('tab', { name: 'GAME' })).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByRole('button', { name: /next step/i }));

    expect(screen.getByRole('tab', { name: 'TOKENS' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: /create token/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'GAME' }));

    expect(screen.getByRole('tab', { name: 'GAME' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'BOX FIGHT' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('updates total pool and prize when the entry fee changes', async () => {
    renderOverlay();

    fireEvent.click(screen.getByRole('button', { name: /next step/i }));

    const entryFeeInput = screen.getByLabelText('Entry fee');
    fireEvent.change(entryFeeInput, { target: { value: '5' } });
    fireEvent.blur(entryFeeInput);

    expect(screen.getByTestId('total-pool-value')).toHaveTextContent('10.00');
    expect(screen.getByTestId('prize-value')).toHaveTextContent('9.50');
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
        p_entry_fee: 1,
        p_region: 'EU',
        p_platform: 'PC',
        p_mode: 'Box Fight',
      });
    });

    await waitFor(() => {
      expect(mockRefreshWallet).toHaveBeenCalled();
      expect(mockOnCreated).toHaveBeenCalledWith('match-123');
    });
  });
});

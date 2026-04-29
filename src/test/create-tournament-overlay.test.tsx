import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateTournamentOverlay } from '@/components/tournaments/CreateTournamentOverlay';

const { mockToast, mockMutateAsync, mockOnCreated } = vi.hoisted(() => ({
  mockToast: vi.fn(),
  mockMutateAsync: vi.fn(),
  mockOnCreated: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    profile: {
      role: 'user',
      preferred_region: 'EU',
      preferred_platform: 'All',
    },
    wallet: {
      id: 'wallet-1',
      user_id: 'user-1',
      balance: 200,
      locked_balance: 0,
      created_at: '',
      updated_at: '',
    },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock('@/hooks/useTournaments', () => ({
  useCreateTournament: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

function renderOverlay() {
  return render(
    <MemoryRouter>
      <CreateTournamentOverlay open onClose={vi.fn()} onCreated={mockOnCreated} />
    </MemoryRouter>,
  );
}

describe('CreateTournamentOverlay', () => {
  beforeEach(() => {
    mockToast.mockReset();
    mockMutateAsync.mockReset();
    mockOnCreated.mockReset();
  });

  it('follows the figma-style game to tokens to details wizard flow', () => {
    renderOverlay();

    expect(screen.getByTestId('create-tournament-overlay').className).toContain('z-[70]');
    expect(screen.getByRole('tab', { name: 'GAME' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'DETAILS' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'PRIZE' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create tournament/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next step/i }));

    expect(screen.getByRole('tab', { name: 'TOKENS' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('First to:')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next step/i }));

    expect(screen.getByRole('tab', { name: 'DETAILS' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('tournament-name-field')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create tournament/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next step/i }));

    expect(screen.getByRole('tab', { name: 'PRIZE' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: /create tournament/i })).toBeInTheDocument();
    expect(screen.getByTestId('prize-distribution-grid')).toBeInTheDocument();
  });

  it('edits custom values inline in the token row instead of opening a second field block', () => {
    renderOverlay();

    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    fireEvent.click(screen.getAllByRole('button', { name: 'set custom' })[0]);

    const inlineInput = screen.getByLabelText('Custom first to');

    expect(screen.getByTestId('first-to-options')).toContainElement(inlineInput);

    fireEvent.change(inlineInput, { target: { value: '37' } });

    expect(screen.getByLabelText('Custom first to')).toHaveValue('37');
  });

  it('submits the tournament payload using the selections from the figma steps', async () => {
    mockMutateAsync.mockResolvedValue('tournament-123');

    renderOverlay();

    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    fireEvent.change(screen.getByDisplayValue('BOX FIGHT 3V3 FT3'), {
      target: { value: 'Sunday Cup' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    fireEvent.click(screen.getByRole('button', { name: /create tournament/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Sunday Cup',
          mode: 'Box Fight',
          team_size: 3,
          max_participants: 80,
          entry_fee: 0,
          prize_pool: 20,
          duration_seconds: 4800,
          first_to: 3,
          region: 'EU',
          platform: 'All',
          rules: undefined,
          prize_positions: [
            { position: 1, amount: 10 },
            { position: 2, amount: 6 },
            { position: 3, amount: 4 },
          ],
        }),
      );
    });

    expect(mockOnCreated).toHaveBeenCalledWith('tournament-123');
    expect(mockToast).toHaveBeenCalledWith({ title: 'Tournament created!' });
  });
});

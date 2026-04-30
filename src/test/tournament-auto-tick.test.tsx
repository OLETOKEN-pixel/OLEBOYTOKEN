import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TournamentAutoTick } from '@/components/common/TournamentAutoTick';
import { queryKeys } from '@/lib/queryKeys';

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

function renderWithProviders(pathname = '/tournaments') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[pathname]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );

  render(<TournamentAutoTick />, { wrapper: Wrapper });

  return { invalidateSpy };
}

describe('TournamentAutoTick', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    rpcMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs tournament_tick on mount and invalidates tournament and match queries when state changes', async () => {
    rpcMock.mockResolvedValue({
      data: { auto_opened: 1, started: 0, reconciled: 0, finalized: 0 },
      error: null,
    });

    const { invalidateSpy } = renderWithProviders('/tournaments/tournament-1');

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(rpcMock).toHaveBeenCalledWith('tournament_tick');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.tournaments.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.matches.all });
  });

  it('invalidates tournaments and matches when the tick only reconciles finished tournament matches', async () => {
    rpcMock.mockResolvedValue({
      data: { auto_opened: 0, started: 0, reconciled: 1, finalized: 0 },
      error: null,
    });

    const { invalidateSpy } = renderWithProviders('/tournaments/tournament-1');

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(rpcMock).toHaveBeenCalledWith('tournament_tick');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.tournaments.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.matches.all });
  });

  it('keeps polling on an interval outside auth callback routes', async () => {
    rpcMock.mockResolvedValue({
      data: { auto_opened: 0, started: 0, reconciled: 0, finalized: 0 },
      error: null,
    });

    renderWithProviders('/tournaments');

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(rpcMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(15_000);
    expect(rpcMock).toHaveBeenCalledTimes(2);
  });

  it('skips the heartbeat on auth callback routes', async () => {
    rpcMock.mockResolvedValue({
      data: { auto_opened: 1, started: 0, reconciled: 0, finalized: 0 },
      error: null,
    });

    renderWithProviders('/auth/twitch/callback');
    await vi.advanceTimersByTimeAsync(20_000);

    expect(rpcMock).not.toHaveBeenCalled();
  });
});

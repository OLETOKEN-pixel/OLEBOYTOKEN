import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerStatsModal } from '@/components/player/PlayerStatsModal';

const writeTextMock = vi.fn();

const { rpcMock, toastMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const profilePayload = {
  success: true,
  profile: {
    user_id: 'user-1',
    username: 'lightvsls',
    display_name: 'lightvsls',
    avatar_url: 'https://cdn.discordapp.com/avatars/user-1/avatar.png',
    discord_avatar_url: 'https://cdn.discordapp.com/avatars/user-1/avatar.png',
    epic_username: 'LOIS OPENDA 20',
    twitter_username: 'lightvsls',
    twitch_username: 'lightvsls',
    team_id: 'team-1',
    team_name: 'i Tucani',
    team_tag: 'TUC',
    total_xp: 2650,
    level: 26,
    rank: 294,
  },
  stats: {
    total_matches: 266,
    wins: 133,
    losses: 133,
    win_rate: 50,
  },
  tokens: {
    total_earned: 50.32,
    total_profit: 18,
    avg_profit_per_match: 3.5,
    avg_earnings_per_match: 1.78,
    best_profit: 12,
  },
  history: [
    { match_id: 'm1', status: 'loss', finished_at: '2026-04-18T09:52:00.000Z' },
    { match_id: 'm2', status: 'win', finished_at: '2026-04-18T09:46:00.000Z' },
    { match_id: 'm3', status: 'loss', finished_at: '2026-04-18T09:42:00.000Z' },
    { match_id: 'm4', status: 'loss', finished_at: '2026-04-18T09:41:00.000Z' },
    { match_id: 'm5', status: 'win', finished_at: '2026-04-18T09:40:00.000Z' },
  ],
  streak: {
    best: 12,
    current: 1,
  },
};

describe('PlayerStatsModal', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    toastMock.mockReset();
    writeTextMock.mockReset();
    writeTextMock.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    });
  });

  it('renders the Figma profile tab with live profile stats', async () => {
    rpcMock.mockResolvedValue({ data: profilePayload, error: null });

    render(
      <PlayerStatsModal open onOpenChange={vi.fn()} userId="user-1" />,
      { wrapper: createWrapper() },
    );

    expect(await screen.findByRole('dialog', { name: 'PROFILE VIEW' })).toBeInTheDocument();
    expect(rpcMock).toHaveBeenCalledWith('get_player_profile_view', { p_user_id: 'user-1' });
    expect(await screen.findByText('lightvsls')).toBeInTheDocument();
    expect(screen.getByText('Rank: #294')).toBeInTheDocument();
    expect(screen.getByText('TUC')).toBeInTheDocument();
    expect(screen.getByText('LVL.')).toBeInTheDocument();
    expect(screen.getByText('26')).toBeInTheDocument();
    expect(screen.getByText('STATS')).toBeInTheDocument();
    expect(screen.getByText('TOKENS')).toBeInTheDocument();
    expect(screen.getByText('HISTORY')).toBeInTheDocument();
    expect(screen.getByText('STREAK')).toBeInTheDocument();
    expect(screen.getByText('50.00%')).toBeInTheDocument();
    expect(screen.getByText('266')).toBeInTheDocument();
    expect(screen.getByText('+18.00')).toBeInTheDocument();
    expect(screen.getByText('50.32')).toBeInTheDocument();
    expect(screen.getAllByLabelText('History win')).toHaveLength(2);
    expect(document.body.querySelector('img[src="https://cdn.discordapp.com/avatars/user-1/avatar.png"]')).not.toBeNull();
  });

  it('copies the Epic username from the profile Epic icon', async () => {
    rpcMock.mockResolvedValue({ data: profilePayload, error: null });

    render(
      <PlayerStatsModal open onOpenChange={vi.fn()} userId="user-1" />,
      { wrapper: createWrapper() },
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Copy Epic username LOIS OPENDA 20' }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('LOIS OPENDA 20');
    });
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Epic username copied',
      description: 'LOIS OPENDA 20',
    }));
  });

  it('closes from Escape without adding a visible close control', async () => {
    const onOpenChange = vi.fn();
    rpcMock.mockResolvedValue({ data: profilePayload, error: null });

    render(
      <PlayerStatsModal open onOpenChange={onOpenChange} userId="user-1" />,
      { wrapper: createWrapper() },
    );

    await screen.findByRole('dialog', { name: 'PROFILE VIEW' });
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders neutral fallbacks when optional profile data is missing', async () => {
    rpcMock.mockResolvedValue({
      data: {
        ...profilePayload,
        profile: {
          user_id: 'user-2',
          username: 'Unknown',
          avatar_url: null,
          discord_avatar_url: null,
          epic_username: null,
          twitter_username: null,
          twitch_username: null,
          team_id: null,
          team_name: null,
          team_tag: null,
          total_xp: 0,
          level: 0,
          rank: null,
        },
        history: [],
      },
      error: null,
    });

    render(
      <PlayerStatsModal open onOpenChange={vi.fn()} userId="user-2" />,
      { wrapper: createWrapper() },
    );

    expect(await screen.findByRole('dialog', { name: 'PROFILE VIEW' })).toBeInTheDocument();
    expect(await screen.findByText('Rank: --')).toBeInTheDocument();
    expect(screen.getAllByText('--').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('History pending')).toHaveLength(5);
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LeaderboardSection } from '@/components/home/sections/LeaderboardSection';

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

vi.mock('@/components/player/PlayerStatsModal', () => ({
  PlayerStatsModal: ({ open, userId, rankOverride }: { open: boolean; userId: string; rankOverride?: number | null }) => (
    open ? <div data-testid="mock-player-profile">PROFILE VIEW {userId} RANK {rankOverride}</div> : null
  ),
}));

describe('LeaderboardSection', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('opens the player profile tab from a leaderboard avatar', async () => {
    rpcMock.mockResolvedValue({
      error: null,
      data: [
        {
          user_id: 'user-top-1',
          username: 'owener1',
          discord_avatar_url: 'https://cdn.discordapp.com/avatars/user-top-1/avatar.png',
          wins: 10,
          total_matches: 10,
          total_earnings: 2.4,
        },
        {
          user_id: 'user-top-2',
          username: 'marv',
          discord_avatar_url: 'https://cdn.discordapp.com/avatars/user-top-2/avatar.png',
          wins: 8,
          total_matches: 10,
          total_earnings: 1.5,
        },
        {
          user_id: 'user-top-3',
          username: 'cosmos',
          discord_avatar_url: 'https://cdn.discordapp.com/avatars/user-top-3/avatar.png',
          wins: 6,
          total_matches: 10,
          total_earnings: 1,
        },
      ],
    });

    render(<LeaderboardSection />);

    fireEvent.click(await screen.findByRole('button', { name: 'Open owener1 profile' }));

    expect(screen.getByTestId('mock-player-profile')).toHaveTextContent('PROFILE VIEW user-top-1 RANK 1');
    expect(rpcMock).toHaveBeenCalledWith('get_leaderboard', { p_limit: 3, p_offset: 0 });
  });

  it('opens the player profile tab from the second place avatar too', async () => {
    rpcMock.mockResolvedValue({
      error: null,
      data: [
        {
          user_id: 'user-top-1',
          username: 'owener1',
          discord_avatar_url: 'https://cdn.discordapp.com/avatars/user-top-1/avatar.png',
          wins: 10,
          total_matches: 10,
          total_earnings: 2.4,
        },
        {
          user_id: 'user-top-2',
          username: 'marv',
          discord_avatar_url: 'https://cdn.discordapp.com/avatars/user-top-2/avatar.png',
          wins: 8,
          total_matches: 10,
          total_earnings: 1.5,
        },
      ],
    });

    render(<LeaderboardSection />);

    fireEvent.click(await screen.findByRole('button', { name: 'Open marv profile' }));

    expect(screen.getByTestId('mock-player-profile')).toHaveTextContent('PROFILE VIEW user-top-2 RANK 2');
  });
});

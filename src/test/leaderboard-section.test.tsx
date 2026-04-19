import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LeaderboardSection } from '@/components/home/sections/LeaderboardSection';

const { fromMock, limitMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  limitMock: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: fromMock,
  },
}));

vi.mock('@/components/player/PlayerStatsModal', () => ({
  PlayerStatsModal: ({ open, userId, rankOverride }: { open: boolean; userId: string; rankOverride?: number | null }) => (
    open ? <div data-testid="mock-player-profile">PROFILE VIEW {userId} RANK {rankOverride}</div> : null
  ),
}));

function mockLeaderboardQuery() {
  fromMock.mockReturnValue({
    select: vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({
        limit: limitMock,
      }),
    }),
  });
}

describe('LeaderboardSection', () => {
  beforeEach(() => {
    fromMock.mockReset();
    limitMock.mockReset();
    mockLeaderboardQuery();
  });

  it('opens the player profile tab from a leaderboard avatar', async () => {
    limitMock.mockResolvedValue({
      error: null,
      data: [
        {
          user_id: 'user-top-1',
          username: 'owener1',
          discord_avatar_url: 'https://cdn.discordapp.com/avatars/user-top-1/avatar.png',
          wins: 10,
          total_matches: 10,
          weekly_earned: 2.4,
        },
        {
          user_id: 'user-top-2',
          username: 'marv',
          discord_avatar_url: 'https://cdn.discordapp.com/avatars/user-top-2/avatar.png',
          wins: 8,
          total_matches: 10,
          weekly_earned: 1.5,
        },
        {
          user_id: 'user-top-3',
          username: 'cosmos',
          discord_avatar_url: 'https://cdn.discordapp.com/avatars/user-top-3/avatar.png',
          wins: 6,
          total_matches: 10,
          weekly_earned: 1,
        },
      ],
    });

    render(<LeaderboardSection />);

    fireEvent.click(await screen.findByRole('button', { name: 'Open owener1 profile' }));

    expect(screen.getByTestId('mock-player-profile')).toHaveTextContent('PROFILE VIEW user-top-1 RANK 1');
  });

  it('opens the player profile tab from the second place avatar too', async () => {
    limitMock.mockResolvedValue({
      error: null,
      data: [
        {
          user_id: 'user-top-1',
          username: 'owener1',
          discord_avatar_url: 'https://cdn.discordapp.com/avatars/user-top-1/avatar.png',
          wins: 10,
          total_matches: 10,
          weekly_earned: 2.4,
        },
        {
          user_id: 'user-top-2',
          username: 'marv',
          discord_avatar_url: 'https://cdn.discordapp.com/avatars/user-top-2/avatar.png',
          wins: 8,
          total_matches: 10,
          weekly_earned: 1.5,
        },
      ],
    });

    render(<LeaderboardSection />);

    fireEvent.click(await screen.findByRole('button', { name: 'Open marv profile' }));

    expect(screen.getByTestId('mock-player-profile')).toHaveTextContent('PROFILE VIEW user-top-2 RANK 2');
  });
});

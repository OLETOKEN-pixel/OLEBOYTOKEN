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
  PlayerStatsModal: ({ open, userId }: { open: boolean; userId: string }) => (
    open ? <div data-testid="mock-player-profile">PROFILE VIEW {userId}</div> : null
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
      ],
    });

    render(<LeaderboardSection />);

    fireEvent.click(await screen.findByRole('button', { name: 'Open owener1 profile' }));

    expect(screen.getByTestId('mock-player-profile')).toHaveTextContent('PROFILE VIEW user-top-1');
  });
});

import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Leaderboard from '@/pages/Leaderboard';

const { isMobileState, rpcMock } = vi.hoisted(() => ({
  isMobileState: { value: false },
  rpcMock: vi.fn(),
}));

vi.mock('@/components/layout/PublicLayout', () => ({
  PublicLayout: ({ children }: { children: ReactNode }) => <div data-testid="public-layout">{children}</div>,
}));

vi.mock('@/components/home/sections/FooterSection', () => ({
  FooterSection: () => <footer data-testid="leaderboard-footer" />,
}));

vi.mock('@/components/player/PlayerStatsModal', () => ({
  PlayerStatsModal: ({ open, userId, rankOverride }: { open: boolean; userId: string; rankOverride?: number | null }) =>
    open ? <div data-testid="mock-player-profile">{`${userId}|${rankOverride}`}</div> : null,
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => isMobileState.value,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

type PlayerRow = {
  rank: number;
  user_id: string;
  username: string;
  avatar_url: string | null;
  discord_avatar_url: string | null;
  wins: number;
  total_matches: number;
  total_earnings: number;
  total_profit: number;
};

type TeamRow = {
  rank: number;
  team_id: string;
  team_name: string;
  team_tag: string;
  logo_url: string | null;
  owner_user_id: string;
  owner_username: string;
  owner_avatar_url: string | null;
  owner_discord_avatar_url: string | null;
  wins: number;
  total_matches: number;
  total_earnings: number;
};

function buildPlayerRows(count: number, baseRank = 1, prefix = 'Player'): PlayerRow[] {
  return Array.from({ length: count }, (_, index) => ({
    rank: baseRank + index,
    user_id: `user-${baseRank + index}`,
    username: `${prefix} ${baseRank + index}`,
    avatar_url: null,
    discord_avatar_url: `https://cdn.discordapp.com/avatars/user-${baseRank + index}/avatar.png`,
    wins: 20 - index,
    total_matches: 24 - index,
    total_earnings: 400 - index * 10,
    total_profit: 280 - index * 8,
  }));
}

const teamsRows: TeamRow[] = [
  {
    rank: 1,
    team_id: 'team-1',
    team_name: 'Redline',
    team_tag: 'RED',
    logo_url: 'https://logo.team/redline.png',
    owner_user_id: 'owner-1',
    owner_username: 'Captain Red',
    owner_avatar_url: null,
    owner_discord_avatar_url: 'https://cdn.discordapp.com/avatars/owner-1/avatar.png',
    wins: 12,
    total_matches: 18,
    total_earnings: 820,
  },
  {
    rank: 2,
    team_id: 'team-2',
    team_name: 'Skyline',
    team_tag: 'SKY',
    logo_url: null,
    owner_user_id: 'owner-2',
    owner_username: 'Captain Sky',
    owner_avatar_url: null,
    owner_discord_avatar_url: 'https://cdn.discordapp.com/avatars/owner-2/avatar.png',
    wins: 10,
    total_matches: 17,
    total_earnings: 700,
  },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>;
}

function renderPage(route = '/leaderboard') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Leaderboard />
      <LocationProbe />
    </MemoryRouter>,
    { wrapper: createWrapper() },
  );
}

describe('Leaderboard page', () => {
  beforeEach(() => {
    isMobileState.value = false;
    rpcMock.mockReset();
    rpcMock.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (name === 'get_player_leaderboard_metric') {
        if (args.p_metric === 'profit') {
          return { data: buildPlayerRows(2, 1, 'Profit'), error: null };
        }

        if (args.p_query === 'Alpha') {
          return {
            data: [
              {
                ...buildPlayerRows(1, 3, 'Alpha')[0],
                username: 'Alpha Prime',
              },
            ],
            error: null,
          };
        }

        if (args.p_offset === 10) {
          return { data: buildPlayerRows(2, 11, 'Page'), error: null };
        }

        return { data: buildPlayerRows(11), error: null };
      }

      if (name === 'get_team_leaderboard_earnings') {
        return { data: teamsRows, error: null };
      }

      return { data: [], error: null };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('falls back invalid tabs to earnings and calls the player leaderboard RPC', async () => {
    renderPage('/leaderboard?tab=nope');

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith('get_player_leaderboard_metric', {
        p_metric: 'earnings',
        p_limit: 11,
        p_offset: 0,
        p_query: null,
      });
    });

    expect(screen.getByTestId('leaderboard-page')).toHaveAttribute('data-leaderboard-tab', 'earnings');

    await waitFor(() => {
      expect(screen.getByText('Player 1')).toBeInTheDocument();
    });
  });

  it('switches tabs through the query param and refetches the matching metric', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Player 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'MOST PROFIT' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-probe')).toHaveTextContent('/leaderboard?tab=profit');
      expect(rpcMock).toHaveBeenCalledWith('get_player_leaderboard_metric', {
        p_metric: 'profit',
        p_limit: 11,
        p_offset: 0,
        p_query: null,
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Profit 1')).toBeInTheDocument();
    });
  });

  it('resets pagination when the debounced search changes', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Player 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'NEXT' }));

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith('get_player_leaderboard_metric', {
        p_metric: 'earnings',
        p_limit: 11,
        p_offset: 10,
        p_query: null,
      });
    });

    fireEvent.change(screen.getByLabelText('Search for a player'), {
      target: { value: 'Alpha' },
    });

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith('get_player_leaderboard_metric', {
        p_metric: 'earnings',
        p_limit: 11,
        p_offset: 0,
        p_query: 'Alpha',
      });
    });

    expect(screen.getByText('Alpha Prime')).toBeInTheDocument();
  });

  it('renders team leaderboard avatars with logo first, captain fallback second, and keeps local figma assets local', async () => {
    const { container } = renderPage('/leaderboard?tab=teams');

    await waitFor(() => {
      expect(screen.getByText('Redline')).toBeInTheDocument();
      expect(screen.getByText('Skyline')).toBeInTheDocument();
    });

    const teamLogo = screen.getByAltText('Redline') as HTMLImageElement;
    const captainFallback = screen.getByAltText('Skyline') as HTMLImageElement;
    const srcs = Array.from(container.querySelectorAll('img'))
      .map((image) => image.getAttribute('src'))
      .filter((src): src is string => Boolean(src));

    expect(teamLogo.src).toContain('https://logo.team/redline.png');
    expect(captainFallback.src).toContain('https://cdn.discordapp.com/avatars/owner-2/avatar.png');
    expect(srcs.some((src) => src.includes('https://www.figma.com/api/mcp/asset/'))).toBe(false);
  });

  it('renders the mobile leaderboard layout for all four tabs without losing the live data rows', async () => {
    isMobileState.value = true;

    renderPage('/leaderboard?tab=teams');

    await waitFor(() => {
      expect(screen.getByText('Redline')).toBeInTheDocument();
      expect(screen.getByText('Skyline')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'TEAMS EARNINGS' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'MOST WINS' })).toBeInTheDocument();
    expect(screen.getByLabelText('Search for a player')).toBeInTheDocument();
  });
});

import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MyMatches from '@/pages/MyMatches';
import type { Match } from '@/types';

const { authState, myMatchesState } = vi.hoisted(() => ({
  authState: {
    value: {
      user: { id: 'user-1' } as { id: string } | null,
      loading: false,
    },
  },
  myMatchesState: {
    value: {
      data: [] as Match[],
      isPending: false,
      isError: false,
      error: null as unknown,
    },
  },
}));

vi.mock('@/components/layout/PublicLayout', () => ({
  PublicLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/common/LoadingSpinner', () => ({
  LoadingPage: () => <div data-testid="loading-page" />,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState.value,
}));

vi.mock('@/hooks/useMatches', () => ({
  useMyMatches: () => myMatchesState.value,
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>;
}

function matchFactory(overrides: Partial<Match>): Match {
  return {
    id: 'match-1',
    creator_id: 'user-1',
    game: 'Fortnite',
    region: 'EU',
    platform: 'PC',
    mode: 'Box Fight',
    team_size: 1,
    first_to: 5,
    entry_fee: 0.75,
    is_private: false,
    private_code: null,
    status: 'open',
    expires_at: new Date(Date.now() + 600_000).toISOString(),
    started_at: null,
    finished_at: null,
    created_at: new Date().toISOString(),
    creator: {
      username: 'Host',
      discord_avatar_url: 'https://cdn.discordapp.com/avatars/host/discord-host.png',
      epic_username: 'HostEpic',
    },
    participants: [
      {
        id: 'participant-host',
        match_id: 'match-1',
        user_id: 'user-1',
        team_id: null,
        team_side: 'A',
        ready: false,
        ready_at: null,
        result_choice: null,
        result_at: null,
        status: 'joined',
        joined_at: new Date().toISOString(),
        profile: {
          username: 'Host',
          discord_avatar_url: 'https://cdn.discordapp.com/avatars/host/discord-host.png',
          epic_username: 'HostEpic',
        },
      },
    ],
    ...overrides,
  };
}

function renderMyMatches(initialEntry = '/my-matches') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/my-matches" element={<MyMatches />} />
        <Route path="/auth" element={<LocationProbe />} />
        <Route path="/matches/:id" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MyMatches page', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1024 });
    authState.value = {
      user: { id: 'user-1' },
      loading: false,
    };
    myMatchesState.value = {
      data: [
        matchFactory({ id: 'creator-open', creator_id: 'user-1', status: 'open' }),
        matchFactory({
          id: 'participant-completed',
          creator_id: 'user-2',
          status: 'completed',
          mode: 'Realistic',
          team_size: 2,
          participants: [
            {
              id: 'participant-user',
              match_id: 'participant-completed',
              user_id: 'user-1',
              team_id: null,
              team_side: 'B',
              ready: true,
              ready_at: null,
              result_choice: 'WIN',
              result_at: null,
              status: 'finished',
              joined_at: new Date().toISOString(),
              profile: {
                username: 'Tester',
                discord_avatar_url: 'https://cdn.discordapp.com/avatars/tester/discord-tester.png',
                epic_username: 'TesterEpic',
              },
            },
          ],
        }),
        matchFactory({ id: 'expired-match', creator_id: 'user-1', status: 'expired', mode: 'Zone Wars' }),
        matchFactory({ id: 'canceled-match', creator_id: 'user-1', status: 'canceled', mode: 'Box Fight' }),
      ],
      isPending: false,
      isError: false,
      error: null,
    };
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1024 });
  });

  it('renders the logged-in desktop Figma page with active user tokens first', () => {
    renderMyMatches();

    expect(screen.getByRole('heading', { name: 'MY MATCHES' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'ACTIVE' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'COMPLETED' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'ALL' })).toBeInTheDocument();
    expect(screen.getByText('1V1 BOX FIGHT')).toBeInTheDocument();
    expect(screen.queryByText('2V2 REALISTIC')).not.toBeInTheDocument();
  });

  it('redirects guests to auth with the my-matches next path', async () => {
    authState.value = {
      user: null,
      loading: false,
    };

    renderMyMatches();

    await waitFor(() => {
      expect(screen.getByTestId('location-probe')).toHaveTextContent('/auth?next=%2Fmy-matches');
    });
  });

  it('filters completed tokens including expired and canceled matches', () => {
    renderMyMatches();

    fireEvent.click(screen.getByRole('tab', { name: 'COMPLETED' }));

    const cards = screen.getAllByTestId('my-match-token-card');

    expect(cards).toHaveLength(3);
    expect(screen.getByText('2V2 REALISTIC')).toBeInTheDocument();
    expect(screen.getByText('1V1 ZONE WARS')).toBeInTheDocument();
    expect(screen.getAllByText('1V1 BOX FIGHT')).toHaveLength(1);
  });

  it('shows all user-related tokens and links View token to the match detail page', () => {
    renderMyMatches();

    fireEvent.click(screen.getByRole('tab', { name: 'ALL' }));
    fireEvent.click(screen.getAllByRole('link', { name: 'View token' })[0]);

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/matches/creator-open');
  });

  it('keeps the desktop card grid tight enough for four 300px cards per row', () => {
    renderMyMatches();

    const grid = screen.getByTestId('my-matches-grid');

    expect(grid.style.gridTemplateColumns).toBe('repeat(auto-fill, 300px)');
    expect(grid.style.columnGap).toBe('100px');
  });

  it('uses the creator avatar when the matching participant profile is partial', () => {
    myMatchesState.value = {
      data: [
        matchFactory({
          id: 'creator-open',
          creator_id: 'user-1',
          creator: {
            username: 'Host',
            discord_avatar_url: 'https://cdn.discordapp.com/avatars/host/discord-host.png',
            epic_username: 'HostEpic',
          },
          participants: [
            {
              id: 'participant-host',
              match_id: 'creator-open',
              user_id: 'user-1',
              team_id: null,
              team_side: 'A',
              ready: false,
              ready_at: null,
              result_choice: null,
              result_at: null,
              status: 'joined',
              joined_at: new Date().toISOString(),
              profile: {
                username: 'Host',
                avatar_url: null,
                discord_avatar_url: null,
                epic_username: 'HostEpic',
              },
            },
          ],
        }),
      ],
      isPending: false,
      isError: false,
      error: null,
    };

    renderMyMatches();

    expect(screen.getByRole('img', { name: 'Host' })).toHaveAttribute(
      'src',
      'https://cdn.discordapp.com/avatars/host/discord-host.png',
    );
  });

  it('uses the mobile layout below 768px without horizontal overflow wrappers', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 390 });

    const { container } = renderMyMatches();
    const page = screen.getByTestId('my-matches-page');
    const card = container.querySelector('[data-testid="my-match-token-card"]') as HTMLElement;

    expect(page.className).toContain('overflow-x-hidden');
    expect(card.style.width).toBe('100%');
    expect(card.style.maxWidth).toBe('300px');
  });
});

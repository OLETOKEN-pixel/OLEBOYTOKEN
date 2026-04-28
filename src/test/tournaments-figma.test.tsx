import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Tournaments from '@/pages/Tournaments';
import TournamentDetail from '@/pages/TournamentDetail';
import type { Tournament } from '@/types';

type EligibleTeamFixture = {
  id: string;
  name: string;
  tag: string;
  logo_url: string | null;
  owner_id: string;
  acceptedMemberCount: number;
  members: unknown[];
};

const {
  authState,
  listState,
  detailState,
  eligibleTeamsState,
  streamStatusState,
  createMutationMock,
  registerMutationMock,
  startMutationMock,
  readyMutationMock,
  cancelMutationMock,
  toastMock,
} = vi.hoisted(() => ({
  authState: {
    value: {
      user: { id: 'user-current' },
      profile: { user_id: 'user-current', username: 'Owner', role: 'user', twitch_username: null },
      wallet: { balance: 100 },
    },
  },
  listState: { data: [] as Tournament[], isLoading: false },
  detailState: { data: null as Tournament | null, isLoading: false },
  eligibleTeamsState: {
    eligibleTeams: [] as EligibleTeamFixture[],
    loading: false,
  },
  streamStatusState: {
    value: {
      data: null,
      isLoading: false,
      error: null,
    },
  },
  createMutationMock: { mutateAsync: vi.fn(), isPending: false },
  registerMutationMock: { mutateAsync: vi.fn(), isPending: false },
  startMutationMock: { mutateAsync: vi.fn(), isPending: false },
  readyMutationMock: { mutateAsync: vi.fn(), isPending: false },
  cancelMutationMock: { mutateAsync: vi.fn(), isPending: false },
  toastMock: vi.fn(),
}));

vi.mock('@/components/layout/PublicLayout', () => ({
  PublicLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/home/sections/FooterSection', () => ({
  FooterSection: () => <footer data-testid="tournament-footer" />,
}));

vi.mock('@/components/player/PlayerStatsModal', () => ({
  PlayerStatsModal: ({ open, userId }: { open: boolean; userId: string }) =>
    open ? <div data-testid="mock-player-stats-modal">{userId}</div> : null,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState.value,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock('@/hooks/useEligibleTeams', () => ({
  useEligibleTeams: () => ({
    allTeams: eligibleTeamsState.eligibleTeams,
    eligibleTeams: eligibleTeamsState.eligibleTeams,
    teamsWithSufficientBalance: eligibleTeamsState.eligibleTeams,
    loading: eligibleTeamsState.loading,
    refresh: vi.fn(),
  }),
}));

vi.mock('@/hooks/useTournamentStreamStatus', () => ({
  useTournamentStreamStatus: () => streamStatusState.value,
}));

vi.mock('@/hooks/useTournaments', () => ({
  useTournaments: () => listState,
  useTournament: () => detailState,
  useCreateTournament: () => createMutationMock,
  useRegisterTournament: () => registerMutationMock,
  useStartTournament: () => startMutationMock,
  useSetTournamentReady: () => readyMutationMock,
  useCancelTournament: () => cancelMutationMock,
  tournamentStatusLabel: (status: string) => status.toUpperCase(),
  isParticipating: (tournament: Tournament | null | undefined, userId: string | null | undefined) =>
    Boolean(
      tournament &&
        userId &&
        (tournament.participants ?? []).some(
          (participant) => participant.user_id === userId || participant.payer_user_id === userId,
        ),
    ),
}));

function tournamentFixture(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: 'tournament-1',
    name: 'Friday Box Fight',
    creator_id: 'creator-1',
    mode: 'Box Fight',
    team_size: 1,
    first_to: 5,
    region: 'EU',
    platform: 'All',
    max_participants: 250,
    entry_fee: 0,
    prize_pool_seed: 20,
    prize_pool_total: 40,
    duration_seconds: 3600,
    rules: 'No banned weapons. Ready up on time.',
    creator_is_admin: false,
    status: 'registering',
    scheduled_start_at: '2030-04-26T01:00:00.000Z',
    ready_up_deadline: null,
    started_at: null,
    ends_at: null,
    finalized_at: null,
    created_at: '2026-04-27T10:00:00.000Z',
    updated_at: '2026-04-27T10:00:00.000Z',
    creator: {
      user_id: 'creator-1',
      username: 'HostChannel',
      avatar_url: null,
      discord_avatar_url: null,
      twitch_username: null,
    },
    participants: [
      {
        id: 'participant-1',
        tournament_id: 'tournament-1',
        user_id: 'player-1',
        team_id: null,
        payer_user_id: 'player-1',
        paid_amount: 0,
        joined_at: '2026-04-27T10:00:00.000Z',
        ready: false,
        ready_at: null,
        matches_played: 4,
        wins: 3,
        losses: 1,
        points: 9,
        current_match_id: null,
        eliminated: false,
        user: { user_id: 'player-1', username: 'Lorem Ipsum', avatar_url: null, discord_avatar_url: null },
      },
    ],
    prize_positions: [
      { id: 'prize-1', tournament_id: 'tournament-1', position: 1, amount: 20 },
      { id: 'prize-2', tournament_id: 'tournament-1', position: 2, amount: 12 },
      { id: 'prize-3', tournament_id: 'tournament-1', position: 3, amount: 8 },
    ],
    participant_count: 1,
    ...overrides,
  };
}

function renderWithRouter(ui: ReactNode, initialEntries = ['/tournaments']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderDetail() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/tournaments/tournament-1']}>
        <Routes>
          <Route path="/tournaments/:id" element={<TournamentDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const scrollIntoViewMock = vi.fn();

describe('Tournaments Figma rebuild', () => {
  beforeEach(() => {
    scrollIntoViewMock.mockReset();
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      value: scrollIntoViewMock,
      configurable: true,
    });
    authState.value = {
      user: { id: 'user-current' },
      profile: { user_id: 'user-current', username: 'Owner', role: 'user', twitch_username: null },
      wallet: { balance: 100 },
    };
    listState.data = [tournamentFixture()];
    listState.isLoading = false;
    detailState.data = tournamentFixture();
    detailState.isLoading = false;
    streamStatusState.value = {
      data: null,
      isLoading: false,
      error: null,
    };
    eligibleTeamsState.eligibleTeams = [];
    eligibleTeamsState.loading = false;
    createMutationMock.mutateAsync.mockReset();
    createMutationMock.mutateAsync.mockResolvedValue('new-tournament');
    createMutationMock.isPending = false;
    registerMutationMock.mutateAsync.mockReset();
    registerMutationMock.mutateAsync.mockResolvedValue(undefined);
    registerMutationMock.isPending = false;
    startMutationMock.mutateAsync.mockReset();
    readyMutationMock.mutateAsync.mockReset();
    cancelMutationMock.mutateAsync.mockReset();
    toastMock.mockReset();
  });

  it('renders the tournaments list with the Figma shell, assets and card geometry', () => {
    renderWithRouter(<Tournaments />);

    expect(screen.getByText('TOURNAMENTS')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Live Tournaments' })).toHaveClass('w-[289px]');
    expect(screen.getByRole('button', { name: 'Past Tournamets' })).toHaveClass('w-[293px]');
    expect(document.querySelector('img[src="/figma-assets/tournaments/triangles.svg"]')).not.toBeNull();
    expect(document.querySelector('img[src="/figma-assets/tournaments/outline.svg"]')).not.toBeNull();
    expect(document.querySelector('img[src="/figma-assets/tournaments/bottom-neon.png"]')).not.toBeNull();

    const card = screen.getByTestId('tournament-card');
    expect(card).toHaveClass('h-[400px]');
    expect(card).toHaveClass('w-[300px]');
    expect(document.querySelector('img[src="/figma-assets/tournaments/card-divider.svg"]')).not.toBeNull();
  });

  it('opens the Figma create modal and keeps validation on the create RPC flow', async () => {
    renderWithRouter(<Tournaments />);

    fireEvent.click(screen.getByRole('button', { name: /create/i }));
    const dialog = screen.getByRole('dialog', { name: 'SET YOUR ARENA' });
    expect(dialog).toHaveClass('rounded-[18px]');
    expect(dialog).toHaveClass('border-[#ff1654]');

    const submit = within(dialog).getByRole('button', { name: /create tournament/i });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('e.g. Friday Night Box Fight'), {
      target: { value: 'Night Cup' },
    });
    expect(submit).not.toBeDisabled();

    fireEvent.click(submit);
    await waitFor(() => {
      expect(createMutationMock.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Night Cup',
          mode: 'Box Fight',
          team_size: 1,
          prize_pool: 20,
        }),
      );
    });
  });

  it('renders tournament detail with the original detail blocks and local podium assets', () => {
    renderDetail();

    expect(screen.getByTestId('tournament-detail-header')).toBeInTheDocument();
    expect(screen.getByText('1V1 BOXFIGHT')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy map code 2640-2394-7508' })).toBeInTheDocument();
    expect(within(screen.getByTestId('tournament-detail-header')).queryByText('1V1 BOXFIGHT')).toBeNull();
    expect(screen.getByText('Registrasion Progress')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rules/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /leaderboard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /prize/i })).toBeInTheDocument();
    expect(screen.getByTestId('tournament-prize-podium')).toBeInTheDocument();
    expect(document.querySelector('img[src="/figma-assets/tournaments/detail-copy-icon.svg"]')).not.toBeNull();
    expect(document.querySelector('img[src="/figma-assets/tournaments/prize-crown.svg"]')).not.toBeNull();
    expect(document.querySelector('img[src="/figma-assets/tournaments/rank-star-1.svg"]')).not.toBeNull();
    expect(document.querySelector('img[src="/figma-assets/tournaments/rank-star-2.svg"]')).not.toBeNull();
    expect(document.querySelector('img[src="/figma-assets/tournaments/rank-star-3.svg"]')).not.toBeNull();
    expect(document.querySelector('img[src="/figma-assets/tournaments/detail-neon.png"]')).not.toBeNull();
    expect(screen.getByTestId('tournament-teams-table')).toBeInTheDocument();
    expect(screen.getByTestId('tournament-footer')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /player/i }));
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('keeps the compact detail layout when the creator has no Twitch linked', () => {
    renderDetail();

    expect(screen.queryByTestId('tournament-twitch-panel')).toBeNull();
    expect(screen.queryByTestId('tournament-twitch-chat-frame')).toBeNull();
  });

  it('renders the Twitch live and chat panels together for creators with Twitch and shows live viewers', () => {
    detailState.data = tournamentFixture({
      creator: {
        user_id: 'creator-1',
        username: 'HostChannel',
        avatar_url: null,
        discord_avatar_url: null,
        twitch_username: 'host_channel',
      },
    });
    streamStatusState.value = {
      data: {
        twitchUsername: 'host_channel',
        displayName: 'HostChannel',
        channelUrl: 'https://www.twitch.tv/host_channel',
        isLive: true,
        viewerCount: 311,
        thumbnailUrl: 'https://example.com/live.jpg',
        offlineImageUrl: 'https://example.com/offline.jpg',
        profileImageUrl: 'https://example.com/profile.jpg',
      },
      isLoading: false,
      error: null,
    };

    renderDetail();

    expect(screen.getByTestId('tournament-twitch-panel')).toBeInTheDocument();
    expect(screen.getByTestId('tournament-detail-header')).toHaveClass('h-[720px]');
    expect(screen.getByTitle('HostChannel Twitch player')).toBeInTheDocument();
    expect(screen.getByTitle('HostChannel Twitch chat')).toBeInTheDocument();
    expect(screen.getByText('311 viewers')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'LIVE' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'CHAT' })).toBeNull();
    expect(screen.getByRole('button', { name: /player/i })).toBeInTheDocument();
  });

  it('keeps the Twitch player mounted without viewer count when the creator is offline', () => {
    detailState.data = tournamentFixture({
      creator: {
        user_id: 'creator-1',
        username: 'HostChannel',
        avatar_url: null,
        discord_avatar_url: null,
        twitch_username: 'host_channel',
      },
    });
    streamStatusState.value = {
      data: {
        twitchUsername: 'host_channel',
        displayName: 'HostChannel',
        channelUrl: 'https://www.twitch.tv/host_channel',
        isLive: false,
        viewerCount: null,
        thumbnailUrl: null,
        offlineImageUrl: 'https://example.com/offline.jpg',
        profileImageUrl: 'https://example.com/profile.jpg',
      },
      isLoading: false,
      error: null,
    };

    renderDetail();

    expect(screen.getByText('OFFLINE')).toBeInTheDocument();
    expect(screen.getByTestId('tournament-twitch-live-frame')).toBeInTheDocument();
    expect(screen.getByTestId('tournament-twitch-chat-frame')).toBeInTheDocument();
    expect(screen.queryByText(/viewers/i)).toBeNull();
  });

  it('keeps the official Twitch player mounted even when stream status is unavailable', () => {
    detailState.data = tournamentFixture({
      creator: {
        user_id: 'creator-1',
        username: 'HostChannel',
        avatar_url: null,
        discord_avatar_url: null,
        twitch_username: 'host_channel',
      },
    });
    streamStatusState.value = {
      data: null,
      isLoading: false,
      error: new Error('status unavailable'),
    };

    renderDetail();

    expect(screen.getByText('OFFLINE')).toBeInTheDocument();
    expect(screen.getByTestId('tournament-twitch-live-frame')).toBeInTheDocument();
    expect(screen.getByTestId('tournament-twitch-chat-frame')).toBeInTheDocument();
  });

  it('renders the Twitch chat iframe even when the viewer has not linked Twitch on the site', () => {
    authState.value = {
      ...authState.value,
      profile: {
        ...authState.value.profile,
        twitch_username: null,
      },
    };
    detailState.data = tournamentFixture({
      creator: {
        user_id: 'creator-1',
        username: 'HostChannel',
        avatar_url: null,
        discord_avatar_url: null,
        twitch_username: 'host_channel',
      },
    });
    streamStatusState.value = {
      data: {
        twitchUsername: 'host_channel',
        displayName: 'HostChannel',
        channelUrl: 'https://www.twitch.tv/host_channel',
        isLive: false,
        viewerCount: null,
        thumbnailUrl: null,
        offlineImageUrl: 'https://example.com/offline.jpg',
        profileImageUrl: 'https://example.com/profile.jpg',
      },
      isLoading: false,
      error: null,
    };

    renderDetail();

    expect(screen.getByTestId('tournament-twitch-chat-frame')).toBeInTheDocument();
  });

  it('renders the Twitch chat iframe for viewers who linked Twitch', () => {
    authState.value = {
      ...authState.value,
      profile: {
        ...authState.value.profile,
        twitch_username: 'viewer_channel',
      },
    };
    detailState.data = tournamentFixture({
      creator: {
        user_id: 'creator-1',
        username: 'HostChannel',
        avatar_url: null,
        discord_avatar_url: null,
        twitch_username: 'host_channel',
      },
    });
    streamStatusState.value = {
      data: {
        twitchUsername: 'host_channel',
        displayName: 'HostChannel',
        channelUrl: 'https://www.twitch.tv/host_channel',
        isLive: false,
        viewerCount: null,
        thumbnailUrl: null,
        offlineImageUrl: 'https://example.com/offline.jpg',
        profileImageUrl: 'https://example.com/profile.jpg',
      },
      isLoading: false,
      error: null,
    };

    renderDetail();

    expect(screen.getByTestId('tournament-twitch-chat-frame')).toBeInTheDocument();
  });

  it('opens the rules overlay from the Figma rules button', () => {
    renderDetail();

    fireEvent.click(screen.getByRole('button', { name: /rules/i }));
    const dialog = screen.getByRole('dialog', { name: '1V1 BOXFIGHT' });

    expect(within(dialog).getByText('No banned weapons. Ready up on time.')).toBeInTheDocument();
  });

  it('registers team tournaments through the Figma team selection overlay', async () => {
    detailState.data = tournamentFixture({
      team_size: 2,
      participants: [],
      participant_count: 0,
    });
    eligibleTeamsState.eligibleTeams = [
      {
        id: 'team-red',
        name: 'Redline',
        tag: 'RED',
        logo_url: null,
        owner_id: 'user-current',
        acceptedMemberCount: 2,
        members: [],
      },
    ];

    renderDetail();

    fireEvent.click(screen.getByRole('button', { name: 'Register' }));
    const dialog = screen.getByRole('dialog', { name: 'SELECT 2V2 TEAM' });
    fireEvent.click(within(dialog).getByRole('button', { name: /redline/i }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      expect(registerMutationMock.mutateAsync).toHaveBeenCalledWith({
        tournament_id: 'tournament-1',
        team_id: 'team-red',
      });
    });
  });
});

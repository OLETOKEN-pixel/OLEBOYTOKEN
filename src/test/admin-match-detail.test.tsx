import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminMatchDetail from '@/pages/AdminMatchDetail';
import type { Match, MatchParticipant } from '@/types';

const { adminState, matchState, toastMock, fromMock, rpcMock } = vi.hoisted(() => ({
  adminState: {
    value: {
      user: { id: 'admin-1' } as { id: string } | null,
      isAdmin: true,
      isLoading: false,
    },
  },
  matchState: {
    value: {
      data: null as Match | null,
      isPending: false,
      error: null as unknown,
      refetch: vi.fn(),
    },
  },
  toastMock: vi.fn(),
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock('@/hooks/useAdminStatus', () => ({
  useAdminStatus: () => adminState.value,
}));

vi.mock('@/hooks/useMatches', () => ({
  useMatchDetail: () => matchState.value,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock('@/components/layout/NavbarFigmaLoggedIn', () => ({
  NavbarFigmaLoggedIn: () => <div data-testid="figma-navbar">Navbar</div>,
}));

vi.mock('@/components/matches/MatchChat', () => ({
  MatchChat: ({
    variant,
    isAdmin,
    matchId,
  }: {
    variant?: string;
    isAdmin?: boolean;
    matchId: string;
  }) => (
    <div
      data-testid="mock-match-chat"
      data-variant={variant}
      data-is-admin={isAdmin ? 'true' : 'false'}
      data-match-id={matchId}
    />
  ),
}));

vi.mock('@/components/matches/ProofSection', () => ({
  ProofSection: ({ matchId }: { matchId: string }) => <div data-testid="mock-proof-section">{matchId}</div>,
}));

vi.mock('@/components/player/PlayerStatsModal', () => ({
  PlayerStatsModal: () => null,
}));

vi.mock('@/components/matches/MatchRulesOverlay', () => ({
  MatchRulesOverlay: () => null,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
  },
}));

function participantFactory(overrides: Partial<MatchParticipant>): MatchParticipant {
  return {
    id: 'participant-a-1',
    match_id: 'match-admin',
    user_id: 'user-a-1',
    team_id: null,
    team_side: 'A',
    ready: true,
    ready_at: null,
    result_choice: null,
    result_at: null,
    status: 'joined',
    joined_at: '2026-04-26T10:00:00.000Z',
    profile: {
      username: 'Host',
      discord_avatar_url: 'https://cdn.discordapp.com/avatars/host/avatar.png',
      epic_username: 'HostEpic',
    },
    ...overrides,
  };
}

function buildMatch(): Match {
  return {
    id: 'match-admin',
    creator_id: 'user-a-1',
    game: 'Fortnite',
    region: 'EU',
    platform: 'All',
    mode: 'Box Fight',
    team_size: 2,
    first_to: 5,
    entry_fee: 0.5,
    is_private: false,
    private_code: '1111 - 2222 - 333',
    status: 'ready_check',
    expires_at: null,
    started_at: null,
    finished_at: null,
    created_at: new Date().toISOString(),
    creator: {
      username: 'Host',
      discord_avatar_url: 'https://cdn.discordapp.com/avatars/host/avatar.png',
      epic_username: 'HostEpic',
    },
    participants: [
      participantFactory({
        id: 'participant-a-1',
        user_id: 'user-a-1',
        team_side: 'A',
      }),
      participantFactory({
        id: 'participant-b-1',
        user_id: 'user-b-1',
        team_side: 'B',
        profile: {
          username: 'Opponent',
          discord_avatar_url: 'https://cdn.discordapp.com/avatars/opponent/avatar.png',
          epic_username: 'OpponentEpic',
        },
      }),
    ],
  } as Match;
}

function renderAdminMatchDetail() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/matches/match-admin']}>
        <Routes>
          <Route path="/admin/matches/:id" element={<AdminMatchDetail />} />
          <Route path="/admin/matches" element={<div>Matches workspace</div>} />
          <Route path="/" element={<div>Home</div>} />
          <Route path="/auth" element={<div>Auth</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminMatchDetail', () => {
  beforeEach(() => {
    toastMock.mockReset();
    rpcMock.mockReset();
    matchState.value = {
      data: buildMatch(),
      isPending: false,
      error: null,
      refetch: vi.fn(),
    };

    fromMock.mockImplementation((table: string) => {
      if (table === 'transactions') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: [], error: null }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });
  });

  it('renders the shared public match scene with Figma-ready admin chat', async () => {
    renderAdminMatchDetail();

    expect(await screen.findByTestId('match-ready-lobby')).toBeInTheDocument();
    expect(screen.getByTestId('mock-match-chat')).toHaveAttribute('data-variant', 'figmaReady');
    expect(screen.getByTestId('mock-match-chat')).toHaveAttribute('data-is-admin', 'true');
    expect(screen.getByRole('button', { name: /admin panel/i })).toBeInTheDocument();
    expect(screen.queryByText('MATCH CONTROL')).not.toBeInTheDocument();
  });

  it('opens the admin overlay with moderation, proofs, and finance tabs', async () => {
    matchState.value = {
      ...matchState.value,
      data: {
        ...matchState.value.data!,
        status: 'disputed',
      },
    };

    renderAdminMatchDetail();

    fireEvent.click(await screen.findByRole('button', { name: /admin panel/i }));

    expect(screen.getByText('MATCH CONTROL')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Moderation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Proofs' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finance' })).toBeInTheDocument();
    expect(screen.getByText('Resolve match')).toBeInTheDocument();
  });
});

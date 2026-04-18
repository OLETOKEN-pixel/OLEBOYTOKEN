import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMatchDetail } from '@/hooks/useMatches';
import type { Match, MatchParticipant } from '@/types';

const {
  channelBuilder,
  fromMock,
  profilesInMock,
  matchMaybeSingleMock,
  rpcMock,
  unsubscribeMock,
} = vi.hoisted(() => {
  const unsubscribe = vi.fn();
  const channel = {
    on: vi.fn(),
    subscribe: vi.fn(() => ({ unsubscribe })),
  };
  channel.on.mockReturnValue(channel);

  return {
    channelBuilder: channel,
    fromMock: vi.fn(),
    profilesInMock: vi.fn(),
    matchMaybeSingleMock: vi.fn(),
    rpcMock: vi.fn(),
    unsubscribeMock: unsubscribe,
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-b-1' } }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
    channel: vi.fn(() => channelBuilder),
  },
}));

function participantFactory(overrides: Partial<MatchParticipant>): MatchParticipant {
  return {
    id: 'participant-1',
    match_id: 'match-1',
    user_id: 'user-a-1',
    team_id: null,
    team_side: 'A',
    ready: true,
    ready_at: '2026-04-18T10:05:00.000Z',
    result_choice: null,
    result_at: null,
    status: 'playing',
    joined_at: '2026-04-18T10:00:00.000Z',
    ...overrides,
  };
}

function matchFactory(overrides: Partial<Match>): Match {
  return {
    id: 'match-1',
    creator_id: 'user-a-1',
    game: 'Fortnite',
    region: 'EU',
    platform: 'PC',
    mode: 'Box Fight',
    team_size: 1,
    first_to: 5,
    entry_fee: 0.5,
    is_private: false,
    private_code: null,
    status: 'in_progress',
    expires_at: null,
    started_at: '2026-04-18T10:06:00.000Z',
    finished_at: null,
    created_at: '2026-04-18T10:00:00.000Z',
    participants: [],
    ...overrides,
  };
}

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

describe('useMatchDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channelBuilder.on.mockReturnValue(channelBuilder);
    channelBuilder.subscribe.mockReturnValue({ unsubscribe: unsubscribeMock });

    fromMock.mockImplementation((table: string) => {
      if (table === 'matches') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: matchMaybeSingleMock,
            })),
          })),
        };
      }

      if (table === 'profiles') {
        return {
          select: vi.fn(() => ({
            in: profilesInMock,
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    profilesInMock.mockResolvedValue({ data: [], error: null });
  });

  it('hydrates participant profiles from the secure match details RPC after start', async () => {
    matchMaybeSingleMock.mockResolvedValue({
      data: matchFactory({
        participants: [
          participantFactory({
            id: 'participant-a-1',
            user_id: 'user-a-1',
            team_side: 'A',
            profile: undefined,
          }),
          participantFactory({
            id: 'participant-b-1',
            user_id: 'user-b-1',
            team_side: 'B',
            profile: {
              username: 'marv',
              discord_avatar_url: 'https://cdn.discordapp.com/avatars/marv/avatar.png',
              epic_username: 'Marv17_',
            },
          }),
        ],
      }),
      error: null,
    });

    rpcMock.mockResolvedValue({
      data: {
        success: true,
        match: matchFactory({
          participants: [
            participantFactory({
              id: 'participant-a-1',
              user_id: 'user-a-1',
              team_side: 'A',
              profile: {
                username: 'Opponent',
                discord_avatar_url: 'https://cdn.discordapp.com/avatars/opponent/avatar.png',
                epic_username: 'OpponentEpic',
              },
            }),
            participantFactory({
              id: 'participant-b-1',
              user_id: 'user-b-1',
              team_side: 'B',
              profile: {
                username: 'marv',
                discord_avatar_url: 'https://cdn.discordapp.com/avatars/marv/avatar.png',
                epic_username: 'Marv17_',
              },
            }),
          ],
        }),
      },
      error: null,
    });

    const { result } = renderHook(() => useMatchDetail('match-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const opponent = result.current.data?.participants?.find((participant) => participant.user_id === 'user-a-1');
    expect(opponent?.profile?.username).toBe('Opponent');
    expect(opponent?.profile?.discord_avatar_url).toBe('https://cdn.discordapp.com/avatars/opponent/avatar.png');
    expect(rpcMock).toHaveBeenCalledWith('get_match_details', { p_match_id: 'match-1' });
  });
});

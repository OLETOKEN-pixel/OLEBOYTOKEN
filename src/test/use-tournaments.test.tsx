import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTournament, useTournaments } from '@/hooks/useTournaments';
import type { Tournament } from '@/types';

const {
  channelBuilder,
  fromMock,
  profilesInMock,
  removeChannelMock,
  rpcMock,
} = vi.hoisted(() => {
  const channel = {
    on: vi.fn(),
    subscribe: vi.fn(),
  };
  channel.on.mockReturnValue(channel);
  channel.subscribe.mockReturnValue(channel);

  return {
    channelBuilder: channel,
    fromMock: vi.fn(),
    profilesInMock: vi.fn(),
    removeChannelMock: vi.fn(),
    rpcMock: vi.fn(),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: fromMock,
    channel: vi.fn(() => channelBuilder),
    removeChannel: removeChannelMock,
    rpc: rpcMock,
  },
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
    max_participants: 128,
    entry_fee: 0,
    prize_pool_seed: 10,
    prize_pool_total: 20,
    duration_seconds: 3600,
    rules: null,
    creator_is_admin: false,
    status: 'registering',
    scheduled_start_at: null,
    ready_up_deadline: null,
    started_at: null,
    ends_at: null,
    finalized_at: null,
    created_at: '2026-04-28T10:00:00.000Z',
    updated_at: '2026-04-28T10:00:00.000Z',
    creator: {
      user_id: 'creator-1',
      username: 'HostChannel',
      avatar_url: null,
      discord_avatar_url: null,
    },
    participants: [],
    prize_positions: [],
    participant_count: 0,
    ...overrides,
  };
}

describe('useTournaments fallback compatibility', () => {
  const legacyProfilesViewError = {
    code: 'PGRST204',
    message: "Could not find the 'twitch_username' column of 'profiles_public' in the schema cache",
    details: null,
    hint: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    channelBuilder.on.mockReturnValue(channelBuilder);
    channelBuilder.subscribe.mockReturnValue(channelBuilder);
    profilesInMock.mockResolvedValue({
      data: [{ user_id: 'creator-1', twitch_username: 'host_channel' }],
      error: null,
    });
    rpcMock.mockResolvedValue({
      data: {
        success: true,
        profile: {
          user_id: 'creator-1',
          twitch_username: 'host_channel',
        },
      },
      error: null,
    });
  });

  it('falls back to the legacy detail select when profiles_public lacks twitch_username', async () => {
    const selections: string[] = [];
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    fromMock.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn(() => ({
            in: profilesInMock,
          })),
        };
      }

      if (table !== 'tournaments') throw new Error(`Unexpected table ${table}`);

      return {
        select: vi.fn((selection: string) => {
          selections.push(selection);

          return {
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() =>
                Promise.resolve(
                  selection.includes('twitch_username')
                    ? { data: null, error: legacyProfilesViewError }
                    : { data: tournamentFixture(), error: null },
                ),
              ),
            })),
          };
        }),
      };
    });

    const { result } = renderHook(() => useTournament('tournament-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(selections).toHaveLength(2);
    expect(selections[0]).toContain('twitch_username');
    expect(selections[1]).not.toContain('twitch_username');
    expect(result.current.data?.id).toBe('tournament-1');
    expect(result.current.data?.creator?.twitch_username).toBe('host_channel');
    expect(profilesInMock).toHaveBeenCalledWith('user_id', ['creator-1']);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);

    consoleWarnSpy.mockRestore();
  });

  it('falls back to the legacy list select when profiles_public lacks twitch_username', async () => {
    const selections: string[] = [];
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    fromMock.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn(() => ({
            in: profilesInMock,
          })),
        };
      }

      if (table !== 'tournaments') throw new Error(`Unexpected table ${table}`);

      return {
        select: vi.fn((selection: string) => {
          selections.push(selection);

          return {
            order: vi.fn(() => ({
              in: vi.fn(() =>
                Promise.resolve(
                  selection.includes('twitch_username')
                    ? { data: null, error: legacyProfilesViewError }
                    : { data: [tournamentFixture()], error: null },
                ),
              ),
            })),
          };
        }),
      };
    });

    const { result } = renderHook(() => useTournaments('live'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(selections).toHaveLength(2);
    expect(selections[0]).toContain('twitch_username');
    expect(selections[1]).not.toContain('twitch_username');
    expect(result.current.data?.map((tournament) => tournament.id)).toEqual(['tournament-1']);
    expect(result.current.data?.[0]?.creator?.twitch_username).toBe('host_channel');
    expect(profilesInMock).toHaveBeenCalledWith('user_id', ['creator-1']);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);

    consoleWarnSpy.mockRestore();
  });

  it('derives the live participant count for tournament cards from embedded tournament participants', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn(() => ({
            in: profilesInMock,
          })),
        };
      }

      if (table !== 'tournaments') throw new Error(`Unexpected table ${table}`);

      return {
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            in: vi.fn(() =>
              Promise.resolve({
                data: [
                  tournamentFixture({
                    participant_count: 0,
                    participants: [{ id: 'p-1' }, { id: 'p-2' }] as Tournament['participants'],
                  }),
                ],
                error: null,
              }),
            ),
          })),
        })),
      };
    });

    const { result } = renderHook(() => useTournaments('live'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.[0]?.participant_count).toBe(2);
    expect(result.current.data?.[0]?.participants).toHaveLength(2);
  });

  it('hydrates detail creator twitch username from player profile rpc when direct profile access is blocked', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() =>
              Promise.resolve({
                data: null,
                error: {
                  code: '42501',
                  message: 'permission denied for table profiles',
                },
              }),
            ),
          })),
        };
      }

      if (table !== 'tournaments') throw new Error(`Unexpected table ${table}`);

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() =>
              Promise.resolve({
                data: tournamentFixture(),
                error: null,
              }),
            ),
          })),
        })),
      };
    });

    const { result } = renderHook(() => useTournament('tournament-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(rpcMock).toHaveBeenCalledWith('get_player_profile_view', { p_user_id: 'creator-1' });
    expect(result.current.data?.creator?.twitch_username).toBe('host_channel');
  });
});

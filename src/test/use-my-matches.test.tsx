import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMyMatches } from '@/hooks/useMatches';
import type { Match } from '@/types';

const {
  channelBuilder,
  creatorEqMock,
  fromMock,
  matchesInMock,
  participantEqMock,
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
    creatorEqMock: vi.fn(),
    fromMock: vi.fn(),
    matchesInMock: vi.fn(),
    participantEqMock: vi.fn(),
    unsubscribeMock: unsubscribe,
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: fromMock,
    channel: vi.fn(() => channelBuilder),
  },
}));

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
    entry_fee: 0.5,
    is_private: false,
    private_code: null,
    status: 'open',
    expires_at: new Date(Date.now() + 600_000).toISOString(),
    started_at: null,
    finished_at: null,
    created_at: new Date().toISOString(),
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

describe('useMyMatches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channelBuilder.on.mockReturnValue(channelBuilder);
    channelBuilder.subscribe.mockReturnValue({ unsubscribe: unsubscribeMock });
    participantEqMock.mockResolvedValue({
      data: [
        { match_id: 'participant-completed' },
        { match_id: 'creator-open' },
      ],
      error: null,
    });
    creatorEqMock.mockResolvedValue({
      data: [
        matchFactory({
          id: 'creator-open',
          creator_id: 'user-1',
          status: 'open',
          created_at: '2026-04-12T10:00:00.000Z',
          expires_at: '2026-04-12T10:20:00.000Z',
        }),
      ],
      error: null,
    });
    matchesInMock.mockResolvedValue({
      data: [
        matchFactory({
          id: 'participant-completed',
          creator_id: 'user-2',
          status: 'completed',
          created_at: '2026-04-12T09:00:00.000Z',
          expires_at: '2026-04-12T09:20:00.000Z',
        }),
      ],
      error: null,
    });
    fromMock.mockImplementation((table: string) => {
      if (table === 'match_participants') {
        return {
          select: vi.fn(() => ({
            eq: participantEqMock,
          })),
        };
      }

      return {
        select: vi.fn(() => ({
          eq: creatorEqMock,
          in: matchesInMock,
        })),
      };
    });
  });

  it('returns creator open matches and participant matches without excluding open tokens', async () => {
    const { result } = renderHook(() => useMyMatches(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.map((match) => match.id)).toEqual([
      'creator-open',
      'participant-completed',
    ]);
    expect(creatorEqMock).toHaveBeenCalledWith('creator_id', 'user-1');
    expect(matchesInMock).toHaveBeenCalledWith('id', ['participant-completed', 'creator-open']);
  });
});

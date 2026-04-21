import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Highlights from '@/pages/Highlights';

const { fromMock, insertMock, selectAfterInsertMock, singleMock, castVoteMock, removeVoteMock, switchVoteMock, getVoteStateMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  insertMock: vi.fn(),
  selectAfterInsertMock: vi.fn(),
  singleMock: vi.fn(),
  castVoteMock: vi.fn(),
  removeVoteMock: vi.fn(),
  switchVoteMock: vi.fn(),
  getVoteStateMock: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: fromMock,
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    profile: {
      username: 'OlePlayer',
      discord_display_name: 'Ole Player',
      discord_avatar_url: 'https://cdn.discordapp.com/avatars/1/avatar.png',
      avatar_url: null,
    },
  }),
}));

vi.mock('@/components/layout/PublicLayout', () => ({
  PublicLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/hooks/useHighlightVotes', () => ({
  useHighlightVotes: () => ({
    voteCounts: { 'highlight-1': 2 },
    isVoting: false,
    getVoteState: getVoteStateMock,
    castVote: castVoteMock,
    removeVote: removeVoteMock,
    switchVote: switchVoteMock,
  }),
}));

const highlightRow = {
  id: 'highlight-1',
  user_id: null,
  youtube_url: 'https://youtu.be/HxRTrHyWB0Y',
  youtube_video_id: 'HxRTrHyWB0Y',
  title: 'IL MIGLIOR HIGHLIGHTS...',
  created_at: '2026-04-21T10:00:00.000Z',
  updated_at: '2026-04-21T10:00:00.000Z',
  is_weekly_winner: false,
  winner_week: null,
  is_curated: true,
  base_vote_count: 655,
  author_name: 'Piz',
  author_avatar_url: null,
  thumbnail_url: '/showreel/highlight-video-1.png',
  sort_order: 10,
};

describe('Highlights page', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getVoteStateMock.mockReturnValue('NOT_VOTED');
    fromMock.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [highlightRow], error: null }),
      insert: insertMock,
    });
    selectAfterInsertMock.mockReturnValue({ single: singleMock });
    insertMock.mockReturnValue({ select: selectAfterInsertMock });
    singleMock.mockResolvedValue({
      data: { ...highlightRow, id: 'new-highlight', title: 'Long YouTube title for preview' },
      error: null,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: 'A very very long YouTube title for preview cards',
        thumbnail_url: 'https://i.ytimg.com/vi/HxRTrHyWB0Y/hqdefault.jpg',
      }),
    }));
  });

  it('keeps curated base votes while adding realtime votes', async () => {
    render(<Highlights />);

    expect(await screen.findByText('657')).toBeInTheDocument();
  });

  it('opens upload with no preview, then renders YouTube preview and publishes base zero', async () => {
    render(<Highlights />);

    fireEvent.click(await screen.findByRole('button', { name: /upload/i }));
    expect(screen.getByText('Paste a YouTube link to create the preview.')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('https://youtu.be/...'), {
      target: { value: 'https://youtu.be/HxRTrHyWB0Y' },
    });

    expect(await screen.findByText('A very very long YouTube tit...')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /publish/i }));

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
        base_vote_count: 0,
        is_curated: false,
        youtube_video_id: 'HxRTrHyWB0Y',
        title: 'A very very long YouTube tit...',
      }));
    });
  });

  it('removes a vote from the currently voted highlight', async () => {
    getVoteStateMock.mockReturnValue('VOTED_THIS');
    render(<Highlights />);

    fireEvent.click(await screen.findByRole('button', { name: /remove vote from/i }));
    expect(removeVoteMock).toHaveBeenCalled();
  });

  it('switches vote to another highlight', async () => {
    getVoteStateMock.mockReturnValue('VOTED_OTHER');
    render(<Highlights />);

    fireEvent.click(await screen.findByRole('button', { name: /vote for/i }));
    expect(switchVoteMock).toHaveBeenCalledWith('highlight-1');
  });
});

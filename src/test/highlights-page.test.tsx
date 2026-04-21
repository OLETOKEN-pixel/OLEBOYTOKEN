import { readFileSync } from 'node:fs';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HighlightsSection } from '@/components/home/sections/HighlightsSection';
import Highlights from '@/pages/Highlights';

const mocks = vi.hoisted(() => {
  const insertMock = vi.fn(() => Promise.resolve({ data: null, error: null }));
  const results: Record<string, { data: unknown; error: null }> = {
    highlights: { data: [], error: null },
    profiles_public: { data: [], error: null },
    highlight_votes: { data: [], error: null },
  };

  const fromMock = vi.fn((table: string) => {
    const chain: Record<string, unknown> = {};
    const result = results[table] ?? { data: [], error: null };
    const returnChain = () => chain;

    chain.select = vi.fn(returnChain);
    chain.order = vi.fn(returnChain);
    chain.limit = vi.fn(returnChain);
    chain.eq = vi.fn(returnChain);
    chain.in = vi.fn(returnChain);
    chain.insert = vi.fn((payload: unknown) => {
      insertMock(payload);
      return Promise.resolve({ data: null, error: null });
    });
    chain.then = (resolve: (value: typeof result) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject);

    return chain;
  });

  const authValue = {
    user: null as { id: string } | null,
    profile: null,
    wallet: null,
    loading: false,
    signOut: vi.fn(),
  };

  return {
    authValue,
    fromMock,
    insertMock,
    castVoteMock: vi.fn(),
    removeVoteMock: vi.fn(),
    switchVoteMock: vi.fn(),
    rpcMock: vi.fn(() => Promise.resolve({ data: [], error: null })),
    removeChannelMock: vi.fn(),
    toastMock: vi.fn(),
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => mocks.authValue,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mocks.fromMock,
    rpc: mocks.rpcMock,
    channel: () => ({
      on: () => ({
        subscribe: () => undefined,
      }),
    }),
    removeChannel: mocks.removeChannelMock,
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toastMock, toasts: [] }),
}));

vi.mock('@/hooks/useHighlightVotes', () => ({
  useHighlightVotes: () => ({
    voteCounts: {},
    isVoting: false,
    getVoteState: () => 'NOT_VOTED',
    castVote: mocks.castVoteMock,
    removeVote: mocks.removeVoteMock,
    switchVote: mocks.switchVoteMock,
  }),
}));

function LocationProbe() {
  const location = useLocation();

  return <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>;
}

function renderHighlightsAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/highlights" element={<Highlights />} />
        <Route path="/highlights/week" element={<Highlights />} />
        <Route path="/highlights/month" element={<Highlights />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Highlights HLS pages', () => {
  afterEach(() => {
    mocks.authValue.user = null;
    mocks.authValue.profile = null;
    mocks.authValue.wallet = null;
    mocks.fromMock.mockClear();
    mocks.insertMock.mockClear();
    mocks.castVoteMock.mockClear();
    mocks.removeVoteMock.mockClear();
    mocks.switchVoteMock.mockClear();
    mocks.rpcMock.mockClear();
    mocks.toastMock.mockClear();
    window.history.pushState({}, '', '/');
  });

  it('wires /highlights through the app router instead of NotFound', async () => {
    const appSource = readFileSync(`${process.cwd()}/src/App.tsx`, 'utf8');
    expect(appSource).toContain('path="/highlights"');

    renderHighlightsAt('/highlights');

    expect(await screen.findByRole('heading', { name: 'HIGHLIGHTS' })).toBeInTheDocument();
    expect(screen.queryByText(/404/i)).not.toBeInTheDocument();
  });

  it('filters the Figma grid by title and author', async () => {
    renderHighlightsAt('/highlights');

    const searchInput = await screen.findByRole('textbox', { name: 'Search highlights' });
    fireEvent.change(searchInput, { target: { value: 'malibuca' } });

    expect(screen.getAllByText('Malibuca | Highlights #2').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Godzilla/)).not.toBeInTheDocument();
  });

  it('renders week nominees with the Figma order and copy', async () => {
    const { container } = renderHighlightsAt('/highlights/week');

    expect(await screen.findByRole('heading', { name: 'HIGHLIGHTS - TOP WEEK' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'THIS WEEK NOMINEES' })).toBeInTheDocument();
    expect(screen.getByText(/earns EXTRA coins/)).toBeInTheDocument();

    const nomineeTitles = Array.from(container.querySelectorAll('#highlight-nominees [data-highlight-rank]'))
      .map((node) => (node as HTMLElement).dataset.highlightTitle);

    expect(nomineeTitles).toEqual([
      '1st FNCS GRAND FINALS...',
      'Never Change 💔 | Clix',
      'Pricey 🪙 | Eomzo Highlig...',
      'Malibuca | Highlights #2',
    ]);
  });

  it('renders month nominees with the same Figma top images and month copy', async () => {
    const { container } = renderHighlightsAt('/highlights/month');

    expect(await screen.findByRole('heading', { name: 'HIGHLIGHTS - TOP MONTH' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'THIS MONTH NOMINEES' })).toBeInTheDocument();
    expect(screen.getByText(/gets a FREE montage/)).toBeInTheDocument();

    const nomineeThumbnails = Array.from(container.querySelectorAll('#highlight-nominees [data-testid="highlight-thumbnail"]'))
      .map((node) => (node as HTMLImageElement).getAttribute('src'));

    expect(nomineeThumbnails).toEqual([
      '/highlights/thumb-peterbot.png',
      '/highlights/thumb-clix.png',
      '/highlights/thumb-eomzo.png',
      '/highlights/thumb-malibuca.png',
    ]);
  });

  it('validates upload URLs and inserts parsed YouTube highlights', async () => {
    mocks.authValue.user = { id: 'user-1' };
    mocks.authValue.profile = { discord_display_name: 'Tester' };
    mocks.authValue.wallet = { balance: 25 };

    renderHighlightsAt('/highlights?upload=1');

    const input = await screen.findByLabelText('YouTube URL:');
    fireEvent.change(input, { target: { value: 'https://youtu.be/abcDEF12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'PUBLISH' }));

    await waitFor(() => {
      expect(mocks.insertMock).toHaveBeenCalledWith({
        user_id: 'user-1',
        title: 'Highlight abcDEF12345',
        youtube_url: 'https://youtu.be/abcDEF12345',
        youtube_video_id: 'abcDEF12345',
      });
    });
  });

  it('routes the desktop home WATCH CTA to /highlights', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <HighlightsSection />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open highlights page' }));

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/highlights');
  });
});

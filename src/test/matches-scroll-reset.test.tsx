import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Matches from '@/pages/Matches';

const {
  removeChannelMock,
  subscribeMock,
  queryBuilder,
  fromMock,
  channelMock,
} = vi.hoisted(() => {
  const builder = {
    data: [] as unknown[],
    error: null as unknown,
    eq: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    order: vi.fn(() => builder),
  };

  return {
    removeChannelMock: vi.fn(),
    subscribeMock: vi.fn(() => ({ key: 'channel' })),
    queryBuilder: builder,
    fromMock: vi.fn(() => ({
      select: vi.fn(() => builder),
    })),
    channelMock: vi.fn(() => ({
      on: vi.fn(() => ({
        subscribe: subscribeMock,
      })),
    })),
  };
});

vi.mock('@/components/layout/PublicLayout', () => ({
  PublicLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/matches/CreateMatchOverlay', () => ({
  CreateMatchOverlay: ({ open }: { open: boolean }) => (open ? <div data-testid="create-overlay" /> : null),
}));

vi.mock('@/components/matches/TeamSelectDialog', () => ({
  TeamSelectDialog: () => null,
}));

vi.mock('@/components/matches/MatchesLiveCard', () => ({
  MatchesLiveCard: ({ title }: { title: string }) => <div data-testid="matches-live-card">{title}</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
  }),
}));

vi.mock('@/hooks/useMatches', () => ({
  useJoinMatch: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: fromMock,
    channel: channelMock,
    removeChannel: removeChannelMock,
  },
}));

describe('Matches page scroll reset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryBuilder.data = [];
    queryBuilder.error = null;
  });

  it('forces /matches to open from the top', async () => {
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    render(
      <MemoryRouter initialEntries={['/matches']}>
        <Routes>
          <Route path="/matches" element={<Matches />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
    });
  });

  it('forces /matches/create to open from the top before showing the overlay', async () => {
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    render(
      <MemoryRouter initialEntries={['/matches/create']}>
        <Routes>
          <Route path="/matches/create" element={<Matches />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
    });
  });

  it('keeps a single token card at normal column width on desktop', async () => {
    queryBuilder.data = [
      {
        id: 'match-1',
        creator_id: 'creator-1',
        mode: 'Box Fight',
        platform: 'PC',
        first_to: 5,
        entry_fee: 1,
        team_size: 1,
        expires_at: new Date(Date.now() + 600_000).toISOString(),
      },
    ];

    const { container } = render(
      <MemoryRouter initialEntries={['/matches']}>
        <Routes>
          <Route path="/matches" element={<Matches />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(container.querySelector('[data-testid="matches-live-card"]')).not.toBeNull();
    });

    const grid = container.querySelector('[data-testid="matches-live-card"]')?.parentElement?.parentElement as HTMLElement;

    expect(grid.style.gridTemplateColumns).toBe('repeat(auto-fill, 300px)');
    expect(grid.style.columnGap).toBe('111px');
  });

  it('caps the live matches title outline at the final title letter', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/matches']}>
        <Routes>
          <Route path="/matches" element={<Matches />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('ARENA STANDBY')).toBeInTheDocument();
    });

    const underline = container.querySelector('[data-testid="matches-title-underline"]');

    expect(underline).not.toBeNull();
    expect(underline?.className).toContain('w-[743px]');
    expect(underline?.className).not.toContain('w-[1000px]');
  });

  it('uses custom liquid-glass filter menus instead of native selects', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/matches']}>
        <Routes>
          <Route path="/matches" element={<Matches />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('ARENA STANDBY')).toBeInTheDocument();
    });

    expect(container.querySelector('select')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'TEAM SIZE filter' }));

    const menu = container.querySelector('[data-filter-menu="TEAM SIZE"]') as HTMLElement;

    expect(menu).not.toBeNull();
    expect(within(menu).queryByRole('option', { name: 'TEAM SIZE' })).toBeNull();
    expect(within(menu).getByRole('option', { name: 'ALL' })).toBeInTheDocument();
    expect(within(menu).getByRole('option', { name: '1V1' })).toBeInTheDocument();
  });

  it('removes cross-platform from platform filters and keeps long options on one line', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/matches']}>
        <Routes>
          <Route path="/matches" element={<Matches />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('ARENA STANDBY')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'PLATFORM filter' }));

    const platformMenu = container.querySelector('[data-filter-menu="PLATFORM"]') as HTMLElement;

    expect(within(platformMenu).queryByRole('option', { name: 'CROSS-PLATFORM' })).toBeNull();
    expect(within(platformMenu).getByRole('option', { name: 'CONSOLE' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'MODE filter' }));

    const modeMenu = container.querySelector('[data-filter-menu="MODE"]') as HTMLElement;
    const buildFightOption = within(modeMenu).getByRole('option', { name: 'BUILD FIGHT' });

    expect(buildFightOption).toHaveClass('whitespace-nowrap');
  });

  it('updates the team size query from the custom dropdown', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/matches']}>
        <Routes>
          <Route path="/matches" element={<Matches />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('ARENA STANDBY')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'TEAM SIZE filter' }));

    const menu = container.querySelector('[data-filter-menu="TEAM SIZE"]') as HTMLElement;
    fireEvent.click(within(menu).getByRole('option', { name: '1V1' }));

    expect(screen.getByRole('button', { name: '1V1 filter' })).toBeInTheDocument();

    await waitFor(() => {
      expect(queryBuilder.eq).toHaveBeenCalledWith('team_size', 1);
    });

    await waitFor(() => {
      expect(screen.getByText('FILTERED VIEW')).toBeInTheDocument();
    });
  });

  it('closes an open filter when another filter opens', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/matches']}>
        <Routes>
          <Route path="/matches" element={<Matches />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('ARENA STANDBY')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'TEAM SIZE filter' }));
    expect(container.querySelector('[data-filter-menu="TEAM SIZE"]')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'PLATFORM filter' }));

    expect(container.querySelector('[data-filter-menu="TEAM SIZE"]')).toBeNull();
    expect(container.querySelector('[data-filter-menu="PLATFORM"]')).not.toBeNull();
  });
});

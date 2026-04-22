import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HomeRegistered } from '@/components/home/HomeRegistered';
import { NavbarFigmaLoggedIn } from '@/components/layout/NavbarFigmaLoggedIn';

const mocks = vi.hoisted(() => {
  const future = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const results: Record<string, { data: any; error: null }> = {
    matches: {
      data: [
        {
          id: 'match-1',
          mode: 'Box Fight',
          first_to: 5,
          platform: 'Console',
          entry_fee: 1,
          expires_at: future,
          status: 'open',
          created_at: future,
        },
      ],
      error: null,
    },
    leaderboard_weekly: {
      data: [
        { user_id: 'leader-1', username: 'Alpha', wins: 8, total_matches: 10, total_earnings: 120 },
        { user_id: 'leader-2', username: 'Beta', wins: 6, total_matches: 8, total_earnings: 90 },
        { user_id: 'leader-3', username: 'Gamma', wins: 5, total_matches: 9, total_earnings: 50 },
      ],
      error: null,
    },
    profiles: {
      data: [
        { user_id: 'leader-1', username: 'Alpha', discord_display_name: 'Alpha', discord_avatar_url: null, avatar_url: null },
        { user_id: 'leader-2', username: 'Beta', discord_display_name: 'Beta', discord_avatar_url: null, avatar_url: null },
        { user_id: 'leader-3', username: 'Gamma', discord_display_name: 'Gamma', discord_avatar_url: null, avatar_url: null },
      ],
      error: null,
    },
    challenges: {
      data: [
        { id: 'challenge-1', title: 'Win one match', target_value: 2, reward_xp: 20, reward_coin: 0 },
      ],
      error: null,
    },
    user_challenge_progress: {
      data: [
        { challenge_id: 'challenge-1', progress_value: 1, is_completed: false },
      ],
      error: null,
    },
    user_xp: {
      data: { total_xp: 140 },
      error: null,
    },
    teams: {
      data: [
        { id: 'team-1', name: 'Redline', avatar_url: null, member_count: 12, max_members: 30 },
      ],
      error: null,
    },
  };

  const fromMock = vi.fn((table: string) => {
    const result = results[table] ?? { data: [], error: null };
    const chain: any = {};
    const returnChain = () => chain;

    chain.select = vi.fn(returnChain);
    chain.eq = vi.fn(returnChain);
    chain.order = vi.fn(returnChain);
    chain.limit = vi.fn(returnChain);
    chain.in = vi.fn(returnChain);
    chain.single = vi.fn(() => Promise.resolve(result));
    chain.maybeSingle = vi.fn(() => Promise.resolve(result));
    chain.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);

    return chain;
  });

  const signOut = vi.fn();
  const authValue = {
    user: { id: 'user-1' },
    profile: {
      username: 'Tester',
      email: 'tester@oleboy.test',
      avatar_url: null,
      discord_avatar_url: null,
      discord_display_name: 'Tester',
      level: 3,
    },
    wallet: {
      balance: 17.5,
    },
    signOut,
  };

  return {
    fromMock,
    signOut,
    authValue,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mocks.fromMock,
    rpc: vi.fn().mockResolvedValue({ data: 0, error: null }),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mocks.authValue,
}));

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

function LocationProbe() {
  const location = useLocation();
  const scrollTo = (location.state as { scrollTo?: string } | null)?.scrollTo ?? '';

  return <div data-testid="location-probe">{`${location.pathname}|${scrollTo}`}</div>;
}

describe('HomeRegistered mobile logged-in landing', () => {
  afterEach(() => {
    mocks.fromMock.mockClear();
    mocks.signOut.mockClear();
    setViewportWidth(1024);
  });

  it('renders the dedicated mobile logged-in home below the mobile breakpoint', async () => {
    setViewportWidth(390);

    const { container } = render(
      <MemoryRouter>
        <HomeRegistered displayName="Tester" />
      </MemoryRouter>,
    );

    expect(container.querySelector('[data-mobile-home="logged-in"]')).not.toBeNull();
    expect(screen.getByRole('heading', { name: /Welcome, Tester/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'LIVE MATCHES' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'LEADERBOARD' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'CHALLENGES' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'HIGHLIGHTS' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'TEAMS' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'SHOP' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Redline')).toBeInTheDocument();
      expect(screen.getByText('Win one match')).toBeInTheDocument();
      expect(screen.getByText('Alpha')).toBeInTheDocument();
    });
  });

  it('keeps mobile logged-home assets controlled and removes desktop decorative chrome', async () => {
    setViewportWidth(375);

    const { container } = render(
      <MemoryRouter>
        <HomeRegistered displayName="Tester" />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Redline')).toBeInTheDocument();
      expect(screen.getByText('Win one match')).toBeInTheDocument();
      expect(screen.getByText('140')).toBeInTheDocument();
      expect(screen.getByText('Alpha')).toBeInTheDocument();
    });

    const srcs = Array.from(container.querySelectorAll('img')).map((img) => img.getAttribute('src'));

    expect(srcs).toContain('/figma-assets/figma-neon.png');
    expect(srcs).toContain('/showreel/highlight-video-1.png');
    expect(srcs).toContain('/showreel/shop-item-1.png');
    expect(srcs).not.toContain('/active-home/zaps.png');
    expect(srcs).not.toContain('/active-home/star-shape.svg');
    expect(srcs).not.toContain('/active-home/star-shape-1.svg');
    expect(srcs).not.toContain('/active-home/star-shape-2.svg');
    expect(srcs).not.toContain('/active-home/star-shape-3.svg');
    expect(srcs).not.toContain('/active-home/spaccato-title.png');
    expect(srcs).not.toContain('/active-home/spaccato-title-1.png');
    expect(srcs).not.toContain('/active-home/spaccato-title-2.png');
    expect(srcs).not.toContain('/active-home/spaccato-title-3.png');
    expect(srcs.some((src) => src?.startsWith('https://www.figma.com/api/mcp/'))).toBe(false);
  });

  it('keeps CTA routes wired from the mobile logged-in sections', async () => {
    setViewportWidth(390);

    render(
      <MemoryRouter initialEntries={['/']}>
        <HomeRegistered displayName="Tester" />
        <LocationProbe />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Redline')).toBeInTheDocument();
      expect(screen.getByText('Win one match')).toBeInTheDocument();
      expect(screen.getByText('140')).toBeInTheDocument();
      expect(screen.getByText('Alpha')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open matches page' }));

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/matches|');
  });

  it('marks mobile logged-home roots as horizontally clipped', async () => {
    setViewportWidth(320);

    const { container } = render(
      <MemoryRouter>
        <HomeRegistered displayName="Tester" />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Redline')).toBeInTheDocument();
      expect(screen.getByText('Win one match')).toBeInTheDocument();
      expect(screen.getByText('140')).toBeInTheDocument();
      expect(screen.getByText('Alpha')).toBeInTheDocument();
    });

    const root = container.querySelector('[data-mobile-home="logged-in"]') as HTMLElement;
    const sections = Array.from(container.querySelectorAll('[data-mobile-section]')) as HTMLElement[];

    expect(root.style.maxWidth).toBe('100vw');
    expect(root.style.overflowX).toBe('hidden');
    expect(sections.length).toBeGreaterThanOrEqual(8);
    expect(sections.every((section) => section.style.maxWidth === '100vw')).toBe(true);
  });
});

describe('NavbarFigmaLoggedIn mobile navigation', () => {
  afterEach(() => {
    mocks.signOut.mockClear();
    setViewportWidth(1024);
  });

  it('renders the compact logged-in navbar with wallet, profile trigger and section menu', () => {
    setViewportWidth(390);

    const { container } = render(
      <MemoryRouter>
        <NavbarFigmaLoggedIn />
      </MemoryRouter>,
    );

    expect(container.querySelector('[data-mobile-navbar="logged-in"]')).not.toBeNull();
    expect(screen.getByLabelText('Wallet balance')).toHaveTextContent('17.50');
    expect(screen.getByRole('button', { name: 'Open wallet purchase' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open profile menu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open menu' })).toBeInTheDocument();
  });

  it('opens the mobile section menu and routes standalone pages back to home section ids', () => {
    setViewportWidth(390);

    const { container } = render(
      <MemoryRouter initialEntries={['/matches']}>
        <NavbarFigmaLoggedIn />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    expect(container.querySelector('[data-mobile-navbar-menu="logged-in"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'MATCHES' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'leaderboard' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'shop' }));

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/|s-shop');
  });
});

import fs from 'node:fs';
import path from 'node:path';
import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Challenges from '@/pages/Challenges';
import type { Challenge } from '@/hooks/useChallenges';
import type { LevelReward } from '@/lib/levelRewards';

const { authState, hookState } = vi.hoisted(() => ({
  authState: {
    user: { id: 'user-1' } as { id: string } | null,
    loading: false,
  },
  hookState: {} as {
    dailyChallenges: Challenge[];
    weeklyChallenges: Challenge[];
    overviewStats: { newCount: number; startedCount: number; completedCount: number };
    nextReward: LevelReward | null;
    level: number;
    userXp: number;
    xpInLevel: number;
    xpRequired: number;
    xpToNext: number;
    isLoading: boolean;
    getResetTimes: () => {
      dailyReset: Date;
      weeklyReset: Date;
      dailyMs: number;
      weeklyMs: number;
    };
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('@/hooks/useChallenges', () => ({
  useChallenges: () => hookState,
}));

vi.mock('@/components/layout/PublicLayout', () => ({
  PublicLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid="public-layout">{children}</div>
  ),
}));

vi.mock('@/components/home/sections/FooterSection', () => ({
  FooterSection: () => <div data-testid="footer-section">Footer</div>,
}));

vi.mock('@/components/common/LoadingSpinner', () => ({
  LoadingPage: () => <div data-testid="loading-page">Loading</div>,
}));

function makeChallenge(
  id: string,
  type: 'daily' | 'weekly',
  title: string,
  targetValue: number,
  progressValue: number,
  rewardXp: number,
  rewardCoin = 0,
  sortOrder = 1,
): Challenge {
  const completed = progressValue >= targetValue;

  return {
    id,
    title,
    description: `${title} description`,
    type,
    metric_type: title.toLowerCase().replace(/\s+/g, '_'),
    target_value: targetValue,
    reward_xp: rewardXp,
    reward_coin: rewardCoin,
    progress_value: progressValue,
    is_completed: completed,
    is_claimed: completed,
    period_key: type === 'daily' ? '2026-04-25' : '2026-W17',
    sortOrder,
  };
}

function buildHookState(overrides?: Partial<typeof hookState>) {
  const dailyChallenges = [
    makeChallenge('daily-1', 'daily', 'Play 1 Match', 1, 0, 30, 0, 1),
    makeChallenge('daily-2', 'daily', 'Play 3 Matches', 3, 2, 60, 0, 2),
    makeChallenge('daily-3', 'daily', 'Ready Up Fast', 1, 1, 20, 0, 3),
    makeChallenge('daily-4', 'daily', 'Upload 1 Match Proof', 1, 0, 30, 0, 4),
    makeChallenge('daily-5', 'daily', 'Start 1 Match You Created', 1, 0, 30, 0, 5),
  ];
  const weeklyChallenges = [
    makeChallenge('weekly-1', 'weekly', 'Complete 10 Matches', 10, 4, 50, 1, 1),
    makeChallenge('weekly-2', 'weekly', 'Complete 25 Matches', 25, 0, 100, 0, 2),
    makeChallenge('weekly-3', 'weekly', 'Start 5 Matches You Created', 5, 1, 40, 1, 3),
    makeChallenge('weekly-4', 'weekly', 'Upload Proof in 5 Matches', 5, 0, 50, 1, 4),
    makeChallenge('weekly-5', 'weekly', 'Ready Up Fast 5 Times', 5, 0, 40, 0, 5),
  ];

  return {
    dailyChallenges,
    weeklyChallenges,
    overviewStats: {
      newCount: 6,
      startedCount: 3,
      completedCount: 1,
    },
    nextReward: {
      id: 'mousepad',
      image: '/shop/tappetino.png',
      levelRequired: 15,
      name: 'TAPPETINO',
    } satisfies LevelReward,
    level: 14,
    userXp: 1480,
    xpInLevel: 180,
    xpRequired: 200,
    xpToNext: 20,
    isLoading: false,
    getResetTimes: () => ({
      dailyReset: new Date('2026-04-26T00:00:00.000Z'),
      weeklyReset: new Date('2026-04-27T00:00:00.000Z'),
      dailyMs: (14 * 60 + 23) * 60 * 1000,
      weeklyMs: ((5 * 24) + 14) * 60 * 60 * 1000,
    }),
    ...overrides,
  };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}</div>;
}

describe('Challenges page', () => {
  beforeEach(() => {
    authState.user = { id: 'user-1' };
    authState.loading = false;
    Object.assign(hookState, buildHookState());
  });

  it('renders the overview by default with the next reward card', () => {
    render(
      <MemoryRouter initialEntries={['/challenges']}>
        <Challenges />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('challenges-page')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'OVERVIEW' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('TAPPETINO')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('switches to the daily tab and renders daily rows with the countdown', () => {
    render(
      <MemoryRouter initialEntries={['/challenges']}>
        <Challenges />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'DAILY' }));

    expect(screen.getByText('Play 1 Match')).toBeInTheDocument();
    expect(screen.getByText('Play 3 Matches')).toBeInTheDocument();
    expect(screen.getByTestId('challenges-reset-copy')).toHaveTextContent(
      'New tasks in: 14 hours and 23 minutes!',
    );
  });

  it('switches to the weekly tab and renders weekly rows with the countdown', () => {
    render(
      <MemoryRouter initialEntries={['/challenges']}>
        <Challenges />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'WEEKLY' }));

    expect(screen.getByText('Complete 10 Matches')).toBeInTheDocument();
    expect(screen.getByText('Ready Up Fast 5 Times')).toBeInTheDocument();
    expect(screen.getByTestId('challenges-reset-copy')).toHaveTextContent(
      'New tasks in: 5 days and 14 hours!',
    );
  });

  it('shows the mouse reward when the user reaches level 15', () => {
    Object.assign(
      hookState,
      buildHookState({
        level: 15,
        nextReward: {
          id: 'mouse',
          image: '/shop/mouse.webp',
          levelRequired: 30,
          name: 'MOUSE',
        },
      }),
    );

    render(
      <MemoryRouter initialEntries={['/challenges']}>
        <Challenges />
      </MemoryRouter>,
    );

    expect(screen.getByText('MOUSE')).toBeInTheDocument();
  });

  it('shows the unlocked state when all rewards are available', () => {
    Object.assign(
      hookState,
      buildHookState({
        level: 30,
        nextReward: null,
      }),
    );

    render(
      <MemoryRouter initialEntries={['/challenges']}>
        <Challenges />
      </MemoryRouter>,
    );

    expect(screen.getByText('All rewards unlocked')).toBeInTheDocument();
  });

  it('redirects guests to auth with the challenges next path', async () => {
    authState.user = null;

    render(
      <MemoryRouter initialEntries={['/challenges']}>
        <Routes>
          <Route path="/challenges" element={<Challenges />} />
          <Route
            path="/auth"
            element={
              <>
                <div>Auth page</div>
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Auth page')).toBeInTheDocument();
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/auth');
  });

  it('does not embed remote figma asset URLs in the challenges page source', () => {
    const file = fs.readFileSync(
      path.resolve(process.cwd(), 'src/pages/Challenges.tsx'),
      'utf8',
    );

    expect(file).not.toMatch(/https:\/\/www\.figma\.com\/api\/mcp\/asset\//);
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ChallengesSection } from '@/components/home/sections/ChallengesSection';

vi.mock('@/hooks/useChallenges', () => ({
  useChallenges: () => ({
    challenges: [
      {
        id: 'challenge-1',
        title: 'Play 1 Match',
        description: 'Complete any match today',
        type: 'daily',
        metric_type: 'match_completed',
        target_value: 1,
        reward_xp: 30,
        reward_coin: 0,
        progress_value: 0,
        is_completed: false,
        is_claimed: false,
        period_key: '2026-04-25',
        sortOrder: 1,
      },
    ],
    userXp: 90,
    claimChallenge: vi.fn().mockResolvedValue({ success: true }),
  }),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}</div>;
}

describe('ChallengesSection', () => {
  it('routes the desktop level up CTA to the standalone challenges page', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <ChallengesSection />
                <LocationProbe />
              </>
            }
          />
          <Route
            path="/challenges"
            element={
              <>
                <div>Challenges page</div>
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open challenges page' }));

    expect(screen.getByText('Challenges page')).toBeInTheDocument();
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/challenges');
  });
});

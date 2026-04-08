import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { NavbarFigmaLoggedIn } from '@/components/layout/NavbarFigmaLoggedIn';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: {
      username: 'Tester',
      avatar_url: null,
      discord_avatar_url: null,
    },
    wallet: {
      balance: 17.5,
    },
    signOut: vi.fn(),
  }),
}));

describe('NavbarFigmaLoggedIn', () => {
  function LocationProbe() {
    const location = useLocation();
    const scrollTo = (location.state as { scrollTo?: string } | null)?.scrollTo ?? '';

    return <div data-testid="location-probe">{`${location.pathname}|${scrollTo}`}</div>;
  }

  it('keeps matches active on nested matches routes', () => {
    render(
      <MemoryRouter initialEntries={['/matches/create']}>
        <NavbarFigmaLoggedIn />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'MATCHES' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'matches' })).not.toBeInTheDocument();
  });

  it('routes standalone pages back to the requested logged-home section', () => {
    render(
      <MemoryRouter initialEntries={['/matches']}>
        <NavbarFigmaLoggedIn />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'shop' }));

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/|s-shop');
  });

  it('sends matches clicks to the logged-home matches section instead of staying on /matches', () => {
    render(
      <MemoryRouter initialEntries={['/matches']}>
        <NavbarFigmaLoggedIn />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'MATCHES' }));

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/|s-matches');
  });
});

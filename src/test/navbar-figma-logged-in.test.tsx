import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NavbarFigmaLoggedIn } from '@/components/layout/NavbarFigmaLoggedIn';

const { isMobileState } = vi.hoisted(() => ({
  isMobileState: {
    value: false,
  },
}));

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

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onSelect,
  }: {
    children: ReactNode;
    onSelect?: () => void;
  }) => (
    <button type="button" onClick={onSelect}>
      {children}
    </button>
  ),
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <div />,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => isMobileState.value,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: 0, error: null }),
  },
}));

describe('NavbarFigmaLoggedIn', () => {
  beforeEach(() => {
    isMobileState.value = false;
  });

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

  it('routes teams clicks to the standalone teams page', () => {
    render(
      <MemoryRouter initialEntries={['/matches']}>
        <NavbarFigmaLoggedIn />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'teams' }));

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/teams|');
  });

  it('routes the desktop profile dropdown to My Matches', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <NavbarFigmaLoggedIn />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByText('My Matches'));

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/my-matches|');
  });

  it('routes the mobile profile dropdown to My Matches', async () => {
    isMobileState.value = true;

    render(
      <MemoryRouter initialEntries={['/']}>
        <NavbarFigmaLoggedIn />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByText('My Matches'));

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/my-matches|');
  });
});

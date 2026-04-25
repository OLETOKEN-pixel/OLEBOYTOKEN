import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminShell } from '@/components/admin/AdminShell';

const adminState = vi.hoisted(() => ({
  user: { id: 'admin-1' } as { id: string } | null,
  isAdmin: true,
  isLoading: false,
}));

vi.mock('@/hooks/useAdminStatus', () => ({
  useAdminStatus: () => adminState,
}));

vi.mock('@/components/layout/NavbarFigmaLoggedIn', () => ({
  NavbarFigmaLoggedIn: () => <div data-testid="figma-navbar">Navbar</div>,
}));

vi.mock('@/components/common/LoadingSpinner', () => ({
  LoadingPage: () => <div data-testid="loading-page">Loading</div>,
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>;
}

function renderAdminShell(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/admin"
          element={
            <AdminShell title="Dashboard" description="Operations hub">
              <div>Dashboard body</div>
            </AdminShell>
          }
        />
        <Route
          path="/admin/shop"
          element={
            <AdminShell title="Shop Rewards" description="Manage rewards">
              <div>Shop body</div>
            </AdminShell>
          }
        />
        <Route
          path="/admin/matches/:id"
          element={
            <AdminShell title="Match Detail" description="Inspect one match">
              <div>Match detail body</div>
            </AdminShell>
          }
        />
        <Route
          path="/auth"
          element={
            <>
              <div>Auth page</div>
              <LocationProbe />
            </>
          }
        />
        <Route
          path="/"
          element={
            <>
              <div>Home page</div>
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminShell', () => {
  beforeEach(() => {
    adminState.user = { id: 'admin-1' };
    adminState.isAdmin = true;
    adminState.isLoading = false;
  });

  it('shows the loading screen while admin status is resolving', () => {
    adminState.isLoading = true;

    renderAdminShell('/admin');

    expect(screen.getByTestId('loading-page')).toBeInTheDocument();
    expect(screen.getByTestId('figma-navbar')).toBeInTheDocument();
  });

  it('redirects guests to auth and preserves the next admin path', async () => {
    adminState.user = null;

    renderAdminShell('/admin/shop?tab=live');

    expect(await screen.findByText('Auth page')).toBeInTheDocument();
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/auth?next=%2Fadmin%2Fshop%3Ftab%3Dlive');
  });

  it('redirects authenticated non-admin users back to home', async () => {
    adminState.isAdmin = false;

    renderAdminShell('/admin');

    expect(await screen.findByText('Home page')).toBeInTheDocument();
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/');
  });

  it('renders the admin section nav and marks nested pages under the correct section', () => {
    renderAdminShell('/admin/matches/match-42');

    expect(screen.getByTestId('admin-shell')).toBeInTheDocument();
    expect(screen.getByTestId('admin-section-nav')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/admin');
    expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/admin/users');
    expect(screen.getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/admin/shop');
    expect(screen.getByRole('link', { name: 'Challenges' })).toHaveAttribute('href', '/admin/challenges');
    expect(screen.getByRole('link', { name: 'Matches' }).className).toContain('border-[#ff1654]');
    expect(screen.getByText('Match detail body')).toBeInTheDocument();
  });
});

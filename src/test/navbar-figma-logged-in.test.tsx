import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
  it('keeps matches active on nested matches routes', () => {
    render(
      <MemoryRouter initialEntries={['/matches/create']}>
        <NavbarFigmaLoggedIn />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'MATCHES' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'matches' })).not.toBeInTheDocument();
  });
});

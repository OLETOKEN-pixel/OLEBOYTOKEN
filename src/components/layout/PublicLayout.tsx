import { ReactNode } from 'react';
import { NavbarFigma } from './NavbarFigma';
import { NavbarFigmaLoggedIn } from './NavbarFigmaLoggedIn';
import { useAuth } from '@/contexts/AuthContext';

interface PublicLayoutProps {
  children: ReactNode;
}

/**
 * Layout for public/home pages.
 * Renders the public navbar for guests and the logged-in navbar for authenticated users.
 */
export function PublicLayout({ children }: PublicLayoutProps) {
  const { user } = useAuth();

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        background: '#04080f',
        fontFamily: "'Base Neue Trial', 'Base Neue', sans-serif",
      }}
    >
      {user ? <NavbarFigmaLoggedIn /> : <NavbarFigma />}
      <main style={{ width: '100%' }}>
        {children}
      </main>
    </div>
  );
}

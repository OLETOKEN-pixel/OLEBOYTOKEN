import { ReactNode } from 'react';
import { NavbarFigma } from './NavbarFigma';
import { NavbarFigmaLoggedIn } from './NavbarFigmaLoggedIn';
import { FigmaFrame } from './FigmaFrame';
import { useAuth } from '@/contexts/AuthContext';

interface PublicLayoutProps {
  children: ReactNode;
  /**
   * If true, renders children inside a 1920px FigmaFrame so the entire page
   * scales proportionally on smaller viewports (matches the Figma design).
   * Disable only for pages that already manage their own scaling.
   */
  scaleToFigmaFrame?: boolean;
}

/**
 * Layout for public/home pages.
 * Renders the public navbar for guests and the logged-in navbar for authenticated users.
 */
export function PublicLayout({ children, scaleToFigmaFrame = true }: PublicLayoutProps) {
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
        {scaleToFigmaFrame ? (
          <FigmaFrame baseWidth={1920}>{children}</FigmaFrame>
        ) : (
          children
        )}
      </main>
    </div>
  );
}

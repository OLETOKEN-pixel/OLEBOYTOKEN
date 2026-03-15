import { ReactNode } from 'react';
import { NavbarFigma } from './NavbarFigma';

interface PublicLayoutProps {
  children: ReactNode;
}

/**
 * Layout for public pages (not logged in users).
 * Uses the Figma navbar design with dark background.
 */
export function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        background: '#04080f',
        fontFamily: "'Base Neue Trial', 'Base Neue', sans-serif",
      }}
    >
      <NavbarFigma />
      <main style={{ width: '100%' }}>
        {children}
      </main>
    </div>
  );
}

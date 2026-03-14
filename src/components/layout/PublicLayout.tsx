import { ReactNode } from 'react';
import { NavbarFigma } from './NavbarFigma';

interface PublicLayoutProps {
  children: ReactNode;
}

/**
 * Layout for public pages (not logged in users).
 * Uses the new Figma navbar design with dark background.
 */
export function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div
      className="min-h-screen w-full"
      style={{ background: '#04080f', fontFamily: "'Base Neue', sans-serif" }}
    >
      <NavbarFigma />
      <main className="w-full">
        {children}
      </main>
    </div>
  );
}

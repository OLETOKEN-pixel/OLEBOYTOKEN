import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Rules from '@/pages/Rules';

vi.mock('@/components/layout/MainLayout', () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <div data-testid="main-layout">{children}</div>,
}));

describe('Rules page', () => {
  it('renders every game mode map code and one shared general rules section', () => {
    render(
      <MemoryRouter>
        <Rules />
      </MemoryRouter>,
    );

    expect(screen.getByText('9854-1829-8735')).toBeInTheDocument();
    expect(screen.getByText('Finest Realistics')).toBeInTheDocument();
    expect(screen.getByText('2640-2394-7508')).toBeInTheDocument();
    expect(screen.getByText('Elite Box Fights')).toBeInTheDocument();
    expect(screen.getByText('3537-4087-0888')).toBeInTheDocument();
    expect(screen.getByText('Zone Wars')).toBeInTheDocument();
    expect(screen.getAllByText('General Rules')).toHaveLength(1);
    expect(screen.getByText(/maximum of 10 minutes from the match starting/i)).toBeInTheDocument();
  });
});

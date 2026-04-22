import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Privacy from '@/pages/Privacy';
import Terms from '@/pages/Terms';

vi.mock('@/components/layout/PublicLayout', () => ({
  PublicLayout: ({ children }: { children: ReactNode }) => <div data-testid="public-layout">{children}</div>,
}));

vi.mock('@/components/home/sections/FooterSection', () => ({
  FooterSection: () => <footer data-testid="figma-footer" />,
}));

function renderLegalPage(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('legal pages Figma redesign', () => {
  it('renders Terms with the shared Figma shell and current legal copy', () => {
    const { container } = renderLegalPage(<Terms />);

    expect(screen.getByRole('heading', { name: 'TERMS OF SERVICE' })).toBeInTheDocument();
    expect(screen.getByText(/Terms and conditions for using OleBoy Token/i)).toBeInTheDocument();
    expect(screen.getByText(/Last updated:/i)).toBeInTheDocument();
    expect(screen.getByText('24/01/2026')).toBeInTheDocument();
    expect(screen.getByText(/Minimum withdrawal: €10/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'TERMS' })).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('link', { name: 'PRIVACY' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'RULES' })).toHaveAttribute('href', '/rules');
    expect(screen.getByTestId('public-layout')).toBeInTheDocument();
    expect(screen.getByTestId('figma-footer')).toBeInTheDocument();
    expect(container.innerHTML).not.toContain('#FFC805');
    expect(container.innerHTML).not.toContain('#121212');
  });

  it('renders Privacy with the shared Figma shell and navigation', () => {
    const { container } = renderLegalPage(<Privacy />);

    expect(screen.getByRole('heading', { name: 'PRIVACY POLICY' })).toBeInTheDocument();
    expect(screen.getByText(/How OleBoy Token collects, uses and protects personal data/i)).toBeInTheDocument();
    expect(screen.getByText(/This Privacy Policy explains how OleBoy Token collects/i)).toBeInTheDocument();
    expect(screen.getByText(/Data Controller: Marco Palumbo/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'PRIVACY' })).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('link', { name: 'TERMS' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: 'RULES' })).toHaveAttribute('href', '/rules');
    expect(screen.getByTestId('public-layout')).toBeInTheDocument();
    expect(screen.getByTestId('figma-footer')).toBeInTheDocument();
    expect(container.innerHTML).not.toContain('#FFC805');
    expect(container.innerHTML).not.toContain('#121212');
  });
});

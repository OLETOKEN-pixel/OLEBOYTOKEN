import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { HomeNotRegistered } from '@/components/home/HomeNotRegistered';
import { NavbarFigma } from '@/components/layout/NavbarFigma';

const mocks = vi.hoisted(() => ({
  startDiscordAuth: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: mocks.toastError,
  },
}));

vi.mock('@/lib/oauth', () => ({
  getCurrentPathWithQueryAndHash: () => '/mobile-test',
  startDiscordAuth: mocks.startDiscordAuth,
}));

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

describe('HomeNotRegistered mobile guest landing', () => {
  afterEach(() => {
    mocks.startDiscordAuth.mockClear();
    mocks.toastError.mockClear();
    setViewportWidth(1024);
  });

  it('renders the dedicated mobile home below the existing mobile breakpoint', () => {
    setViewportWidth(390);

    const { container } = render(<HomeNotRegistered />);

    expect(container.querySelector('[data-mobile-home="guest"]')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'OLEBOY' })).toBeInTheDocument();
    expect(screen.getAllByText((_, node) => node?.textContent?.includes('Stake tokens. Win Matches.') ?? false).length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, node) => node?.textContent?.includes('Claim your victory.') ?? false).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'RANK UP!' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'JOIN THE ARENA!' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'GET REWARDS!' })).toBeInTheDocument();
  });

  it('keeps only the controlled local Figma assets on the mobile composition', () => {
    setViewportWidth(375);

    const { container } = render(<HomeNotRegistered />);
    const srcs = Array.from(container.querySelectorAll('img')).map((img) => img.getAttribute('src'));

    expect(srcs).toContain('/figma-assets/figma-neon.png');
    expect(srcs).toContain('/figma-assets/figma-animation.svg');
    expect(srcs).toContain('/figma-assets/figma-animation-s3.svg');
    expect(srcs).not.toContain('/figma-assets/figma-zaps.svg');
    expect(srcs).not.toContain('/figma-assets/figma-guide.svg');
    expect(srcs).not.toContain('/figma-assets/figma-spaccato-title-s2.svg');
    expect(srcs).not.toContain('/figma-assets/figma-spaccato-title-s4.svg');
    expect(srcs).not.toContain('/figma-assets/figma-star-shape.svg');
    expect(srcs).not.toContain('/figma-assets/figma-star-s3.svg');
    expect(srcs).not.toContain('/figma-assets/figma-vector19.svg');
    expect(srcs).not.toContain('/figma-assets/figma-spaccato-bottom.svg');
    expect(srcs.some((src) => src?.startsWith('https://www.figma.com/api/mcp/'))).toBe(false);
  });

  it('keeps mobile signup wired to the Discord auth start flow', () => {
    setViewportWidth(390);

    render(<HomeNotRegistered />);
    const signUpButton = screen.getByRole('button', { name: /sign up/i });

    expect(signUpButton.style.whiteSpace).toBe('nowrap');
    expect(signUpButton.style.width).toBe('210px');

    fireEvent.click(signUpButton);

    expect(mocks.startDiscordAuth).toHaveBeenCalledTimes(1);
    expect(mocks.startDiscordAuth).toHaveBeenCalledWith('/mobile-test');
  });

  it('marks the mobile layout roots as horizontally clipped to prevent page overflow', () => {
    setViewportWidth(320);

    const { container } = render(<HomeNotRegistered />);
    const root = container.querySelector('[data-mobile-home="guest"]') as HTMLElement;
    const sections = Array.from(container.querySelectorAll('[data-mobile-section]')) as HTMLElement[];

    expect(root.style.maxWidth).toBe('100vw');
    expect(root.style.overflowX).toBe('hidden');
    expect(sections.length).toBeGreaterThanOrEqual(5);
    expect(sections.every((section) => section.style.maxWidth === '100vw')).toBe(true);
  });
});

describe('NavbarFigma mobile guest navigation', () => {
  afterEach(() => {
    mocks.startDiscordAuth.mockClear();
    mocks.toastError.mockClear();
    setViewportWidth(1024);
  });

  it('renders a compact guest navbar with the three social icons below the mobile breakpoint', () => {
    setViewportWidth(390);

    const { container } = render(
      <MemoryRouter>
        <NavbarFigma />
      </MemoryRouter>,
    );

    expect(container.querySelector('[data-mobile-navbar="guest"]')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /sign up/i })).toBeNull();
    expect(screen.getByRole('link', { name: 'X/Twitter' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'TikTok' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Discord' })).toBeInTheDocument();
  });

  it('opens the mobile menu with the guest links', () => {
    setViewportWidth(390);

    const { container } = render(
      <MemoryRouter>
        <NavbarFigma />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));

    expect(container.querySelector('[data-mobile-navbar-menu="guest"]')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'MEET OBT' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'matches' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ladder' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'highlights' })).toBeInTheDocument();
  });
});

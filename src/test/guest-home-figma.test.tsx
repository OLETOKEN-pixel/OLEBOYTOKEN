import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HomeNotRegistered } from '@/components/home/HomeNotRegistered';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('@/lib/oauth', () => ({
  getCurrentPathWithQueryAndHash: () => '/',
  startDiscordAuth: vi.fn(),
}));

describe('HomeNotRegistered Figma guest landing', () => {
  it('renders the Figma hero copy without the removed oversized brand logo', () => {
    const { container } = render(<HomeNotRegistered />);

    expect(screen.getAllByText('OLEBOY').length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, node) => node?.textContent?.includes('Stake tokens. Win Matches.') ?? false).length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, node) => node?.textContent?.includes('Claim your victory.') ?? false).length).toBeGreaterThan(0);
    expect(container.querySelector('img[src="/figma-assets/oleboy-logo-transparent.png"]')).toBeNull();
  });

  it('uses local Figma assets for the section chrome', () => {
    const { container } = render(<HomeNotRegistered />);
    const srcs = Array.from(container.querySelectorAll('img')).map((img) => img.getAttribute('src'));

    expect(srcs).toContain('/figma-assets/figma-zaps.svg');
    expect(srcs).toContain('/figma-assets/figma-spaccato-title-s2.svg');
    expect(srcs).toContain('/figma-assets/figma-spaccato-title-s4.svg');
    expect(container.querySelector('[data-figma-outline="rank"]')).not.toBeNull();
    expect(container.querySelector('[data-figma-outline="arena"]')).not.toBeNull();
    expect(container.querySelector('[data-figma-outline="rewards"]')).not.toBeNull();
    expect(srcs.some((src) => src?.startsWith('https://www.figma.com/api/mcp/'))).toBe(false);
  });

  it('uses round custom dots for the section title exclamation marks', () => {
    const { container } = render(<HomeNotRegistered />);
    const bangs = container.querySelectorAll('[data-figma-bang="true"]');
    const dots = container.querySelectorAll('[data-figma-bang-dot="true"]');

    expect(bangs).toHaveLength(3);
    expect(dots).toHaveLength(3);
    dots.forEach((dot) => {
      expect((dot as HTMLElement).style.borderRadius).toBe('999px');
    });
  });

  it('keeps title outlines capped at each exclamation mark', () => {
    const { container } = render(<HomeNotRegistered />);
    const rank = container.querySelector('[data-figma-outline="rank"]') as SVGElement | null;
    const arena = container.querySelector('[data-figma-outline="arena"]') as SVGElement | null;
    const rewards = container.querySelector('[data-figma-outline="rewards"]') as SVGElement | null;

    expect(rank?.style.width).toBe('calc(4% + 519.2px)');
    expect(arena?.style.width).toBe('1068px');
    expect(rewards?.style.width).toBe('calc(4% + 861px)');
  });
});

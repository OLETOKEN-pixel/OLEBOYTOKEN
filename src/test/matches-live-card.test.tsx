import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MatchesLiveCard } from '@/components/matches/MatchesLiveCard';

describe('MatchesLiveCard', () => {
  it('renders the page variant as the fixed Figma token tab', () => {
    const { container } = render(
      <MatchesLiveCard
        title="BOX FIGHT"
        firstTo="5+2"
        platform="PS5"
        entryFee="0.75"
        prize="1.40"
        expiresIn="23:00"
        onAccept={() => {}}
        variant="page"
      />,
    );

    const card = container.querySelector('article') as HTMLElement;
    const acceptButton = screen.getByRole('button', { name: 'Accept token' });
    const srcs = Array.from(container.querySelectorAll('img')).map((img) => img.getAttribute('src'));

    expect(card.className).toContain('h-[400px]');
    expect(card.className).toContain('w-[300px]');
    expect(card.className).toContain('rounded-[8px]');
    expect(acceptButton.className).toContain('left-[26px]');
    expect(acceptButton.className).toContain('top-[335px]');
    expect(acceptButton.className).toContain('h-[44px]');
    expect(acceptButton.className).toContain('w-[247px]');
    expect(srcs).toContain('/figma-assets/matches-card-divider.svg');
    expect(srcs).toContain('/figma-assets/matches-first-to-triangles.svg');
    expect(srcs).toContain('/figma-assets/matches-entry-dot.svg');
    expect(srcs).toContain('/figma-assets/matches-prize-icon.svg');
    expect(srcs).toContain('/figma-assets/matches-expiry-dot.svg');
  });
});

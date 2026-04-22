import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FooterSection } from '@/components/home/sections/FooterSection';
import { ShopSection } from '@/components/home/sections/ShopSection';
import { TeamsSection } from '@/components/home/sections/TeamsSection';

const { limitMock, orderMock, selectMock, fromMock, rpcMock } = vi.hoisted(() => {
  const limitMock = vi.fn();
  const orderMock = vi.fn(() => ({ limit: limitMock }));
  const selectMock = vi.fn(() => ({ order: orderMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));
  const rpcMock = vi.fn();

  return { limitMock, orderMock, selectMock, fromMock, rpcMock };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
  },
}));

const getImageSources = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('img'))
    .map((img) => img.getAttribute('src'))
    .filter((src): src is string => Boolean(src));

const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe('logged home section assets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limitMock.mockResolvedValue({ data: [], error: null });
    rpcMock.mockResolvedValue({ data: { success: true, teams: [] }, error: null });
  });

  it('uses stable local decorative assets in TeamsSection', async () => {
    const { container } = renderWithRouter(<TeamsSection />);
    const srcs = getImageSources(container);

    expect(srcs).toContain('/figma-assets/teams-spaccato-title.svg');
    expect(srcs).not.toContain('/figma-assets/figma-spaccato-title1.svg');
    expect(srcs).toContain('/figma-assets/figma-star-shape.svg');
    expect(srcs).toContain('/figma-assets/figma-arrow-stroke.svg');
    expect(srcs).toContain('/figma-assets/figma-bw-arrow.svg');
    expect(srcs).toContain('/figma-assets/figma-fw-arrow.svg');
    expect(srcs.some((src) => src.includes('https://www.figma.com/api/mcp/asset/'))).toBe(false);
    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith('get_teams_page', {
        p_search: '',
        p_limit: 3,
        p_offset: 0,
      });
    });
  });

  it('keeps ShopSection showreel assets local and removes expiring Figma asset URLs', () => {
    const { container } = renderWithRouter(<ShopSection />);
    const srcs = getImageSources(container);

    expect(srcs).toContain('/figma-assets/shop-spaccato-title.svg');
    expect(srcs).not.toContain('/figma-assets/figma-spaccato-title1.svg');
    expect(srcs).toContain('/figma-assets/figma-star-shape.svg');
    expect(srcs).toContain('/figma-assets/figma-arrow-stroke.svg');
    expect(srcs).toContain('/figma-assets/figma-bw-arrow.svg');
    expect(srcs).toContain('/figma-assets/figma-fw-arrow.svg');
    expect(srcs).toContain('/shop/tappetino.png');
    expect(srcs).toContain('/shop/mouse.webp');
    expect(srcs).toContain('/showreel/vip-icon.svg');
    expect(srcs.some((src) => src.includes('https://www.figma.com/api/mcp/asset/'))).toBe(false);
  });

  it('aligns the logged-home footer copyright and prevents wordmark edge clipping', () => {
    const { container } = render(<FooterSection />);
    const copyright = container.querySelector('[data-footer-copyright="true"]') as HTMLElement;
    const wordmarks = Array.from(container.querySelectorAll('p[aria-hidden="true"]')) as HTMLElement[];
    const srcs = getImageSources(container);

    expect(srcs).not.toContain('/figma-assets/figma-copyright.png');
    expect(copyright.style.display).toBe('flex');
    expect(copyright.style.alignItems).toBe('baseline');
    expect(copyright.style.lineHeight).toBe('30px');
    expect(wordmarks).toHaveLength(2);
    expect(wordmarks.every((wordmark) => wordmark.style.paddingRight === '32px')).toBe(true);
  });
});

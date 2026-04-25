import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FooterSection } from '@/components/home/sections/FooterSection';
import { ShopSection } from '@/components/home/sections/ShopSection';
import { TeamsSection } from '@/components/home/sections/TeamsSection';

function buildThenableQuery(result: { data: unknown; error: unknown }) {
  const chain: any = {};
  const returnChain = () => chain;

  chain.select = vi.fn(returnChain);
  chain.eq = vi.fn(returnChain);
  chain.order = vi.fn(returnChain);
  chain.limit = vi.fn(returnChain);
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.maybeSingle = vi.fn(() => Promise.resolve(result));
  chain.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);

  return chain;
}

const { fromMock, rpcMock, channelMock, removeChannelMock } = vi.hoisted(() => {
  const fromMock = vi.fn((table: string) => {
    const result =
      table === 'shop_level_rewards'
        ? { data: [], error: null }
        : { data: [], error: null };

    return buildThenableQuery(result);
  });
  const rpcMock = vi.fn();
  const channelMock = vi.fn(() => {
    const channel: any = {};
    channel.on = vi.fn(() => channel);
    channel.subscribe = vi.fn(() => ({ id: 'shop-level-rewards-channel' }));
    return channel;
  });
  const removeChannelMock = vi.fn();

  return { fromMock, rpcMock, channelMock, removeChannelMock };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
    channel: channelMock,
    removeChannel: removeChannelMock,
  },
}));

const getImageSources = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('img'))
    .map((img) => img.getAttribute('src'))
    .filter((src): src is string => Boolean(src));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

const renderWithRouter = (ui: React.ReactElement) => render(ui, { wrapper: createWrapper() });

describe('logged home section assets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('keeps ShopSection showreel assets local and removes expiring Figma asset URLs', async () => {
    const { container } = renderWithRouter(<ShopSection />);

    await waitFor(() => {
      expect(container.querySelector('img[src="/shop/tappetino.png"]')).not.toBeNull();
      expect(container.querySelector('img[src="/shop/mouse.webp"]')).not.toBeNull();
    });

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

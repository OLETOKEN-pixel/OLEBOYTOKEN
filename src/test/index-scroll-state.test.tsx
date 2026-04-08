import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Index from '@/pages/Index';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    profile: { discord_display_name: 'Tester' },
  }),
}));

vi.mock('@/components/layout/PublicLayout', () => ({
  PublicLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/home/HomeRegistered', () => ({
  HomeRegistered: () => (
    <div>
      <div id="s-matches">Matches section</div>
      <div id="s-shop">Shop section</div>
    </div>
  ),
}));

vi.mock('@/components/home/HomeNotRegistered', () => ({
  HomeNotRegistered: () => <div>Guest home</div>,
}));

describe('Index scroll state handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('scrolls to the requested logged-home section when arriving from a standalone page', async () => {
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });
    const cancelAnimationFrameSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    render(
      <MemoryRouter initialEntries={[{ pathname: '/', state: { scrollTo: 's-shop' } }]}>
        <Routes>
          <Route path="/" element={<Index />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(scrollToSpy).toHaveBeenCalled();
    });

    expect(requestAnimationFrameSpy).toHaveBeenCalled();
    expect(cancelAnimationFrameSpy).toHaveBeenCalled();
  });
});

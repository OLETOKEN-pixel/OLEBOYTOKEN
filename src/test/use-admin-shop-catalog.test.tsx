import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdminShopCatalog } from '@/hooks/useAdminShopCatalog';

const { rpcMock, useAdminStatusMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  useAdminStatusMock: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

vi.mock('@/hooks/useAdminStatus', () => ({
  useAdminStatus: useAdminStatusMock,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useAdminShopCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAdminStatusMock.mockReturnValue({
      user: null,
      authLoading: false,
      isAdmin: false,
      isLoading: false,
    });
    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === 'get_shop_catalog') {
        return {
          data: {},
          error: null,
        };
      }

      return {
        data: null,
        error: null,
      };
    });
  });

  it('mirrors the public catalog instead of returning an empty workspace while admin access is unavailable', async () => {
    const { result } = renderHook(() => useAdminShopCatalog(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.publicDigitalCards).toHaveLength(5);
    });

    expect(result.current.walletOffers).toHaveLength(2);
    expect(result.current.realItems).toHaveLength(2);
    expect(result.current.workspaceSource).toBe('public_catalog_projection');
    expect(result.current.adminBackendAvailable).toBe(false);
    expect(rpcMock).toHaveBeenCalledWith('get_shop_catalog');
    expect(rpcMock).not.toHaveBeenCalledWith('admin_get_shop_workspace', expect.anything());
  });

  it('falls back to the hardcoded catalog when get_shop_catalog itself returns a 404', async () => {
    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === 'get_shop_catalog') {
        return {
          data: null,
          error: {
            code: 'PGRST202',
            message: 'Could not find the function public.get_shop_catalog without parameters in the schema cache',
          },
        };
      }
      return { data: null, error: null };
    });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useAdminShopCatalog(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.publicDigitalCards).toHaveLength(5);
    });

    expect(result.current.walletOffers).toHaveLength(2);
    expect(result.current.realItems).toHaveLength(2);
    expect(result.current.workspaceSource).toBe('public_catalog_projection');
    expect(result.current.adminBackendAvailable).toBe(false);

    consoleErrorSpy.mockRestore();
  });

  it('still surfaces the public catalog for admins when admin_get_shop_workspace is missing', async () => {
    useAdminStatusMock.mockReturnValue({
      user: { id: 'admin-user' },
      authLoading: false,
      isAdmin: true,
      isLoading: false,
    });

    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === 'admin_get_shop_workspace') {
        return {
          data: null,
          error: {
            code: 'PGRST202',
            message: 'Could not find the function public.admin_get_shop_workspace(p_workspace) in the schema cache',
          },
        };
      }
      if (fn === 'get_shop_catalog') {
        return { data: {}, error: null };
      }
      return { data: null, error: null };
    });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useAdminShopCatalog(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.publicDigitalCards).toHaveLength(5);
    });

    expect(result.current.realItems).toHaveLength(2);
    expect(result.current.adminBackendAvailable).toBe(false);
    expect(result.current.workspaceSource).toBe('public_catalog_projection');

    consoleErrorSpy.mockRestore();
  });
});

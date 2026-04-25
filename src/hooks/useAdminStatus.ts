import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export function useAdminStatus() {
  const { user, loading: authLoading } = useAuth();

  const query = useQuery({
    queryKey: ['admin-status', user?.id],
    queryFn: async () => {
      if (!user) return false;

      const { data, error } = await supabase.rpc('is_admin');

      if (error) {
        console.error('Error checking admin status:', error);
        return false;
      }

      return Boolean(data);
    },
    enabled: Boolean(user) && !authLoading,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    user,
    authLoading,
    isAdmin: query.data ?? false,
    isLoading: authLoading || (Boolean(user) && query.isLoading),
  };
}

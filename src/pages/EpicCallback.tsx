import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { LoadingPage } from '@/components/common/LoadingSpinner';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const PROFILE_GAME_ROUTE = '/profile?tab=game';

export default function EpicCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading, refreshProfile } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      if (loading) {
        return;
      }

      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      console.log('[EpicCallback] Received params:', { 
        hasCode: !!code, 
        hasState: !!state, 
        error,
        errorDescription 
      });

      // Handle user cancellation or error from Epic
      if (error) {
        toast.error(errorDescription || 'Epic Games connection canceled.');
        navigate(PROFILE_GAME_ROUTE, { replace: true });
        return;
      }

      // Validate required params
      if (!code || !state) {
        toast.error('Missing Epic Games authorization parameters. Please try again.');
        navigate(PROFILE_GAME_ROUTE, { replace: true });
        return;
      }

      // Check if user is authenticated
      if (!user) {
        toast.error('Session expired. Please log in and try again.');
        navigate(`/auth?next=${encodeURIComponent(PROFILE_GAME_ROUTE)}`, { replace: true });
        return;
      }

      try {
        console.log('[EpicCallback] Calling epic-auth-callback edge function');
        
        const { data, error: invokeError } = await supabase.functions.invoke('epic-auth-callback', {
          body: { code, state }
        });

        console.log('[EpicCallback] Edge function response:', { data, error: invokeError });

        if (invokeError) {
          throw new Error(invokeError.message || 'Connection error');
        }

        if (!data?.success) {
          throw new Error(data?.error || 'Connection failed');
        }

        // Refresh profile to get updated epic_username
        await refreshProfile();
        
        toast.success(`Epic Games connected: ${data.epicUsername}`);
        navigate(PROFILE_GAME_ROUTE, { replace: true });
      } catch (err: unknown) {
        console.error('[EpicCallback] Error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        toast.error(message || 'Epic Games connection failed.');
        navigate(PROFILE_GAME_ROUTE, { replace: true });
      }
    };

    handleCallback();
  }, [loading, navigate, refreshProfile, searchParams, user]);

  return (
    <PublicLayout>
      <section className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(118,12,38,0.24),transparent_30%),linear-gradient(180deg,#160406_0%,#090203_100%)] px-4 pb-24 pt-[148px] lg:px-8 lg:pt-[168px]">
        <LoadingPage />
      </section>
    </PublicLayout>
  );
}

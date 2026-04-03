import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { LoadingPage } from '@/components/common/LoadingSpinner';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const PROFILE_CONNECTIONS_ROUTE = '/profile?tab=connections';

export default function TwitterCallback() {
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

      console.log('[TwitterCallback] Received params:', {
        hasCode: !!code,
        hasState: !!state,
        error,
        errorDescription,
      });

      if (error) {
        toast.error(errorDescription || 'X (Twitter) connection canceled.');
        navigate(PROFILE_CONNECTIONS_ROUTE, { replace: true });
        return;
      }

      if (!code || !state) {
        toast.error('Missing X (Twitter) authorization parameters. Please try again.');
        navigate(PROFILE_CONNECTIONS_ROUTE, { replace: true });
        return;
      }

      if (!user) {
        toast.error('Session expired. Please log in and try again.');
        navigate(`/auth?next=${encodeURIComponent(PROFILE_CONNECTIONS_ROUTE)}`, { replace: true });
        return;
      }

      try {
        console.log('[TwitterCallback] Calling twitter-auth-callback edge function');

        const { data, error: invokeError } = await supabase.functions.invoke('twitter-auth-callback', {
          body: { code, state },
        });

        console.log('[TwitterCallback] Edge function response:', { data, error: invokeError });

        if (invokeError) {
          throw new Error(invokeError.message || 'Connection error');
        }

        if (!data?.success) {
          throw new Error(data?.error || 'Connection failed');
        }

        await refreshProfile();

        toast.success(`X (Twitter) connected: @${data.twitterUsername}`);
        navigate(PROFILE_CONNECTIONS_ROUTE, { replace: true });
      } catch (err: unknown) {
        console.error('[TwitterCallback] Error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        toast.error(message || 'X (Twitter) connection failed.');
        navigate(PROFILE_CONNECTIONS_ROUTE, { replace: true });
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

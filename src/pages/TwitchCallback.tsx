import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { LoadingPage } from '@/components/common/LoadingSpinner';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const PROFILE_CONNECTIONS_ROUTE = '/profile?tab=connections';

export default function TwitchCallback() {
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

      console.log('[TwitchCallback] Received params:', {
        hasCode: !!code,
        hasState: !!state,
        error,
        errorDescription,
      });

      if (error) {
        toast.error(errorDescription || 'Twitch connection canceled.');
        navigate(PROFILE_CONNECTIONS_ROUTE, { replace: true });
        return;
      }

      if (!code || !state) {
        toast.error('Missing Twitch authorization parameters. Please try again.');
        navigate(PROFILE_CONNECTIONS_ROUTE, { replace: true });
        return;
      }

      if (!user) {
        toast.error('Session expired. Please log in and try again.');
        navigate(`/auth?next=${encodeURIComponent(PROFILE_CONNECTIONS_ROUTE)}`, { replace: true });
        return;
      }

      try {
        console.log('[TwitchCallback] Calling twitch-auth-callback edge function');

        const { data, error: invokeError } = await supabase.functions.invoke('twitch-auth-callback', {
          body: { code, state },
        });

        console.log('[TwitchCallback] Edge function response:', { data, error: invokeError });

        if (invokeError) {
          throw new Error(invokeError.message || 'Connection error');
        }

        if (!data?.success) {
          throw new Error(data?.error || 'Connection failed');
        }

        await refreshProfile();

        toast.success(`Twitch connected: ${data.twitchUsername}`);
        navigate(PROFILE_CONNECTIONS_ROUTE, { replace: true });
      } catch (err: unknown) {
        console.error('[TwitchCallback] Error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        toast.error(message || 'Twitch connection failed.');
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

import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function DiscordCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (errorParam) {
          console.error('[Discord Auth] Error from Discord:', errorParam, errorDescription);
          toast.error(errorDescription || 'Discord authorization failed.');
          navigate('/', { replace: true });
          return;
        }

        if (!code || !state) {
          // Check if already logged in
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            navigate('/', { replace: true });
            return;
          }
          console.error('[Discord Auth] Missing code or state params');
          toast.error('Missing authorization parameters. Please try again.');
          navigate('/', { replace: true });
          return;
        }

        console.info('[Discord Auth] Exchanging code for session...');

        const { data, error } = await supabase.functions.invoke('discord-auth-callback', {
          body: { code, state },
        });

        if (error) {
          console.error('[Discord Auth] Edge function error:', error);
          toast.error('Login failed. Please try again.');
          navigate('/', { replace: true });
          return;
        }

        if (data?.error) {
          console.error('[Discord Auth] Auth error:', data.error);
          toast.error(data.error);
          navigate('/', { replace: true });
          return;
        }

        if (!data?.accessToken || !data?.refreshToken) {
          console.error('[Discord Auth] No session tokens returned');
          toast.error('Session not created. Please try again.');
          navigate('/', { replace: true });
          return;
        }

        console.info('[Discord Auth] Setting session...');
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.accessToken,
          refresh_token: data.refreshToken,
        });

        if (sessionError) {
          console.error('[Discord Auth] Session set error:', sessionError);
          toast.error('Session error. Please try again.');
          navigate('/', { replace: true });
          return;
        }

        console.info('[Discord Auth] Login successful!');
        toast.success('Login successful!');

        const storedRedirect = localStorage.getItem('auth_redirect') || '/';
        localStorage.removeItem('auth_redirect');
        navigate(storedRedirect, { replace: true });
      } catch (err) {
        console.error('[Discord Auth] Unexpected error:', err);
        toast.error('Connection error. Please try again.');
        navigate('/', { replace: true });
      }
    };

    handleCallback();
  }, [navigate, searchParams]);

  // Fullscreen loading spinner matching site theme
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]">
      <div className="text-center">
        <div className="w-10 h-10 mx-auto rounded-full border-2 border-[#FFC805] border-t-transparent animate-spin" />
        <p className="mt-4 text-sm text-white/40">Connecting to Discord...</p>
      </div>
    </div>
  );
}

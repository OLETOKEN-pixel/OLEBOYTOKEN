import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { extractFunctionErrorInfo } from '@/lib/oauth';

export default function DiscordCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const goHome = (msg?: string) => {
        if (msg) toast.error(msg);
        navigate('/', { replace: true });
      };

      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (errorParam) {
          console.error('[Discord Auth] Discord error:', errorParam, errorDescription);
          goHome(errorDescription || 'Discord authorization failed.');
          return;
        }

        if (!code || !state) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            navigate('/', { replace: true });
            return;
          }
          console.error('[Discord Auth] Missing code or state');
          goHome('Missing authorization parameters. Please try again.');
          return;
        }

        console.info('[Discord Auth] Exchanging code for session...', {
          codeLength: code.length,
          statePrefix: state.substring(0, 8),
        });

        const { data, error } = await supabase.functions.invoke('discord-auth-callback', {
          body: { code, state },
        });

        if (error) {
          const info = await extractFunctionErrorInfo(error, 'Login failed. Please try again.');
          console.error('[Discord Auth] Edge function error:', {
            message: info.message,
            details: info.details,
            code: info.code,
            requestId: info.requestId,
            error,
          });
          goHome(info.message);
          return;
        }

        if (data?.error) {
          console.error('[Discord Auth] Auth error from function:', {
            message: data.error,
            details: data.details ?? null,
            code: data.code ?? null,
          });
          goHome(data.error);
          return;
        }

        if (!data?.accessToken || !data?.refreshToken) {
          console.error('[Discord Auth] No tokens returned. Data:', JSON.stringify(data));
          goHome('Session not created. Please try again.');
          return;
        }

        console.info('[Discord Auth] Setting session...');
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.accessToken,
          refresh_token: data.refreshToken,
        });

        if (sessionError) {
          console.error('[Discord Auth] setSession error:', sessionError);
          goHome('Session error. Please try again.');
          return;
        }

        console.info('[Discord Auth] Login successful!');
        toast.success('Login successful!');

        const storedRedirect = data?.redirectTo || localStorage.getItem('auth_redirect') || '/';
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]">
      <div className="text-center">
        <div className="w-10 h-10 mx-auto rounded-full border-2 border-[#FFC805] border-t-transparent animate-spin" />
        <p className="mt-4 text-sm text-white/40">Connecting to Discord...</p>
      </div>
    </div>
  );
}

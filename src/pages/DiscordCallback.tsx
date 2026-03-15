import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import logoOleboy from '@/assets/logo-oleboy.png';

type CallbackStatus = 'loading' | 'success' | 'error';

export default function DiscordCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [status, setStatus] = useState<CallbackStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get code and state from URL query params (Discord OAuth redirect)
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (errorParam) {
          setStatus('error');
          setErrorMessage(errorDescription || 'Errore durante l\'autorizzazione Discord');
          return;
        }

        if (!code || !state) {
          setStatus('error');
          setErrorMessage('Parametri di autorizzazione mancanti. Riprova il login.');
          return;
        }

        console.info('[Discord Auth] Exchanging code for session via edge function...');

        // Send code+state to the edge function which:
        // 1. Exchanges code for Discord token
        // 2. Auto-joins the user to the Discord server (server-side)
        // 3. Creates/updates the user and returns session tokens
        const { data, error } = await supabase.functions.invoke('discord-auth-callback', {
          body: { code, state },
        });

        if (error) {
          console.error('[Discord Auth] Edge function error:', error);
          setStatus('error');
          setErrorMessage('Errore durante il login. Riprova.');
          return;
        }

        if (data?.error) {
          console.error('[Discord Auth] Auth error:', data.error);
          setStatus('error');
          setErrorMessage(data.error);
          return;
        }

        if (!data?.accessToken || !data?.refreshToken) {
          console.error('[Discord Auth] No session tokens returned');
          setStatus('error');
          setErrorMessage('Sessione non creata. Riprova il login.');
          return;
        }

        // Set the Supabase session with the tokens from the edge function
        console.info('[Discord Auth] Setting session...');
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.accessToken,
          refresh_token: data.refreshToken,
        });

        if (sessionError) {
          console.error('[Discord Auth] Session set error:', sessionError);
          setStatus('error');
          setErrorMessage('Errore nella creazione della sessione. Riprova.');
          return;
        }

        console.info('[Discord Auth] Login successful!');
        setStatus('success');
        toast({
          title: 'Benvenuto!',
          description: 'Login con Discord completato con successo',
        });

        const storedRedirect = localStorage.getItem('auth_redirect') || data.redirectTo || '/';
        localStorage.removeItem('auth_redirect');

        setTimeout(() => {
          navigate(storedRedirect, { replace: true });
        }, 500);
      } catch (err) {
        console.error('Discord callback error:', err);
        setStatus('error');
        setErrorMessage('Errore di connessione. Riprova.');
      }
    };

    handleCallback();
  }, [navigate, searchParams, toast]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="fixed inset-0 gradient-radial opacity-20 pointer-events-none" />

      {status === 'loading' && (
        <div className="text-center">
          <img
            src={logoOleboy}
            alt="OLEBOY TOKEN"
            className="w-16 h-16 mx-auto mb-6"
          />
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Connessione a Discord...</p>
        </div>
      )}

      {status === 'error' && (
        <Card className="w-full max-w-md bg-card border-border">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold mt-4">Errore</h2>
            <p className="text-muted-foreground mt-2">{errorMessage}</p>
            <div className="flex flex-col gap-2 mt-6">
              <Button onClick={() => navigate('/auth')} className="w-full">
                Torna al Login
              </Button>
              <Link
                to="/"
                className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Torna alla Home
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {status === 'success' && (
        <div className="text-center">
          <img
            src={logoOleboy}
            alt="OLEBOY TOKEN"
            className="w-16 h-16 mx-auto mb-6"
          />
          <div className="w-8 h-8 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="mt-4 text-muted-foreground">Login completato! Reindirizzamento...</p>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
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
        // Check for errors in hash (Supabase built-in flow)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const errorParam = hashParams.get('error') || searchParams.get('error');
        const errorDescription = hashParams.get('error_description') || searchParams.get('error_description');

        if (errorParam) {
          setStatus('error');
          setErrorMessage(errorDescription || 'Errore durante l\'autorizzazione Discord');
          return;
        }

        // Custom flow: code + state in query params
        const code = searchParams.get('code');
        const state = searchParams.get('state');

        if (code && state) {
          // Call custom discord-auth-callback edge function
          const { data, error } = await supabase.functions.invoke('discord-auth-callback', {
            body: { code, state },
          });

          if (error || !data?.success) {
            setStatus('error');
            setErrorMessage(data?.error || error?.message || 'Errore durante il login Discord');
            return;
          }

          // Set session from the returned tokens
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: data.accessToken,
            refresh_token: data.refreshToken,
          });

          if (sessionError) {
            setStatus('error');
            setErrorMessage('Errore nella creazione della sessione');
            return;
          }

          setStatus('success');
          toast({
            title: 'Benvenuto!',
            description: 'Login con Discord completato con successo',
          });

          const redirectTo = data.redirectTo || localStorage.getItem('auth_redirect') || '/';
          localStorage.removeItem('auth_redirect');

          setTimeout(() => {
            navigate(redirectTo, { replace: true });
          }, 500);
          return;
        }

        // Fallback: Supabase built-in flow (hash-based tokens)
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession();

        if (sessionErr) {
          console.error('Session error:', sessionErr);
          setStatus('error');
          setErrorMessage('Errore durante la creazione della sessione');
          return;
        }

        if (!session) {
          const maxAttempts = 10;
          let attempts = 0;
          const waitForSession = () => new Promise<boolean>((resolve) => {
            const interval = setInterval(async () => {
              attempts++;
              const { data: { session: s } } = await supabase.auth.getSession();
              if (s) {
                clearInterval(interval);
                resolve(true);
              } else if (attempts >= maxAttempts) {
                clearInterval(interval);
                resolve(false);
              }
            }, 500);
          });

          const gotSession = await waitForSession();
          if (!gotSession) {
            setStatus('error');
            setErrorMessage('Sessione non trovata. Riprova il login.');
            return;
          }
        }

        setStatus('success');
        toast({
          title: 'Benvenuto!',
          description: 'Login con Discord completato con successo',
        });

        const storedRedirect = localStorage.getItem('auth_redirect') || '/';
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
  }, [navigate, toast, searchParams]);

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

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import mascotOleboy from '@/assets/mascot-oleboy.png';

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  );
}

export default function Auth() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile, loading, isProfileComplete } = useAuth();

  const urlRedirect = searchParams.get('next') || '/';
  const storedRedirect = typeof window !== 'undefined' ? localStorage.getItem('auth_redirect') : null;
  const redirectTo = storedRedirect || urlRedirect;

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user && profile && !loading) {
      localStorage.removeItem('auth_redirect');
      if (!isProfileComplete) {
        const profileRedirect = redirectTo !== '/' ? `/profile?next=${encodeURIComponent(redirectTo)}` : '/profile';
        navigate(profileRedirect, { replace: true });
      } else {
        navigate(redirectTo, { replace: true });
      }
    }
  }, [user, profile, loading, isProfileComplete, navigate, redirectTo]);

  const handleDiscordSignIn = async () => {
    setIsSubmitting(true);
    try {
      localStorage.setItem('auth_redirect', redirectTo);
      const currentOrigin = window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo: `${currentOrigin}/auth/discord/callback`,
          scopes: 'identify email guilds.join',
        },
      });
      if (error) {
        throw error;
      }
    } catch (err) {
      console.error('Discord sign-in error:', err);
      toast({
        title: 'Error',
        description: 'Unable to start Discord login. Please try again.',
        variant: 'destructive',
      });
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#FFC805] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse 60% 50% at 50% 45%, rgba(255,200,5,0.06), transparent 70%), #0a0a0a',
      }}
    >
      <Link
        to="/"
        className="absolute top-6 left-6 z-30 flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-xs">Back to home</span>
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="w-full max-w-[420px] mx-6"
      >
        <div className="bg-[#121212]/80 border border-[#1f2937] rounded-[16px] backdrop-blur-sm p-8 lg:p-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="flex justify-center mb-8"
          >
            <img
              src={mascotOleboy}
              alt="OLEBOY TOKEN"
              className="w-[120px] h-[120px] object-contain"
            />
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="text-2xl lg:text-3xl font-bold text-center text-white mb-2"
          >
            Welcome back
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="text-sm text-white/40 text-center mb-10"
          >
            Sign in to continue
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
          >
            <button
              onClick={handleDiscordSignIn}
              disabled={isSubmitting}
              className="w-full py-3.5 px-6 text-[15px] text-white rounded-xl flex items-center justify-center gap-3 transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: '#5865F2',
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <DiscordIcon className="w-5 h-5" />
                  Continue with Discord
                </>
              )}
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.55 }}
            className="flex items-center gap-4 my-8"
          >
            <div className="flex-1 h-px bg-white/[0.08]" />
            <span className="text-xs text-white/25">or</span>
            <div className="flex-1 h-px bg-white/[0.08]" />
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="text-[11px] text-white/25 text-center leading-relaxed"
          >
            By signing in, you agree to our{' '}
            <Link to="/terms" className="text-white/35 hover:text-white/60 underline underline-offset-2 transition-colors">Terms</Link>{' '}
            and{' '}
            <Link to="/privacy" className="text-white/35 hover:text-white/60 underline underline-offset-2 transition-colors">Privacy Policy</Link>
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
}

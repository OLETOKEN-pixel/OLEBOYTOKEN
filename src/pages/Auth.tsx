import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { startDiscordAuth } from '@/lib/oauth';

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;

    const next = searchParams.get('next') || '/';

    void (async () => {
      try {
        await startDiscordAuth(next);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to start Discord login. Please try again.';
        toast.error(message);
        navigate('/', { replace: true });
      }
    })();
  }, [navigate, searchParams]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 rounded-full border-2 border-[#FFC805] border-t-transparent animate-spin" />
        <p className="mt-4 text-sm text-white/40">Redirecting to Discord...</p>
      </div>
    </div>
  );
}

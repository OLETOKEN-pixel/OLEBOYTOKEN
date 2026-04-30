import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';

const TICK_INTERVAL_MS = 15_000;

type TournamentTickResult = {
  auto_opened?: number | null;
  started?: number | null;
  finalized?: number | null;
} | null;

function shouldSkipAutoTick(pathname: string) {
  return pathname.startsWith('/auth/');
}

export function TournamentAutoTick() {
  const queryClient = useQueryClient();
  const { pathname } = useLocation();
  const isRunningRef = useRef(false);

  useEffect(() => {
    if (shouldSkipAutoTick(pathname)) {
      return;
    }

    let disposed = false;

    const runTick = async () => {
      if (disposed || isRunningRef.current) {
        return;
      }

      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }

      isRunningRef.current = true;

      try {
        const { data, error } = await supabase.rpc('tournament_tick');

        if (error) {
          console.warn(`[tournament-auto-tick] ${error.message}`);
          return;
        }

        const result = (data ?? null) as TournamentTickResult;
        const changedCount =
          Number(result?.auto_opened ?? 0) +
          Number(result?.started ?? 0) +
          Number(result?.finalized ?? 0);

        if (changedCount > 0) {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.all }),
            queryClient.invalidateQueries({ queryKey: queryKeys.matches.all }),
          ]);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`[tournament-auto-tick] ${message}`);
      } finally {
        isRunningRef.current = false;
      }
    };

    void runTick();

    const interval = window.setInterval(() => {
      void runTick();
    }, TICK_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (!document.hidden) {
        void runTick();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      disposed = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [pathname, queryClient]);

  return null;
}

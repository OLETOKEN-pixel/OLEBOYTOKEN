import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Swords, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MatchesLiveCard } from '@/components/matches/MatchesLiveCard';
import {
  formatMatchTitle,
  formatFirstTo,
  formatPlatform,
  formatPrize,
  formatEntryFee,
  formatTimeLeft,
} from '@/lib/matchFormatters';
import { supabase } from '@/integrations/supabase/client';
import type { Match } from '@/types';

export function LiveMatchesCompact() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMatches = async () => {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          creator:profiles_public!matches_creator_id_fkey(username, discord_avatar_url, epic_username),
          participants:match_participants(*)
        `)
        .eq('status', 'open')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(3);

      if (!error && data) {
        setMatches(data as unknown as Match[]);
      }
      setLoading(false);
    };

    fetchMatches();

    const channel = supabase
      .channel('matches_home_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
        },
        () => {
          fetchMatches();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="hud-panel-highlight">
      <div className="py-4 px-5 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-3 font-display text-base lg:text-lg font-bold uppercase tracking-wider">
            <span className="neon-dot" />
            <span className="neon-text-cyan">LIVE ARENA</span>
            {matches.length > 0 && (
              <span className="px-2 py-0.5 text-xs font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 animate-pulse">
                {matches.length} OPEN
              </span>
            )}
          </span>
          <Link
            to="/matches"
            className="flex items-center gap-1 text-xs font-display uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors group"
          >
            View All
            <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>

      <div className="px-5 pb-5 pt-4">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-44 w-full bg-white/[0.03]" />
            ))}
          </div>
        ) : matches.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-14">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="relative mb-6"
            >
              <div className="w-20 h-20 flex items-center justify-center hud-panel">
                <Swords className="w-9 h-9 neon-text-cyan" />
              </div>
            </motion.div>
            <h3 className="font-display text-lg font-bold mb-2 neon-text-cyan">NO ACTIVE MATCHES</h3>
            <p className="text-muted-foreground mb-6 max-w-xs text-sm" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
              Be the first to create a competitive match and start earning!
            </p>
            <Link to="/matches/create" className="btn-arena-primary px-6 py-3 flex items-center gap-2 text-xs no-underline">
              <Plus className="w-4 h-4" />
              CREATE MATCH
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {matches.map((match, index) => (
              <motion.div
                key={match.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <Link to={`/matches/${match.id}`} style={{ textDecoration: 'none' }}>
                  <MatchesLiveCard
                    title={formatMatchTitle(match)}
                    firstTo={formatFirstTo(match)}
                    platform={formatPlatform(match.platform)}
                    entryFee={formatEntryFee(match)}
                    prize={formatPrize(match)}
                    expiresIn={formatTimeLeft(match.expires_at, Date.now())}
                  />
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

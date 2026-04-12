import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { CoinDisplay } from '@/components/common/CoinDisplay';
import { PlayerStatsModal } from '@/components/player/PlayerStatsModal';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface WeeklyEntry {
  user_id: string;
  username: string;
  discord_avatar_url: string | null;
  weekly_earned: number;
}

const rankStyles = [
  { color: 'neon-text-gold', ring: 'ring-yellow-500/40', label: '1' },
  { color: 'text-gray-300', ring: 'ring-gray-400/30', label: '2' },
  { color: 'text-amber-600', ring: 'ring-amber-600/30', label: '3' },
];

export function LeaderboardCompact() {
  const [entries, setEntries] = useState<WeeklyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchWeeklyLeaderboard = async () => {
      const { data, error } = await supabase.rpc('get_leaderboard_weekly', {
        p_limit: 5,
      });

      if (!error && data && data.length > 0) {
        setEntries((data as WeeklyEntry[]).map((entry) => ({
          ...entry,
          discord_avatar_url: entry.discord_avatar_url ?? null,
        })));
      } else {
        const { data: fallbackData } = await supabase.rpc('get_leaderboard', {
          p_limit: 5,
          p_offset: 0,
        });
        
        if (fallbackData) {
          setEntries(fallbackData.map(e => ({
            user_id: (e as any).user_id || '',
            username: (e as any).username || '',
            discord_avatar_url: (e as any).discord_avatar_url ?? null,
            weekly_earned: Number((e as any).total_earnings) || 0,
          })));
        }
      }
      setLoading(false);
    };

    fetchWeeklyLeaderboard();
  }, []);

  return (
    <>
      <div className="hud-panel">
        <div className="py-4 px-5 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-3 font-display text-base font-bold uppercase tracking-wider">
              <Trophy className="w-5 h-5 neon-text-gold" />
              <span>TOP WARRIORS</span>
            </span>
            <Link
              to="/leaderboard"
              className="flex items-center gap-1 text-xs font-display uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors group"
            >
              Full Leaderboard
              <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
        
        <div className="px-5 pb-4 pt-3">
          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <Skeleton className="w-8 h-8 rounded-full bg-white/[0.03]" />
                  <Skeleton className="flex-1 h-4 bg-white/[0.03]" />
                  <Skeleton className="w-16 h-4 bg-white/[0.03]" />
                </div>
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Trophy className="w-10 h-10 text-muted-foreground/30 mb-2" />
              <p className="text-center text-muted-foreground text-sm">
                No activity this week. Be the first!
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {entries.slice(0, 5).map((entry, index) => {
                const style = rankStyles[index];

                return (
                  <motion.div
                    key={entry.user_id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.06 }}
                    whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.04)' }}
                    className={cn(
                      'flex items-center gap-3 p-2.5 rounded transition-all duration-200 cursor-pointer group',
                      index < 3 && 'border border-white/[0.04]'
                    )}
                    onClick={() => setSelectedUserId(entry.user_id)}
                  >
                    <div className="w-7 text-center flex-shrink-0">
                      <span className={cn(
                        'text-sm font-bold font-mono',
                        style?.color || 'text-muted-foreground'
                      )}>
                        #{index + 1}
                      </span>
                    </div>

                    <Avatar className={cn(
                      "w-9 h-9 flex-shrink-0 ring-2 ring-offset-1 ring-offset-background transition-all",
                      index < 3 ? style?.ring : "ring-border/50",
                      "group-hover:ring-primary/50"
                    )}>
                      <AvatarImage src={entry.discord_avatar_url ?? undefined} className="object-cover" />
                      <AvatarFallback className="text-xs bg-primary/20 text-primary font-semibold font-display">
                        {entry.username?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <p className="flex-1 font-medium truncate text-sm group-hover:text-primary transition-colors">
                      {entry.username}
                    </p>

                    <CoinDisplay amount={entry.weekly_earned} size="sm" showSign />
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <PlayerStatsModal
        open={!!selectedUserId}
        onOpenChange={(open) => !open && setSelectedUserId(null)}
        userId={selectedUserId || ''}
      />
    </>
  );
}

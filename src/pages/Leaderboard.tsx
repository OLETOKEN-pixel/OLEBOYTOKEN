import { useState, useEffect, lazy, Suspense, Component, type ReactNode } from 'react';
import { Trophy, Search, Crown, ChevronDown, Medal } from 'lucide-react';
import { motion } from 'framer-motion';
import { MainLayout } from '@/components/layout/MainLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CoinDisplay } from '@/components/common/CoinDisplay';
import { PlayerStatsModal } from '@/components/player/PlayerStatsModal';
import { AnimatedNumber } from '@/components/ui/motion';
import { supabase } from '@/integrations/supabase/client';
import type { LeaderboardEntry } from '@/types';
import { cn } from '@/lib/utils';
import { useIsDesktop } from '@/hooks/use-mobile';

const Coin3D = lazy(() => import('@/components/3d/Coin3D'));

class Coin3DErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const isDesktop = useIsDesktop();
  const PAGE_SIZE = 25;

  useEffect(() => {
    fetchLeaderboard(1);
  }, []);

  const fetchLeaderboard = async (pageNum: number) => {
    setLoading(true);
    const from = (pageNum - 1) * PAGE_SIZE;
    const { data, error } = await supabase.rpc('get_leaderboard', {
      p_limit: PAGE_SIZE,
      p_offset: from,
    });

    if (!error && data) {
      if (pageNum === 1) {
        setEntries(data as LeaderboardEntry[]);
      } else {
        setEntries(prev => [...prev, ...(data as LeaderboardEntry[])]);
      }
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoading(false);
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchLeaderboard(nextPage);
  };

  const filteredEntries = searchQuery
    ? entries.filter(e => e.username?.toLowerCase().includes(searchQuery.toLowerCase()))
    : entries;

  const top3 = filteredEntries.slice(0, 3);
  const restEntries = filteredEntries.slice(3);

  const podiumMeta = [
    { label: '1st', borderClass: 'border-[#FFC805]/50', glowClass: 'glow-gold', textClass: 'text-[#FFC805]', bgClass: 'bg-[#FFC805]/5' },
    { label: '2nd', borderClass: 'border-[#9CA3AF]/30', glowClass: '', textClass: 'text-[#9CA3AF]', bgClass: 'bg-[#9CA3AF]/5' },
    { label: '3rd', borderClass: 'border-[#CD7F32]/30', glowClass: '', textClass: 'text-[#CD7F32]', bgClass: 'bg-[#CD7F32]/5' },
  ];

  return (
    <MainLayout>
      <div className="space-y-8 max-w-4xl mx-auto py-4 lg:py-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col lg:flex-row lg:items-end justify-between gap-4"
        >
          <h1 className="text-[36px] font-bold tracking-tight uppercase">
            LEADERBOARD
          </h1>

          <div className="relative w-full lg:w-[320px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--text-secondary))]" />
            <Input
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 h-11 font-mono text-sm input-premium"
            />
          </div>
        </motion.div>

        {!searchQuery && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05, duration: 0.5 }}
            className="flex justify-center"
          >
            <div className="w-[160px] h-[160px] lg:w-[200px] lg:h-[200px]">
              <Coin3DErrorBoundary fallback={
                <div className="w-full h-full rounded-full bg-[hsl(var(--bg-1))] flex items-center justify-center">
                  <Trophy className="w-12 h-12 text-gold" />
                </div>
              }>
                <Suspense fallback={
                  <div className="w-full h-full rounded-full bg-[hsl(var(--bg-1))] flex items-center justify-center">
                    <Trophy className="w-12 h-12 text-gold" />
                  </div>
                }>
                  <Coin3D size={1.8} autoRotate interactive={false} />
                </Suspense>
              </Coin3DErrorBoundary>
            </div>
          </motion.div>
        )}

        {loading && page === 1 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {[0,1,2].map(i => (
                <div key={i} className="h-[220px] skeleton-premium rounded-2xl" />
              ))}
            </div>
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-[64px] skeleton-premium rounded-2xl" />
              ))}
            </div>
          </div>
        ) : entries.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <Trophy className="w-16 h-16 mx-auto text-[hsl(var(--text-tertiary))] mb-6" />
            <p className="text-[hsl(var(--text-secondary))] text-lg">
              No players on the leaderboard yet. Start competing!
            </p>
          </motion.div>
        ) : (
          <>
            {top3.length >= 3 && !searchQuery && (
              <div className="grid grid-cols-3 gap-3 lg:gap-5">
                {[1, 0, 2].map((orderIdx) => {
                  const entry = top3[orderIdx];
                  const meta = podiumMeta[orderIdx];
                  const isFirst = orderIdx === 0;
                  return (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + orderIdx * 0.1, duration: 0.5 }}
                      whileHover={{ y: -4, scale: 1.02 }}
                      className={cn(
                        'bg-[#121212] border border-[#1f2937] rounded-[16px] flex flex-col items-center p-5 lg:p-6 cursor-pointer text-center',
                        meta.borderClass, meta.glowClass, meta.bgClass,
                        isFirst && 'lg:-mt-4'
                      )}
                      onClick={() => entry.user_id && setSelectedUserId(entry.user_id)}
                    >
                      {isFirst && (
                        <Crown className="w-6 h-6 text-gold mb-2" />
                      )}
                      <span className={cn("text-xs font-bold mb-3 px-3 py-1 rounded-full bg-[hsl(var(--bg-2))]", meta.textClass)}>
                        #{orderIdx + 1}
                      </span>
                      <Avatar className={cn(
                        isFirst ? "w-16 h-16 lg:w-20 lg:h-20" : "w-14 h-14 lg:w-16 lg:h-16",
                        "mb-3 ring-2 ring-offset-2 ring-offset-[hsl(var(--bg-0))]",
                        isFirst ? "ring-[#FFC805]/50" : "ring-[#1f2937]"
                      )}>
                        <AvatarImage src={entry.avatar_url ?? undefined} className="object-cover" />
                        <AvatarFallback className="bg-[hsl(var(--bg-2))] font-semibold">{entry.username?.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <p className="text-sm font-semibold truncate w-full mb-2">{entry.username}</p>
                      <div className="flex items-center gap-1 text-xs text-[hsl(var(--text-secondary))] mb-1">
                        <Trophy className="w-3 h-3" />
                        <span className="font-mono font-bold text-[hsl(var(--text-primary))]">{entry.wins}</span>
                        <span>wins</span>
                      </div>
                      <CoinDisplay amount={Number(entry.total_earnings)} size="sm" />
                    </motion.div>
                  );
                })}
              </div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="bg-[#121212] border border-[#1f2937] rounded-[16px] overflow-hidden"
            >
              <div className="border-b border-[#1f2937] py-4 px-5 lg:px-6">
                <h2 className="flex items-center gap-2 font-semibold text-sm">
                  <Medal className="w-4 h-4 text-[hsl(var(--teal))]" />
                  Rankings
                </h2>
              </div>
              <div>
                {isDesktop && (
                  <div className="hidden lg:grid grid-cols-[60px_1fr_100px_140px_100px] gap-4 px-6 py-3 border-b border-[#1f2937] text-xs text-gray-400 uppercase tracking-wider font-medium">
                    <span>Rank</span>
                    <span>Player</span>
                    <span className="text-center">Wins</span>
                    <span className="text-center">Coins Won</span>
                    <span className="text-right">Action</span>
                  </div>
                )}

                <div className="divide-y divide-[#1f2937]/50">
                  {(searchQuery ? filteredEntries : restEntries).map((entry, index) => {
                    const displayRank = searchQuery ? index + 1 : index + 4;

                    return (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(index * 0.02, 0.3), duration: 0.3 }}
                        className={cn(
                          'flex items-center gap-4 lg:grid lg:grid-cols-[60px_1fr_100px_140px_100px] lg:gap-4',
                          'p-4 lg:px-6 lg:py-4 transition-all duration-200 cursor-pointer group',
                          'hover:bg-[hsl(var(--bg-2)/0.5)]',
                        )}
                        onClick={() => entry.user_id && setSelectedUserId(entry.user_id)}
                      >
                        <div className="w-8 lg:w-auto text-center">
                          <span className={cn(
                            "font-mono text-base lg:text-lg font-bold",
                            displayRank <= 10 ? 'text-gold' : 'text-[hsl(var(--text-secondary))]'
                          )}>
                            #{displayRank}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Avatar className="w-10 h-10 lg:w-11 lg:h-11 ring-1 ring-[hsl(var(--border-soft))]">
                            <AvatarImage src={entry.avatar_url ?? undefined} className="object-cover" />
                            <AvatarFallback className="bg-[hsl(var(--bg-2))] text-sm font-semibold">
                              {entry.username?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <p className="font-medium text-sm lg:text-base truncate group-hover:text-gold transition-colors">
                            {entry.username}
                          </p>
                        </div>

                        <div className="hidden lg:flex items-center justify-center">
                          <span className="font-mono font-semibold text-sm">
                            <AnimatedNumber value={entry.wins} />
                          </span>
                        </div>

                        <div className="lg:flex lg:justify-center">
                          <CoinDisplay amount={Number(entry.total_earnings)} size={isDesktop ? 'md' : 'sm'} />
                        </div>

                        <div className="lg:hidden text-xs text-[hsl(var(--text-secondary))] font-mono">
                          {entry.wins}W
                        </div>

                        <div className="hidden lg:flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-4 opacity-0 group-hover:opacity-100 transition-all btn-premium-ghost text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              entry.user_id && setSelectedUserId(entry.user_id);
                            }}
                          >
                            View Stats
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {hasMore && !searchQuery && (
                  <div className="p-6 text-center border-t border-[#1f2937]">
                    <Button
                      size="lg"
                      onClick={loadMore}
                      disabled={loading}
                      className="btn-premium-secondary h-11 px-8"
                    >
                      {loading ? 'Loading...' : (
                        <>
                          <ChevronDown className="w-4 h-4 mr-2" />
                          Load More
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </div>

      <PlayerStatsModal
        open={!!selectedUserId}
        onOpenChange={(open) => !open && setSelectedUserId(null)}
        userId={selectedUserId || ''}
      />
    </MainLayout>
  );
}

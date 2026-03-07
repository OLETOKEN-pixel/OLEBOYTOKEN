import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Gamepad2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { MainLayout } from '@/components/layout/MainLayout';
import { MatchCard } from '@/components/matches/MatchCard';
import { SkeletonPremium } from '@/components/ui/skeleton-premium';
import { PageTransition, StaggerContainer, StaggerItem } from '@/components/ui/motion';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useOpenMatches, type MatchFilters } from '@/hooks/useMatches';
import { REGIONS, PLATFORMS, GAME_MODES, TEAM_SIZES, type Match, type Region, type Platform, type GameMode, type TeamSize } from '@/types';

export default function Matches() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, wallet, isProfileComplete, refreshWallet } = useAuth();
  const [joining, setJoining] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [regionFilter, setRegionFilter] = useState<Region | 'all'>('all');
  const [platformFilter, setPlatformFilter] = useState<Platform | 'all'>('all');
  const [modeFilter, setModeFilter] = useState<GameMode | 'all'>('all');
  const [sizeFilter, setSizeFilter] = useState<TeamSize | 'all'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'entry_fee_high'>('newest');

  const filters: MatchFilters = useMemo(() => ({
    region: regionFilter,
    platform: platformFilter,
    mode: modeFilter,
    size: sizeFilter === 'all' ? 'all' : sizeFilter,
    sortBy: sortBy === 'newest' ? 'newest' : 'entry_fee_high',
    searchQuery: searchQuery,
  }), [regionFilter, platformFilter, modeFilter, sizeFilter, sortBy, searchQuery]);

  const { data: matchesData, isLoading: loading } = useOpenMatches(filters);
  const matches = (matchesData || []) as Match[];

  const getJoinErrorCopy = (reasonCode?: string, fallback?: string) => {
    switch (reasonCode) {
      case 'MATCH_FULL':
        return 'Match pieno.';
      case 'MATCH_NOT_JOINABLE':
        return 'Match non è più joinabile.';
      case 'INSUFFICIENT_BALANCE':
        return 'Fondi insufficienti.';
      case 'ALREADY_IN_ACTIVE_MATCH':
        return 'Hai già un match attivo.';
      case 'NOT_AUTHENTICATED':
        return 'Devi essere autenticato per joinare.';
      default:
        return fallback || 'Impossibile joinare il match.';
    }
  };

  const handleJoin = async (matchId: string) => {
    if (!user || !wallet) {
      navigate('/auth');
      return;
    }

    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    if (!isProfileComplete) {
      toast({
        title: 'Complete your profile',
        description: 'Add your Epic Games Username before joining matches.',
        variant: 'destructive',
      });
      navigate('/profile');
      return;
    }

    if (match.team_size > 1) {
      navigate(`/matches/${matchId}?join=true`);
      return;
    }

    if (wallet.balance < match.entry_fee) {
      toast({
        title: 'Insufficient balance',
        description: 'You need more Coins to join this match.',
        variant: 'destructive',
      });
      navigate('/buy');
      return;
    }

    setJoining(matchId);

    try {
      const { data, error } = await supabase.rpc('join_match', { p_match_id: matchId });
      if (error) throw error;

      const result = data as
        | { success: boolean; reason_code?: string; message?: string; error?: string }
        | null;

      if (!result?.success) {
        const msg = getJoinErrorCopy(result?.reason_code, result?.message || result?.error);
        toast({
          title: 'Impossibile joinare',
          description: msg,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Joined!',
        description: 'You have joined the match. Get ready!',
      });

      await refreshWallet();
      navigate(`/matches/${matchId}`);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to join match',
        variant: 'destructive',
      });
    } finally {
      setJoining(null);
    }
  };

  return (
    <MainLayout>
      <PageTransition>
        <div className="space-y-8">

          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center justify-between pb-6 border-b border-[#1f2937]"
          >
            <h1 className="text-[36px] font-bold tracking-[0.9px]">
              MATCHES
            </h1>
            {user && (
              <Link
                to="/matches/create"
                className="btn-premium inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl"
              >
                <Plus className="w-4 h-4" />
                CREATE MATCH
              </Link>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="flex flex-wrap items-center gap-3"
          >
            <div className="relative flex-1 min-w-[200px] max-w-[320px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search matches..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#1e1e1e] border border-[#374151] rounded-[12px] focus:border-[#FFC805] focus:outline-none transition-colors text-white placeholder-gray-500"
              />
            </div>

            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value as Region | 'all')}
              className="px-3 py-2.5 text-sm min-w-[120px] bg-[#1e1e1e] border border-[#374151] rounded-[12px] focus:border-[#FFC805] focus:outline-none transition-colors text-white"
            >
              <option value="all">All Regions</option>
              {REGIONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value as Platform | 'all')}
              className="px-3 py-2.5 text-sm min-w-[130px] bg-[#1e1e1e] border border-[#374151] rounded-[12px] focus:border-[#FFC805] focus:outline-none transition-colors text-white"
            >
              <option value="all">All Platforms</option>
              {PLATFORMS.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value as GameMode | 'all')}
              className="px-3 py-2.5 text-sm min-w-[120px] bg-[#1e1e1e] border border-[#374151] rounded-[12px] focus:border-[#FFC805] focus:outline-none transition-colors text-white"
            >
              <option value="all">All Modes</option>
              {GAME_MODES.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            <select
              value={String(sizeFilter)}
              onChange={(e) => setSizeFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value) as TeamSize)}
              className="px-3 py-2.5 text-sm min-w-[110px] bg-[#1e1e1e] border border-[#374151] rounded-[12px] focus:border-[#FFC805] focus:outline-none transition-colors text-white"
            >
              <option value="all">All Sizes</option>
              {TEAM_SIZES.map(ts => (
                <option key={ts.value} value={String(ts.value)}>{ts.label}</option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-2.5 text-sm min-w-[120px] bg-[#1e1e1e] border border-[#374151] rounded-[12px] focus:border-[#FFC805] focus:outline-none transition-colors text-white"
            >
              <option value="newest">Newest</option>
              <option value="entry_fee_high">Highest Fee</option>
            </select>
          </motion.div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
                <SkeletonPremium key={i} variant="card" className="h-[180px]" />
              ))}
            </div>
          ) : matches.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-[#121212] border border-[#1f2937] rounded-[16px] p-16 text-center"
            >
              <div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-[#1e1e1e] flex items-center justify-center">
                <Gamepad2 className="w-7 h-7 text-gray-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                No matches available
              </h3>
              <p className="text-sm text-gray-400 mb-8">
                Be the first to create a match and start competing.
              </p>
              {user && (
                <Link
                  to="/matches/create"
                  className="btn-premium inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-xl"
                >
                  <Plus className="w-4 h-4" />
                  CREATE MATCH
                </Link>
              )}
            </motion.div>
          ) : (
            <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {matches.map((match) => (
                <StaggerItem key={match.id}>
                  <MatchCard
                    match={match}
                    onJoin={handleJoin}
                    isJoining={joining === match.id}
                  />
                </StaggerItem>
              ))}
            </StaggerContainer>
          )}
        </div>
      </PageTransition>
    </MainLayout>
  );
}

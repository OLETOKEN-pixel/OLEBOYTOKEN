import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Gamepad2, AlertCircle, Trophy, Target, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { MainLayout } from '@/components/layout/MainLayout';
import { MyMatchCard } from '@/components/matches/MyMatchCard';
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/motion';
import { SkeletonPremium } from '@/components/ui/skeleton-premium';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { Match, MatchStatus } from '@/types';

type StatusFilter = 'all' | 'active' | 'completed';

export default function MyMatches() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');

  useEffect(() => {
    if (!user && !authLoading) {
      navigate(`/auth?next=${encodeURIComponent(location.pathname)}`);
      return;
    }

    if (!user) return;

    const fetchMyMatches = async () => {
      setLoading(true);

      const { data: participantData, error: participantError } = await supabase
        .from('match_participants')
        .select('match_id')
        .eq('user_id', user.id);

      if (participantError || !participantData?.length) {
        setMatches([]);
        setLoading(false);
        return;
      }

      const matchIds = participantData.map(p => p.match_id);

      let query = supabase
        .from('matches')
        .select(`
          *,
          creator:profiles_public!matches_creator_id_fkey(user_id, username, avatar_url, epic_username),
          participants:match_participants(
            *,
            profile:profiles_public(user_id, username, avatar_url, epic_username)
          ),
          result:match_results(*)
        `)
        .in('id', matchIds)
        .not('status', 'eq', 'open');

      const { data, error } = await query;

      if (!error && data) {
        const sorted = (data as unknown as Match[]).sort((a, b) => {
          const activeStatuses: MatchStatus[] = ['ready_check', 'in_progress', 'result_pending', 'disputed'];
          const aActive = activeStatuses.includes(a.status);
          const bActive = activeStatuses.includes(b.status);
          
          if (aActive && !bActive) return -1;
          if (!aActive && bActive) return 1;
          
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        setMatches(sorted);
      }
      setLoading(false);
    };

    fetchMyMatches();
  }, [user, authLoading, navigate, location.pathname]);

  const activeStatuses: MatchStatus[] = ['ready_check', 'in_progress', 'result_pending', 'disputed', 'full'];
  const completedStatuses: MatchStatus[] = ['completed', 'admin_resolved', 'canceled', 'finished'];

  const filteredMatches = matches.filter(match => {
    if (statusFilter === 'active') return activeStatuses.includes(match.status);
    if (statusFilter === 'completed') return completedStatuses.includes(match.status);
    return true;
  });

  const actionRequiredCount = matches.filter(match => {
    const participant = match.participants?.find(p => p.user_id === user?.id);
    if (!participant) return false;
    
    if ((match.status === 'ready_check' || match.status === 'full') && !participant.ready) return true;
    if ((match.status === 'in_progress' || match.status === 'result_pending') && !participant.result_choice) return true;
    
    return false;
  }).length;

  const activeCount = matches.filter(m => activeStatuses.includes(m.status)).length;
  const completedCount = matches.filter(m => completedStatuses.includes(m.status)).length;
  const wonCount = matches.filter(m => m.result?.winner_user_id === user?.id).length;

  if (authLoading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <SkeletonPremium key={i} variant="card" className="h-24" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <SkeletonPremium key={i} variant="card" className="h-[200px]" />
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!user) return null;

  const tabs: { value: StatusFilter; label: string; count?: number }[] = [
    { value: 'active', label: 'Active', count: activeCount },
    { value: 'completed', label: 'Completed', count: completedCount },
    { value: 'all', label: 'All', count: matches.length },
  ];

  return (
    <MainLayout>
      <div className="space-y-8">

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#1f2937]"
        >
          <div>
            <h1 className="text-[36px] font-bold tracking-[0.9px]">
              MY MATCHES
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm text-gray-400">
                Match history and active games
              </p>
              {actionRequiredCount > 0 && (
                <span className="badge-live text-xs font-semibold">
                  <AlertCircle className="w-3 h-3 inline mr-1" />
                  {actionRequiredCount} action required
                </span>
              )}
            </div>
          </div>
          <Link
            to="/matches"
            className="btn-premium-secondary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl"
          >
            Browse Matches
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="grid grid-cols-3 gap-3 lg:gap-4"
        >
          <div className="bg-[#121212] border border-[#1f2937] rounded-[16px] p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-teal-400" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-gray-500">Active</span>
            </div>
            <span className="font-mono text-2xl lg:text-3xl font-bold text-teal-400 block">
              <AnimatedCounter value={activeCount} />
            </span>
          </div>
          <div className="bg-[#121212] border border-[#1f2937] rounded-[16px] p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Target className="w-4 h-4 text-gray-400" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-gray-500">Played</span>
            </div>
            <span className="font-mono text-2xl lg:text-3xl font-bold block">
              <AnimatedCounter value={matches.length} />
            </span>
          </div>
          <div className="bg-[#121212] border border-[#FFC805] rounded-[16px] p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Trophy className="w-4 h-4 text-[#FFC805]" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-gray-500">Won</span>
            </div>
            <span className="font-mono text-2xl lg:text-3xl font-bold text-[#FFC805] block">
              <AnimatedCounter value={wonCount} />
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <div className="flex items-center gap-2 mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  "px-5 py-2.5 text-sm font-semibold rounded-full transition-all",
                  statusFilter === tab.value
                    ? "bg-[#FFC805] text-black"
                    : "bg-[#1e1e1e] border border-[#374151] text-gray-400 hover:text-white"
                )}
              >
                <span className="flex items-center gap-2">
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={cn(
                      "font-mono text-[11px] px-1.5 py-0.5 rounded-md",
                      statusFilter === tab.value
                        ? "bg-black/20 text-black"
                        : "bg-[#121212] text-gray-500"
                    )}>
                      {tab.count}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
                <SkeletonPremium key={i} variant="card" className="h-[200px]" />
              ))}
            </div>
          ) : filteredMatches.length === 0 ? (
            <FadeIn>
              <div className="bg-[#121212] border border-[#1f2937] rounded-[16px] p-16 text-center">
                <div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-[#1e1e1e] flex items-center justify-center">
                  <Gamepad2 className="w-7 h-7 text-gray-500" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  {statusFilter === 'active' 
                    ? 'No active matches' 
                    : statusFilter === 'completed'
                    ? 'No completed matches yet'
                    : 'No matches found'}
                </h3>
                <p className="text-sm text-gray-400 mb-8">
                  {statusFilter === 'active' 
                    ? 'Join a match to start competing!'
                    : 'Start playing to build your match history.'}
                </p>
                <Link
                  to="/matches"
                  className="btn-premium inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-xl"
                >
                  Find a Match
                </Link>
              </div>
            </FadeIn>
          ) : (
            <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMatches.map((match) => (
                <StaggerItem key={match.id}>
                  <MyMatchCard 
                    match={match} 
                    currentUserId={user.id}
                  />
                </StaggerItem>
              ))}
            </StaggerContainer>
          )}
        </motion.div>
      </div>
    </MainLayout>
  );
}

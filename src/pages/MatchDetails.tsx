import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Users, Trophy, XCircle, Loader2, Clock, Share2, Gamepad2, Monitor, Timer, Coins } from 'lucide-react';
import { motion } from 'framer-motion';
import { PremiumBadge } from '@/components/ui/premium-badge';
import { CoinDisplay } from '@/components/common/CoinDisplay';
import { EpicUsernameWarning } from '@/components/common/EpicUsernameWarning';
import { LoadingPage } from '@/components/common/LoadingSpinner';
import { ReadyUpSection } from '@/components/matches/ReadyUpSection';
import { TeamResultDeclaration } from '@/components/matches/TeamResultDeclaration';
import { TeamParticipantsDisplay } from '@/components/matches/TeamParticipantsDisplay';
import { MatchProgressStepper } from '@/components/matches/MatchProgressStepper';
import { GameRulesPanel } from '@/components/matches/GameRulesPanel';
import { ProofSection } from '@/components/matches/ProofSection';
import { MatchChat } from '@/components/matches/MatchChat';
import { TeamSelector } from '@/components/teams/TeamSelector';
import { PaymentModeSelector } from '@/components/teams/PaymentModeSelector';
import { SoundSettings } from '@/components/settings/SoundSettings';
import { FadeIn } from '@/components/ui/motion';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useSoundNotifications } from '@/hooks/useSoundNotifications';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { Match, Team, TeamMember, Profile, TeamMemberWithBalance, PaymentMode } from '@/types';
import { formatDistanceToNow } from 'date-fns';

interface SelectedTeam extends Team {
  members: (TeamMember & { profile: Profile })[];
  memberBalances?: TeamMemberWithBalance[];
  acceptedMemberCount: number;
}

const statusBadgeVariant = (status: string): 'live' | 'open' | 'completed' => {
  if (['in_progress', 'result_pending', 'disputed', 'ready_check', 'full'].includes(status)) return 'live';
  if (status === 'open') return 'open';
  return 'completed';
};

const statusLabel = (status: string): string => {
  const map: Record<string, string> = {
    open: 'Open',
    full: 'Full',
    ready_check: 'Ready Check',
    in_progress: 'In Progress',
    result_pending: 'Results Pending',
    disputed: 'Disputed',
    completed: 'Completed',
    admin_resolved: 'Resolved',
    canceled: 'Canceled',
    finished: 'Finished',
  };
  return map[status] || status;
};

export default function MatchDetails() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile, wallet, isProfileComplete, refreshWallet } = useAuth();
  const { playSound, needsUnlock, unlockAudio } = useSoundNotifications();

  const [isAdmin, setIsAdmin] = useState(false);

  const [match, setMatch] = useState<Match | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const inflightRef = useRef(false);
  const pendingRefetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const isJoinMode = searchParams.get('join') === 'true';
  const [selectedTeam, setSelectedTeam] = useState<SelectedTeam | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cover');
  const [joining, setJoining] = useState(false);
  const [joining1v1, setJoining1v1] = useState(false);

  const fetchMatch = useCallback(async (opts?: { background?: boolean }) => {
    if (!id) return;
    const background = !!opts?.background;

    if (inflightRef.current) return;
    inflightRef.current = true;

    if (background) {
      setRefreshing(true);
    } else {
      setInitialLoading(true);
    }

    const t0 = performance.now();

    try {

    const tryPublicFallback = async () => {
      const rpcStart = performance.now();
      const { data: pubData, error: pubError } = await supabase.rpc('get_match_public_details', {
        p_match_id: id,
      });
      const rpcMs = Math.round(performance.now() - rpcStart);

      if (pubError || !pubData) {
        toast({
          title: 'Error',
          description: 'Match not found or could not be loaded.',
          variant: 'destructive',
        });
        navigate('/matches');
        return;
      }

      const pubResult = pubData as unknown as { success: boolean; error?: string; match?: unknown };
      if (!pubResult.success || !pubResult.match) {
        toast({
          title: 'Error',
          description: pubResult.error || 'Match not found or could not be loaded.',
          variant: 'destructive',
        });
        navigate('/matches');
        return;
      }

      const publicMatch = pubResult.match as Match & {
        participant_count?: number;
        max_participants?: number;
      };

      setMatch(publicMatch);
      setInitialLoading(false);
      setRefreshing(false);

      console.info('[perf] get_match_public_details', { ms: rpcMs });
    };

       if (!user) {
        await tryPublicFallback();
        return;
      }

      const rpcStart = performance.now();
      const { data, error } = await supabase.rpc('get_match_details', { p_match_id: id });
      const rpcMs = Math.round(performance.now() - rpcStart);

    if (error || !data) {
      toast({
        title: 'Error',
        description: 'Match not found or could not be loaded.',
        variant: 'destructive',
      });
      navigate('/matches');
      return;
    }

    const result = data as unknown as { success: boolean; error?: string; match?: unknown };
    if (!result.success || !result.match) {
      if ((result.error || '').toLowerCase() === 'access denied') {
        await tryPublicFallback();
        return;
      }

      toast({
        title: 'Error',
        description: result.error || 'Match not found or could not be loaded.',
        variant: 'destructive',
      });
      navigate('/matches');
      return;
    }

    const matchData = result.match as Match;

    try {
      const missingProfiles = (matchData.participants ?? []).filter((p: any) => !p?.profile);
      if (missingProfiles.length > 0) {
        console.warn('[MatchDetails] participants missing profile data', {
          matchId: id,
          status: matchData.status,
          missingUserIds: missingProfiles.map((p: any) => p.user_id),
        });
      }
    } catch {
      // ignore
    }
    
     if (matchData.status !== 'open') {
       const isParticipant = matchData.participants?.some((p) => p.user_id === user.id);
       if (!isParticipant && !isAdmin) {
        toast({
          title: 'Participants Only',
          description: 'This match is no longer public. Only participants can view it.',
          variant: 'destructive',
        });
        navigate('/matches');
        return;
      }
    }

      setMatch(matchData);
      setInitialLoading(false);
      setRefreshing(false);

      console.info('[perf] get_match_details', { ms: rpcMs, totalMs: Math.round(performance.now() - t0) });
    } finally {
      inflightRef.current = false;
      setInitialLoading(false);
      setRefreshing(false);
    }
   }, [id, navigate, toast, user, isAdmin]);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setIsAdmin(false);
        return;
      }
      const { data } = await supabase.rpc('is_admin');
      setIsAdmin(!!data);
    };
    checkAdmin();
  }, [user]);

  useEffect(() => {
    fetchMatch({ background: false });
    
    if (id) {
      const channel = supabase
        .channel(`match-details-${id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${id}` },
          () => {
            if (pendingRefetchRef.current) clearTimeout(pendingRefetchRef.current);
            pendingRefetchRef.current = setTimeout(() => fetchMatch({ background: true }), 350);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'match_participants', filter: `match_id=eq.${id}` },
          () => {
            if (pendingRefetchRef.current) clearTimeout(pendingRefetchRef.current);
            pendingRefetchRef.current = setTimeout(() => fetchMatch({ background: true }), 350);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'match_results', filter: `match_id=eq.${id}` },
          () => {
            if (pendingRefetchRef.current) clearTimeout(pendingRefetchRef.current);
            pendingRefetchRef.current = setTimeout(() => fetchMatch({ background: true }), 350);
          }
        )
        .subscribe();

      return () => {
        if (pendingRefetchRef.current) {
          clearTimeout(pendingRefetchRef.current);
          pendingRefetchRef.current = null;
        }
        supabase.removeChannel(channel);
      };
    }
  }, [id, fetchMatch]);

  useEffect(() => {
    if (!id || !user) return;

    const audioChannel = supabase
      .channel(`match-events-audio-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'match_events',
          filter: `match_id=eq.${id}`,
        },
        (payload) => {
          const event = payload.new as {
            event_type: string;
            target_user_ids: string[];
            actor_user_id: string;
          };

          if (
            event.target_user_ids?.includes(user.id) &&
            event.actor_user_id !== user.id
          ) {
            playSound('match_accepted');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(audioChannel);
    };
  }, [id, user, playSound]);

  const handleCancelMatch = async () => {
    if (!match) return;
    
    setCanceling(true);
    
    try {
      const { data, error } = await supabase.rpc('cancel_match_v2', {
        p_match_id: match.id,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Failed to cancel');
      }

      toast({
        title: 'Match Canceled',
        description: 'Your entry fee has been refunded.',
      });

      await refreshWallet();
      navigate('/matches');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel match',
        variant: 'destructive',
      });
    } finally {
      setCanceling(false);
    }
  };

  const handleLeaveMatch = async () => {
    if (!match) return;
    
    setLeaving(true);
    
    try {
      const { data, error } = await supabase.rpc('leave_match', {
        p_match_id: match.id,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Failed to leave');
      }

      toast({
        title: 'Left Match',
        description: 'Your entry fee has been refunded.',
      });

      await refreshWallet();
      navigate('/matches');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to leave match',
        variant: 'destructive',
      });
    } finally {
      setLeaving(false);
    }
  };

  const handleJoinWithTeam = async () => {
    if (!match || !selectedTeam) return;
    
    setJoining(true);
    
    try {
      if (selectedTeam.owner_id !== user?.id) {
        toast({
          title: 'Unable to join',
          description: 'Only the team owner can join the match.',
          variant: 'destructive',
        });
        return;
      }

      const { data, error } = await supabase.rpc('join_match', {
        p_match_id: match.id,
        p_team_id: selectedTeam.id,
        p_payment_mode: paymentMode,
      });

      if (error) throw error;

      const result = data as
        | { success: boolean; reason_code?: string; message?: string; error?: string }
        | null;

      if (!result?.success) {
        toast({
          title: 'Unable to join',
          description: result?.message || result?.error || 'Failed to join match',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Team Joined!',
        description: 'Your team has joined the match. Get ready!',
      });

      await refreshWallet();
      navigate(`/matches/${match.id}`, { replace: true });
      fetchMatch({ background: true });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to join match',
        variant: 'destructive',
      });
    } finally {
      setJoining(false);
    }
  };

  const handleJoin1v1 = async () => {
    if (!match || !user || !wallet) return;
    
    if (!isProfileComplete) {
      toast({
        title: 'Complete your profile',
        description: 'Add your Epic Games Username before joining matches.',
        variant: 'destructive',
      });
      navigate('/profile');
      return;
    }

    setJoining1v1(true);
    
    try {
      const { data, error } = await supabase.rpc('join_match', { p_match_id: match.id });
      if (error) throw error;

      const result = data as
        | { success: boolean; reason_code?: string; message?: string; error?: string }
        | null;

      if (!result?.success) {
        toast({
          title: 'Unable to join',
          description: result?.message || result?.error || 'Failed to join match',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Joined!',
        description: 'You have joined the match. Get ready!',
      });

      await refreshWallet();
      fetchMatch({ background: true });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to join match',
        variant: 'destructive',
      });
    } finally {
      setJoining1v1(false);
    }
  };

  if (initialLoading) return <div className="h-screen flex items-center justify-center bg-background"><LoadingPage /></div>;
  if (!match) return null;

  const participantCount =
    match.participants?.length ??
    ((match as any).participant_count as number | undefined) ??
    0;
  const maxParticipants = match.team_size * 2;
  const isCreator = user?.id === match.creator_id;
  const participant = match.participants?.find(p => p.user_id === user?.id);
  const isParticipant = !!participant;
  const isAdminSpectator = isAdmin && !!user && !isParticipant;
  
  const canCancel = !isAdminSpectator && isCreator && match.status === 'open';
  const canLeave = !isAdminSpectator && isParticipant && !isCreator && match.status === 'ready_check' && !participant?.ready;
  
  const showReadyUp = !isAdminSpectator && (match.status === 'ready_check' || match.status === 'full') && isParticipant;
  const showResultDeclaration = !isAdminSpectator && isParticipant && (match.status === 'in_progress' || match.status === 'result_pending');
  
  const showTeamJoin = !isAdminSpectator && isJoinMode && match.status === 'open' && match.team_size > 1 && !isParticipant && user;
  
  const totalTeamCost = match.entry_fee * match.team_size;
  const canAffordCover = wallet && wallet.balance >= totalTeamCost;
  const canAffordSplit = selectedTeam?.memberBalances?.every(m => m.balance >= match.entry_fee) ?? false;
  const canJoinWithTeam = selectedTeam && (paymentMode === 'cover' ? canAffordCover : canAffordSplit);
  
  const canJoin1v1 = !isAdminSpectator && user && match.status === 'open' && match.team_size === 1 && !isParticipant && participantCount < maxParticipants;

  const copyMatchLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: 'Link copied!',
      description: 'Match link copied to clipboard',
    });
  };

  const prizePool = match.entry_fee * maxParticipants * 0.95;

  const showChat = (isParticipant || isAdmin) && match.status !== 'open';

  return (
    <div className="min-h-screen flex flex-col bg-background overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex-shrink-0 border-b border-[hsl(var(--border-soft))]">
          <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-4">
            <div className="flex items-center justify-between gap-4">
              <Link
                to={match.status === 'open' ? '/matches' : '/my-matches'}
                className="inline-flex items-center gap-2 text-sm text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back</span>
              </Link>

              <div className="flex items-center gap-3">
                <Gamepad2 className="w-5 h-5 text-[hsl(var(--text-secondary))]" />
                <span className="font-display font-bold text-sm lg:text-base uppercase">
                  {match.team_size}v{match.team_size} {match.mode}
                </span>
                <PremiumBadge variant={statusBadgeVariant(match.status)} dot>
                  {statusLabel(match.status)}
                </PremiumBadge>
                {isAdminSpectator && (
                  <PremiumBadge variant="gold">ADMIN VIEW</PremiumBadge>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="hidden md:flex items-center gap-4">
                  <div className="text-center">
                    <span className="text-[10px] text-[hsl(var(--text-tertiary))] block">Entry</span>
                    <span className="font-mono font-bold text-sm">
                      <CoinDisplay amount={match.entry_fee} size="sm" />
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] text-[#FFC805] block">Prize</span>
                    <span className="font-mono font-bold text-sm text-[#FFC805]">
                      <CoinDisplay amount={prizePool} size="sm" />
                    </span>
                  </div>
                </div>
                <button
                  onClick={copyMatchLink}
                  className="btn-premium-ghost px-3 py-2 rounded-xl"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <FadeIn delay={0.1}>
        <div className="flex-shrink-0 border-b border-[hsl(var(--border-soft)/0.5)] py-2">
          <div className="max-w-[900px] mx-auto px-4">
            <MatchProgressStepper status={match.status} />
          </div>
        </div>
      </FadeIn>

      {user && !isProfileComplete && (
        <div className="flex-shrink-0 px-4 py-2 bg-[hsl(var(--error)/0.05)] border-b border-[hsl(var(--error)/0.15)]">
          <EpicUsernameWarning />
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-6 h-full">
          <div className="flex flex-col lg:flex-row gap-6 h-full">
            
            <div className="flex-1 flex flex-col gap-5 min-w-0">
              
              <FadeIn delay={0.15}>
                {match.status === 'open' && isCreator && (
                  <div className="bg-[#121212] border border-[#1f2937] rounded-[16px] p-4 flex items-center justify-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[hsl(var(--teal))] animate-pulse" />
                    <p className="text-sm font-medium text-[hsl(var(--teal))]">
                      Waiting for opponent...
                    </p>
                  </div>
                )}

                {match.status === 'completed' && (
                  <div className="bg-[#121212] border border-[#FFC805]/30 rounded-[16px] p-4 flex items-center justify-center gap-3">
                    <Trophy className="w-5 h-5 text-[#FFC805]" />
                    <p className="text-sm font-semibold text-[#FFC805]">
                      {match.result?.winner_user_id === user?.id ? 'Victory!' : 'Match Completed'}
                    </p>
                  </div>
                )}

                {match.status === 'disputed' && (
                  <div className="bg-[#121212] border border-[hsl(var(--error)/0.3)] rounded-[16px] p-4 flex items-center justify-center gap-3">
                    <Clock className="w-4 h-4 text-[hsl(var(--error))] animate-pulse" />
                    <p className="text-sm font-medium text-[hsl(var(--error))]">
                      Under Admin Review
                    </p>
                  </div>
                )}
              </FadeIn>

              <FadeIn delay={0.2}>
                <div className="bg-[#121212] border border-[#1f2937] rounded-[16px] p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-[hsl(var(--text-secondary))] uppercase font-display">
                    Match Details
                  </h3>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="stat-card p-3">
                      <span className="text-[11px] text-[hsl(var(--text-tertiary))] block mb-1">Format</span>
                      <span className="font-semibold text-sm">{match.team_size}v{match.team_size}</span>
                    </div>
                    <div className="stat-card p-3">
                      <span className="text-[11px] text-[hsl(var(--text-tertiary))] block mb-1">Mode</span>
                      <span className="font-semibold text-sm">{match.mode}</span>
                    </div>
                    <div className="stat-card p-3">
                      <span className="text-[11px] text-[hsl(var(--text-tertiary))] block mb-1">Region</span>
                      <span className="font-semibold text-sm">{match.region}</span>
                    </div>
                    <div className="stat-card p-3">
                      <span className="text-[11px] text-[hsl(var(--text-tertiary))] block mb-1">Players</span>
                      <span className="font-mono font-bold text-sm text-[hsl(var(--teal))]">
                        <AnimatedCounter value={participantCount} />/{maxParticipants}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="stat-card p-3 border-[#FFC805]/20">
                      <span className="text-[11px] text-[hsl(var(--text-tertiary))] block mb-1">Entry Fee</span>
                      <span className="font-mono font-bold text-[#FFC805]">
                        <CoinDisplay amount={match.entry_fee} size="sm" />
                      </span>
                    </div>
                    <div className="stat-card p-3 border-[#FFC805]/20">
                      <span className="text-[11px] text-[hsl(var(--text-tertiary))] block mb-1">Prize Pool</span>
                      <span className="font-mono font-bold text-[#FFC805]">
                        <CoinDisplay amount={prizePool} size="sm" />
                      </span>
                    </div>
                    <div className="stat-card p-3">
                      <span className="text-[11px] text-[hsl(var(--text-tertiary))] block mb-1">Platform</span>
                      <span className="font-semibold text-sm">{match.platform}</span>
                    </div>
                  </div>

                  {match.created_at && (
                    <div className="flex items-center justify-between text-xs text-[hsl(var(--text-tertiary))] pt-3 border-t border-[hsl(var(--border-soft))]">
                      <span>Created</span>
                      <span className="font-mono">
                        {formatDistanceToNow(new Date(match.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  )}
                </div>
              </FadeIn>

              {showTeamJoin && (
                <FadeIn delay={0.25}>
                  <div className="bg-[#121212] border border-[#1f2937] rounded-[16px] p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[hsl(var(--teal))]" />
                      <span className="font-semibold text-sm">
                        Join with Your Team
                      </span>
                    </div>
                    <TeamSelector
                      teamSize={match.team_size}
                      entryFee={match.entry_fee}
                      selectedTeamId={selectedTeam?.id ?? null}
                      onSelectTeam={(team) => setSelectedTeam(team as SelectedTeam | null)}
                      paymentMode={paymentMode}
                    />

                    {selectedTeam && (
                      <PaymentModeSelector
                        paymentMode={paymentMode}
                        onChangePaymentMode={setPaymentMode}
                        entryFee={match.entry_fee}
                        teamSize={match.team_size}
                        memberBalances={selectedTeam.memberBalances}
                        userBalance={wallet?.balance ?? 0}
                      />
                    )}

                    <button
                      className={cn(
                        "w-full py-3 btn-premium font-semibold rounded-xl inline-flex items-center justify-center gap-2",
                        (joining || !canJoinWithTeam) && "opacity-50 cursor-not-allowed"
                      )}
                      onClick={handleJoinWithTeam}
                      disabled={joining || !canJoinWithTeam}
                    >
                      {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Join Match
                    </button>
                  </div>
                </FadeIn>
              )}

              <FadeIn delay={0.3}>
                <TeamParticipantsDisplay match={match} currentUserId={user?.id} />
              </FadeIn>

              {user && (isParticipant || isAdmin) && (
                <FadeIn delay={0.35}>
                  <ProofSection
                    matchId={match.id}
                    currentUserId={user.id}
                    isAdmin={isAdmin}
                    isParticipant={isParticipant}
                  />
                </FadeIn>
              )}

              <FadeIn delay={0.4}>
                <GameRulesPanel />
              </FadeIn>

              {(canCancel || canLeave) && (
                <FadeIn delay={0.45}>
                  <div className="flex gap-3">
                    {canCancel && (
                      <button
                        onClick={handleCancelMatch}
                        disabled={canceling}
                        className={cn(
                          "btn-premium-danger px-5 py-2.5 rounded-xl inline-flex items-center gap-2 text-sm font-semibold",
                          canceling && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        {canceling ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                        Cancel Match
                      </button>
                    )}

                    {canLeave && (
                      <button
                        onClick={handleLeaveMatch}
                        disabled={leaving}
                        className={cn(
                          "btn-premium-ghost px-5 py-2.5 rounded-xl inline-flex items-center gap-2 text-sm font-medium",
                          leaving && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        {leaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                        Leave Match
                      </button>
                    )}
                  </div>
                </FadeIn>
              )}
            </div>

            <div className="w-full lg:w-[360px] flex flex-col gap-5 flex-shrink-0">
              
              {showReadyUp && user && (
                <FadeIn delay={0.2}>
                  <ReadyUpSection
                    match={match}
                    currentUserId={user.id}
                    onReadyChange={fetchMatch}
                  />
                </FadeIn>
              )}

              {showResultDeclaration && user && (
                <FadeIn delay={0.25}>
                  <TeamResultDeclaration
                    match={match}
                    currentUserId={user.id}
                    onResultDeclared={fetchMatch}
                  />
                </FadeIn>
              )}

              {showChat && user && (
                <FadeIn delay={0.3}>
                  <div className="flex-1 min-h-[300px] lg:min-h-0">
                    <MatchChat
                      matchId={match.id}
                      matchStatus={match.status}
                      currentUserId={user.id}
                      isAdmin={isAdmin}
                      isParticipant={isParticipant}
                    />
                  </div>
                </FadeIn>
              )}

              {canJoin1v1 && (
                <FadeIn delay={0.2}>
                  <div className="bg-[#121212] border border-[#1f2937] rounded-[16px] p-5 space-y-4">
                    <h3 className="font-semibold text-sm">
                      Join This Match
                    </h3>
                    <div className="flex justify-between text-sm">
                      <span className="text-[hsl(var(--text-secondary))]">Entry Fee</span>
                      <span className="font-mono font-bold text-[#FFC805]">
                        <CoinDisplay amount={match.entry_fee} size="sm" />
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[hsl(var(--text-secondary))]">Your Balance</span>
                      <span className="font-mono font-bold">
                        <CoinDisplay amount={wallet?.balance ?? 0} size="sm" />
                      </span>
                    </div>
                    <button
                      className={cn(
                        "w-full py-3 btn-premium font-semibold rounded-xl inline-flex items-center justify-center gap-2",
                        (joining1v1 || (wallet?.balance ?? 0) < match.entry_fee) && "opacity-50 cursor-not-allowed"
                      )}
                      onClick={handleJoin1v1}
                      disabled={joining1v1 || (wallet?.balance ?? 0) < match.entry_fee}
                    >
                      {joining1v1 ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      {(wallet?.balance ?? 0) < match.entry_fee ? 'Insufficient Balance' : 'Join Match'}
                    </button>
                  </div>
                </FadeIn>
              )}

              {!showChat && !canJoin1v1 && (
                <FadeIn delay={0.2}>
                  <div className="bg-[#121212] border border-[#1f2937] rounded-[16px] p-5 space-y-3">
                    <h3 className="font-semibold text-sm text-[#FFC805]">
                      Match Info
                    </h3>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[hsl(var(--text-secondary))]">Players</span>
                      <span className="font-mono font-bold">
                        <AnimatedCounter value={participantCount} />/{maxParticipants}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[hsl(var(--text-secondary))]">Entry</span>
                      <span className="font-mono font-bold">
                        <CoinDisplay amount={match.entry_fee} size="sm" />
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[hsl(var(--text-secondary))]">Prize</span>
                      <span className="font-mono font-bold text-[#FFC805]">
                        <CoinDisplay amount={prizePool} size="sm" />
                      </span>
                    </div>
                    {match.created_at && (
                      <div className="flex justify-between items-center text-xs pt-3 border-t border-[hsl(var(--border-soft))]">
                        <span className="text-[hsl(var(--text-tertiary))]">Created</span>
                        <span className="text-[hsl(var(--text-tertiary))] font-mono">
                          {formatDistanceToNow(new Date(match.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    )}
                  </div>
                </FadeIn>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

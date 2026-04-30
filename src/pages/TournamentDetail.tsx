import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { FooterSection } from '@/components/home/sections/FooterSection';
import { TournamentDetailHeader } from '@/components/tournaments/TournamentDetailHeader';
import { TournamentRegisterOverlay } from '@/components/tournaments/TournamentRegisterOverlay';
import { TournamentRulesOverlay } from '@/components/tournaments/TournamentRulesOverlay';
import { TournamentTwitchPanel } from '@/components/tournaments/TournamentTwitchPanel';
import { PlayerStatsModal } from '@/components/player/PlayerStatsModal';
import {
  TournamentTeamsTable,
  type TournamentTeamRow,
} from '@/components/tournaments/TournamentTeamsTable';
import {
  FigmaPillButton,
  FONTS,
  TOURNAMENT_ASSETS,
  TournamentModalShell,
  TournamentPageShell,
  TournamentTitle,
} from '@/components/tournaments/TournamentDesign';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  isParticipating,
  tournamentStatusLabel,
  useCancelTournament,
  useRegisterTournament,
  useSetTournamentReady,
  useStartTournament,
  type TournamentMatchSummary,
  useTournamentMatches,
  useTournament,
} from '@/hooks/useTournaments';
import { getDiscordAvatarUrl } from '@/lib/avatar';
import { copyTextToClipboard } from '@/lib/copyToClipboard';
import { getModeRules } from '@/lib/matchRules';
import type { Tournament, TournamentParticipant } from '@/types';

const TERMINAL_TOURNAMENT_STATUSES = new Set(['completed', 'cancelled']);
const FINAL_MATCH_STATUSES = new Set(['completed', 'finished', 'admin_resolved']);
const CLOSED_MATCH_STATUSES = new Set([
  'completed',
  'finished',
  'admin_resolved',
  'expired',
  'cancelled',
  'canceled',
]);

function formatRemaining(endsAt: string | null): string {
  if (!endsAt) return 'TBD';
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return 'ENDED';
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatStartDate(iso: string | null): string {
  if (!iso) return 'TBD';
  const d = new Date(iso);
  const today = new Date();
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const time = d
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    .replace(' ', '');
  if (isToday) return `Today, ${time}`;
  const month = d.toLocaleString('en-US', { month: 'short' });
  return `${month} ${d.getDate()}, ${time}`;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  const totalMin = Math.round(seconds / 60);
  if (totalMin < 60) return `${totalMin}min`;
  const hours = Math.floor(totalMin / 60);
  const rest = totalMin % 60;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

function deriveTournamentParticipantStats(
  tournament: Tournament,
  participants: TournamentParticipant[],
  matches: TournamentMatchSummary[],
) {
  const derived = new Map<
    string,
    { points: number; wins: number; losses: number; matches_played: number; current_match_id: string | null }
  >();
  const participantByUserId = new Map<string, string>();
  const participantByTeamId = new Map<string, string>();

  for (const participant of participants) {
    derived.set(participant.id, {
      points: 0,
      wins: 0,
      losses: 0,
      matches_played: 0,
      current_match_id: null,
    });

    if (participant.user_id) participantByUserId.set(participant.user_id, participant.id);
    if (participant.team_id) participantByTeamId.set(participant.team_id, participant.id);
  }

  for (const match of matches) {
    const participantIds = new Set<string>();

    for (const matchParticipant of match.participants ?? []) {
      const participantId =
        tournament.team_size > 1
          ? (matchParticipant.team_id ? participantByTeamId.get(matchParticipant.team_id) : null)
          : (matchParticipant.user_id ? participantByUserId.get(matchParticipant.user_id) : null);

      if (participantId) {
        participantIds.add(participantId);
      }
    }

    if (
      FINAL_MATCH_STATUSES.has(match.status) &&
      match.result &&
      (match.result.winner_user_id || match.result.winner_team_id)
    ) {
      const winnerParticipantId =
        tournament.team_size > 1
          ? (match.result.winner_team_id ? participantByTeamId.get(match.result.winner_team_id) : null)
          : (match.result.winner_user_id ? participantByUserId.get(match.result.winner_user_id) : null);

      if (winnerParticipantId) {
        const winnerStats = derived.get(winnerParticipantId);
        if (winnerStats) {
          winnerStats.points += 3;
          winnerStats.wins += 1;
          winnerStats.matches_played += 1;
          winnerStats.current_match_id = null;
        }
      }

      for (const participantId of participantIds) {
        if (participantId === winnerParticipantId) continue;
        const loserStats = derived.get(participantId);
        if (loserStats) {
          loserStats.losses += 1;
          loserStats.matches_played += 1;
          loserStats.current_match_id = null;
        }
      }

      continue;
    }

    if (!TERMINAL_TOURNAMENT_STATUSES.has(tournament.status) && !CLOSED_MATCH_STATUSES.has(match.status)) {
      for (const participantId of participantIds) {
        const stats = derived.get(participantId);
        if (stats) {
          stats.current_match_id = match.id;
        }
      }
    }
  }

  return derived;
}

export default function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: tournament, isLoading, error } = useTournament(id);
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const registerMutation = useRegisterTournament();
  const startMutation = useStartTournament();
  const readyMutation = useSetTournamentReady();
  const cancelMutation = useCancelTournament();

  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <PublicLayout>
        <TournamentPageShell contentClassName="flex min-h-screen items-center justify-center pt-[180px]">
          <p className="text-[24px] text-white/60" style={{ fontFamily: FONTS.expanded }}>
            Loading tournament...
          </p>
        </TournamentPageShell>
      </PublicLayout>
    );
  }

  if (error) {
    return (
      <PublicLayout>
        <TournamentPageShell contentClassName="flex min-h-screen items-center justify-center pt-[180px]">
          <p className="text-[24px] text-white/60" style={{ fontFamily: FONTS.expanded }}>
            Unable to load tournament.
          </p>
        </TournamentPageShell>
      </PublicLayout>
    );
  }

  if (!tournament || !id) {
    return (
      <PublicLayout>
        <TournamentPageShell contentClassName="flex min-h-screen items-center justify-center pt-[180px]">
          <p className="text-[24px] text-white/60" style={{ fontFamily: FONTS.expanded }}>
            Tournament not found.
          </p>
        </TournamentPageShell>
      </PublicLayout>
    );
  }

  const busy =
    registerMutation.isPending ||
    startMutation.isPending ||
    readyMutation.isPending ||
    cancelMutation.isPending;

  return (
    <TournamentDetailContent
      tournament={tournament}
      currentUserId={user?.id ?? null}
      isAdmin={profile?.role === 'admin'}
      busy={busy}
      onRegister={async (teamId) => {
        try {
          await registerMutation.mutateAsync({ tournament_id: tournament.id, team_id: teamId ?? null });
          toast({ title: 'Registered!' });
        } catch (err) {
          toast({
            title: 'Error',
            description: err instanceof Error ? err.message : 'Registration failed',
            variant: 'destructive',
          });
        }
      }}
      onStart={async () => {
        try {
          await startMutation.mutateAsync(tournament.id);
          toast({ title: 'Tournament started' });
        } catch (err) {
          toast({
            title: 'Error',
            description: err instanceof Error ? err.message : 'Failed to start',
            variant: 'destructive',
          });
        }
      }}
      onReady={async () => {
        try {
          await readyMutation.mutateAsync(tournament.id);
          toast({
            title: 'Ready up confirmed',
            description: 'Matchmaking started. We are looking for your next tournament match.',
          });
        } catch (err) {
          toast({
            title: 'Error',
            description: err instanceof Error ? err.message : 'Failed to ready up',
            variant: 'destructive',
          });
        }
      }}
      onCancel={async () => {
        if (!window.confirm('Cancel this tournament? All entry fees will be refunded.')) return;
        try {
          await cancelMutation.mutateAsync(tournament.id);
          toast({ title: 'Tournament cancelled' });
          navigate('/tournaments');
        } catch (err) {
          toast({
            title: 'Error',
            description: err instanceof Error ? err.message : 'Failed to cancel',
            variant: 'destructive',
          });
        }
      }}
    />
  );
}

interface ContentProps {
  tournament: Tournament;
  currentUserId: string | null;
  isAdmin: boolean;
  busy: boolean;
  onRegister: (teamId?: string) => Promise<void>;
  onStart: () => Promise<void>;
  onReady: () => Promise<void>;
  onCancel: () => Promise<void>;
}

function TournamentDetailContent({
  tournament: t,
  currentUserId,
  isAdmin,
  busy,
  onRegister,
  onStart,
  onReady,
  onCancel,
}: ContentProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: tournamentMatches = [] } = useTournamentMatches(t.id);
  const rosterRef = useRef<HTMLElement>(null);
  const announcedMatchIdRef = useRef<string | null | undefined>(undefined);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [prizeOpen, setPrizeOpen] = useState(false);
  const [readyOpen, setReadyOpen] = useState(true);
  const [statsUserId, setStatsUserId] = useState<string | null>(null);
  const participants = useMemo(() => {
    const baseParticipants = t.participants ?? [];
    const derivedStats = deriveTournamentParticipantStats(t, baseParticipants, tournamentMatches);

    return baseParticipants.map((participant) => {
      const derived = derivedStats.get(participant.id);
      if (!derived) {
        return participant;
      }

      return {
        ...participant,
        points: Math.max(participant.points, derived.points),
        wins: Math.max(participant.wins, derived.wins),
        losses: Math.max(participant.losses, derived.losses),
        matches_played: Math.max(participant.matches_played, derived.matches_played),
        current_match_id: TERMINAL_TOURNAMENT_STATUSES.has(t.status)
          ? null
          : participant.current_match_id ?? derived.current_match_id,
        ready: TERMINAL_TOURNAMENT_STATUSES.has(t.status) ? false : participant.ready,
      };
    });
  }, [t, tournamentMatches]);
  const participantCount = participants.length;
  const fillPct = Math.min(100, (participantCount / t.max_participants) * 100);
  const alreadyJoined = isParticipating(t, currentUserId);
  const isCreator = t.creator_id === currentUserId;
  const isTeamTournament = t.team_size > 1;
  const headerTitle = `${t.team_size}V${t.team_size} ${t.mode.toUpperCase().replace(/\s+/g, '')}`;
  const rosterLabel = isTeamTournament ? `TEAMS (${participantCount})` : `PLAYERS (${participantCount})`;
  const mapCode = getModeRules(t.mode).mapCode;
  const creatorTwitchUsername = t.creator?.twitch_username?.trim() || null;
  const hasCreatorTwitch = Boolean(creatorTwitchUsername);
  const firstSectionMinHeight = hasCreatorTwitch ? 946 : 955;
  const canRegister = !!currentUserId && t.status === 'registering' && !alreadyJoined;
  const canStart = (isCreator || isAdmin) && t.status === 'registering' && participantCount >= 2;
  const canCancel = (isCreator || isAdmin) && (t.status === 'registering' || t.status === 'ready_up');
  const myParticipation = participants.find(
    (p) => p.user_id === currentUserId || p.payer_user_id === currentUserId,
  );
  const currentMatchId = TERMINAL_TOURNAMENT_STATUSES.has(t.status)
    ? null
    : myParticipation?.current_match_id ?? null;
  const currentTournamentMatch = currentMatchId
    ? tournamentMatches.find((match) => match.id === currentMatchId) ?? null
    : null;
  const isEliminated = Boolean(myParticipation?.eliminated);
  const needsReady =
    alreadyJoined &&
    !isEliminated &&
    !myParticipation?.ready &&
    !TERMINAL_TOURNAMENT_STATUSES.has(t.status) &&
    (t.status === 'ready_up' || t.status === 'running');
  const isSearchingMatch =
    alreadyJoined &&
    !isEliminated &&
    Boolean(myParticipation?.ready) &&
    !currentMatchId &&
    !TERMINAL_TOURNAMENT_STATUSES.has(t.status) &&
    (t.status === 'ready_up' || t.status === 'running');
  const canOpenAssignedMatch = Boolean(
    currentMatchId &&
      !TERMINAL_TOURNAMENT_STATUSES.has(t.status) &&
      (!currentTournamentMatch || !CLOSED_MATCH_STATUSES.has(currentTournamentMatch.status)),
  );

  useEffect(() => {
    if (announcedMatchIdRef.current === undefined) {
      announcedMatchIdRef.current = currentMatchId;
      return;
    }

    if (currentMatchId && announcedMatchIdRef.current !== currentMatchId) {
      toast({
        title: 'Match found',
        description: 'Your tournament match is ready to open.',
      });
    }

    announcedMatchIdRef.current = currentMatchId;
  }, [currentMatchId, toast]);

  let primaryActionLabel: ReactNode = tournamentStatusLabel(t.status);
  let primaryActionDisabled = true;
  let primaryActionStatus: 'default' | 'searching' = 'default';
  let primaryActionClick: (() => void) | undefined;

  if (canRegister) {
    primaryActionLabel = busy ? 'Working...' : 'Register';
    primaryActionDisabled = busy;
    primaryActionClick = () => setRegisterOpen(true);
  } else if (needsReady) {
    primaryActionLabel = busy ? 'Working...' : 'Ready Up';
    primaryActionDisabled = busy;
    primaryActionClick = () => setReadyOpen(true);
  } else if (canOpenAssignedMatch) {
    primaryActionLabel = 'Open Match';
    primaryActionDisabled = false;
    primaryActionClick = () => navigate(`/matches/${currentMatchId}`);
  } else if (isSearchingMatch) {
    primaryActionLabel = <SearchingMatchIndicator />;
    primaryActionDisabled = true;
    primaryActionStatus = 'searching';
  } else if (alreadyJoined && t.status === 'registering') {
    primaryActionLabel = 'Joined';
    primaryActionDisabled = true;
  } else if (isEliminated) {
    primaryActionLabel = 'Eliminated';
    primaryActionDisabled = true;
  }

  const handleCopyMapCode = async () => {
    try {
      const copied = await copyTextToClipboard(mapCode);
      toast({
        title: copied ? 'Map code copied' : 'Copy unavailable',
        description: copied ? mapCode : 'Copy it manually from the tournament header.',
        variant: copied ? undefined : 'destructive',
      });
    } catch (err) {
      toast({
        title: 'Copy failed',
        description: err instanceof Error ? err.message : 'Unable to copy map code.',
        variant: 'destructive',
      });
    }
  };

  const ranked = useMemo(
    () =>
      [...participants].sort((a, b) => {
        if (a.points !== b.points) return b.points - a.points;
        const aRate = a.matches_played > 0 ? a.wins / a.matches_played : 0;
        const bRate = b.matches_played > 0 ? b.wins / b.matches_played : 0;
        if (aRate !== bRate) return bRate - aRate;
        return b.matches_played - a.matches_played;
      }),
    [participants],
  );

  const teamRows: TournamentTeamRow[] = ranked.map((participant) => {
    const avatarUrl = getDiscordAvatarUrl(participant.user ?? participant.team?.owner ?? null);
    return {
      id: participant.id,
      name: isTeamTournament
        ? participant.team?.name ?? 'Unknown Team'
        : participant.user?.username ?? 'Unknown Player',
      size: `${t.team_size}/${t.team_size}`,
      winRate:
        participant.matches_played > 0
          ? `${((participant.wins / participant.matches_played) * 100).toFixed(2)}%`
          : '0.00%',
      variant: 'view',
      avatarUrl,
    };
  });

  const leaderboardRows = ranked.map((participant, index) => ({
    id: participant.id,
    rank: index + 1,
    name: isTeamTournament
      ? participant.team?.name ?? 'Unknown Team'
      : participant.user?.username ?? 'Unknown Player',
    avatarUrl: getDiscordAvatarUrl(participant.user ?? participant.team?.owner ?? null),
    points: participant.points,
    winRate:
      participant.matches_played > 0
        ? `${((participant.wins / participant.matches_played) * 100).toFixed(2)}%`
        : '0.00%',
    record: `${participant.wins}-${participant.losses}`,
    status: participant.eliminated
      ? 'OUT'
      : t.status === 'completed'
        ? 'COMPLETED'
        : t.status === 'cancelled'
          ? 'CANCELLED'
      : participant.current_match_id
        ? 'IN MATCH'
        : participant.ready
          ? 'READY'
          : 'WAITING',
  }));

  const openParticipantStats = (rowId: string) => {
    const participant = participants.find((item) => item.id === rowId);
    const userId = participant?.user_id ?? participant?.payer_user_id ?? null;
    if (userId) setStatsUserId(userId);
  };

  return (
    <PublicLayout>
      <TournamentPageShell
        minHeight={1800}
        topNeonSrc={TOURNAMENT_ASSETS.neonDetail}
        contentWidth="min(1748px, calc(100% - 48px))"
        contentClassName="pb-20"
      >
        <div className="relative" style={{ minHeight: `${firstSectionMinHeight}px` }}>
          <TournamentHeroMeta
            title={headerTitle}
            entry={Number(t.entry_fee) === 0 ? 'free' : Number(t.entry_fee).toFixed(2)}
            prize={Number(t.prize_pool_total).toFixed(2)}
            firstTo={String(t.first_to)}
            platform={t.platform === 'All' ? 'ANY' : String(t.platform).toUpperCase()}
            mapCode={mapCode}
            matchTime={formatStartDate(t.scheduled_start_at)}
            duration={formatDuration(t.duration_seconds)}
            onCopyMapCode={handleCopyMapCode}
          />

          <div className={`absolute left-0 ${hasCreatorTwitch ? 'top-[296px]' : 'top-[317px]'}`}>
            <TournamentDetailHeader
              registrationProgress={{
                current: participantCount,
                total: t.max_participants,
                percent: fillPct,
              }}
              registerLabel={primaryActionLabel}
              registerDisabled={primaryActionDisabled}
              registerStatus={primaryActionStatus}
              onRegister={primaryActionClick}
              twitchPanel={
                hasCreatorTwitch ? (
                  <TournamentTwitchPanel
                    twitchUsername={creatorTwitchUsername!}
                  />
                ) : undefined
              }
            />
          </div>

          <div className={`absolute right-0 flex w-[560px] flex-col items-center ${hasCreatorTwitch ? 'top-[282px]' : 'top-[276px]'}`}>
            <div className="flex w-full items-center justify-end gap-[10px]">
              <TournamentActionButton
                label="RULES"
                icon="info"
                onClick={() => setRulesOpen(true)}
              />
              <TournamentActionButton
                label="LEADERBOARD"
                icon="leaderboard"
                className="w-[232px]"
                onClick={() => setLeaderboardOpen(true)}
              />
              <TournamentActionButton
                label="PRIZE"
                icon="prize"
                className="w-[132px]"
                onClick={() => setPrizeOpen(true)}
              />
            </div>
            <PrizePodium tournament={t} />
          </div>

          <div className={`absolute left-1/2 -translate-x-1/2 ${hasCreatorTwitch ? 'top-[860px]' : 'top-[815px]'}`}>
            <button
              type="button"
              className="flex h-[65px] w-[292px] items-center justify-center gap-[20px] rounded-[50px] border border-[#ff1654] bg-[rgba(255,22,84,0.23)] text-[32px] leading-none text-white shadow-[inset_0px_-4px_4px_rgba(0,0,0,0.25),inset_0px_4px_4px_rgba(255,255,255,0.14)] transition hover:brightness-110"
              style={{ fontFamily: FONTS.wideBlack }}
              onClick={() => rosterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              {isTeamTournament ? 'TEAMS' : 'PLAYER'}
              <img className="h-[27px] w-[19px]" src={TOURNAMENT_ASSETS.detailArrow} alt="" aria-hidden="true" />
            </button>
          </div>
        </div>

        <section ref={rosterRef} id="tournament-roster" className="relative scroll-mt-[160px]">
          <TournamentTitle outlineWidth={616}>{rosterLabel}</TournamentTitle>
          <div
            className="mt-[40px] mx-auto"
            style={{ width: 'min(1448px, calc(100vw - 96px))' }}
          >
            {teamRows.length === 0 ? (
              <div
                className="flex h-[260px] w-full items-center justify-center rounded-[14px] bg-[#282828] text-[24px] text-white/60"
                style={{ fontFamily: FONTS.expanded }}
              >
                No participants yet.
              </div>
            ) : (
              <TournamentTeamsTable
                teams={teamRows}
                onView={openParticipantStats}
                onJoin={openParticipantStats}
              />
            )}
          </div>
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          {canStart ? (
            <FigmaPillButton pink className="w-[222px]" disabled={busy} onClick={onStart}>
              Start Now
            </FigmaPillButton>
          ) : null}
          {canCancel ? (
            <FigmaPillButton className="w-[222px]" disabled={busy} onClick={onCancel}>
              Cancel
            </FigmaPillButton>
          ) : null}
        </div>
      </TournamentPageShell>

      <FooterSection />

      <TournamentRegisterOverlay
        open={registerOpen}
        tournament={t}
        busy={busy}
        onClose={() => setRegisterOpen(false)}
        onConfirm={async (teamId) => {
          await onRegister(teamId);
          setRegisterOpen(false);
        }}
      />
      <TournamentRulesOverlay open={rulesOpen} tournament={t} onClose={() => setRulesOpen(false)} />
      <TournamentLeaderboardOverlay
        open={leaderboardOpen}
        title={rosterLabel}
        rows={leaderboardRows}
        onClose={() => setLeaderboardOpen(false)}
      />
      <TournamentPrizeOverlay open={prizeOpen} tournament={t} onClose={() => setPrizeOpen(false)} />
      <ReadyUpOverlay
        open={needsReady && readyOpen}
        tournament={t}
        busy={busy}
        onClose={() => setReadyOpen(false)}
        onReady={onReady}
      />
      <PlayerStatsModal
        open={Boolean(statsUserId)}
        userId={statsUserId ?? ''}
        onOpenChange={(open) => {
          if (!open) setStatsUserId(null);
        }}
      />
    </PublicLayout>
  );
}

function SearchingMatchIndicator() {
  return (
    <span
      className="inline-flex items-center gap-[10px] whitespace-nowrap"
      data-testid="tournament-matchmaking-indicator"
    >
      <span>SEARCHING</span>
      <span className="flex items-center gap-[5px]" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="h-[6px] w-[6px] rounded-full bg-white/90 animate-pulse"
            style={{ animationDelay: `${index * 160}ms`, animationDuration: '1.1s' }}
          />
        ))}
      </span>
    </span>
  );
}

function TournamentActionButton({
  label,
  icon,
  className = 'w-[144px]',
  onClick,
}: {
  label: string;
  icon: 'info' | 'leaderboard' | 'prize';
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`flex h-[47px] items-center justify-center gap-[8px] rounded-[16px] border text-[18px] text-white transition hover:brightness-110 ${
        icon === 'leaderboard'
          ? 'border-[#b7d932] bg-[rgba(183,217,50,0.13)]'
          : icon === 'prize'
            ? 'border-[#635bff] bg-[#635bff]'
            : 'border-white/50 bg-[rgba(40,40,40,0.8)]'
      } ${className}`}
      style={{ fontFamily: FONTS.expandedBold }}
      onClick={onClick}
    >
      {icon === 'info' ? (
        <img className="h-[16px] w-[16px]" src={TOURNAMENT_ASSETS.infoCircle} alt="" aria-hidden="true" />
      ) : (
        <img
          className="h-[16px] w-[19px]"
          src={TOURNAMENT_ASSETS.prizeCrown}
          alt=""
          aria-hidden="true"
          style={{
            filter:
              icon === 'leaderboard'
                ? 'hue-rotate(87deg) saturate(1.55) brightness(1.25)'
                : 'hue-rotate(230deg) saturate(1.45) brightness(1.35)',
          }}
        />
      )}
      {label}
    </button>
  );
}

function TournamentHeroMeta({
  title,
  entry,
  prize,
  firstTo,
  platform,
  mapCode,
  matchTime,
  duration,
  onCopyMapCode,
}: {
  title: string;
  entry: string;
  prize: string;
  firstTo: string;
  platform: string;
  mapCode: string;
  matchTime: string;
  duration: string;
  onCopyMapCode: () => void;
}) {
  const matchTimeLabel = duration ? `${matchTime} / ${duration}` : matchTime;

  return (
    <div className="absolute left-0 top-[137px] h-[150px] w-[951px]">
      <img
        className="absolute left-[33px] top-0 h-[89px] w-[59px]"
        src={TOURNAMENT_ASSETS.trianglesCard}
        alt=""
        aria-hidden="true"
      />
      <h2
        className="absolute left-[70px] top-[52px] whitespace-nowrap text-[53px] leading-none text-white"
        style={{ fontFamily: FONTS.expandedBlack, letterSpacing: '0.02em' }}
      >
        {title}
      </h2>
      <button
        type="button"
        aria-label={`Copy map code ${mapCode}`}
        onClick={onCopyMapCode}
        className="absolute left-[632px] top-[59px] flex h-[30px] w-[214px] cursor-copy items-center justify-center gap-[8px] rounded-[22px] border border-[#ff1654] bg-[rgba(255,22,84,0.2)] px-[10px] text-[16px] text-white transition hover:brightness-110"
        style={{ fontFamily: FONTS.expanded }}
      >
        <img className="h-[13px] w-[11px]" src={TOURNAMENT_ASSETS.detailCopyIcon} alt="" aria-hidden="true" />
        <span className="truncate">{mapCode}</span>
      </button>
      <div
        className="absolute left-[853px] top-[59px] flex h-[30px] w-[262px] items-center justify-center rounded-[22px] border border-white/50 bg-[#282828] px-[14px] text-[15px] text-white/80"
        style={{ fontFamily: FONTS.expanded }}
      >
        <span className="truncate">{matchTimeLabel}</span>
      </div>
      <div className="absolute left-[70px] top-[105px] flex items-center gap-[10px]">
        <HeroChip label="Entry" value={entry} className="w-[137px]" />
        <HeroChip label="Prize" value={prize} className="w-[146px]" />
        <HeroChip label="First to" value={firstTo} className="w-[162px]" />
        <HeroChip label="Platform" value={platform} className="w-[183px]" />
      </div>
    </div>
  );
}

function HeroChip({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div
      className={`flex h-[30px] items-center justify-center whitespace-nowrap rounded-[22px] border border-[#ff1654] text-[16px] text-white ${className}`}
      style={{ fontFamily: FONTS.expanded }}
    >
      <span>{label}: </span>
      <strong className="ml-[4px]" style={{ fontFamily: FONTS.expandedBold }}>
        {value}
      </strong>
    </div>
  );
}

function PrizePodium({ tournament }: { tournament: Tournament }) {
  const sortedPrizes = [...(tournament.prize_positions ?? [])].sort((a, b) => a.position - b.position);
  const prizeFor = (position: number) =>
    sortedPrizes.find((prize) => prize.position === position)?.amount.toFixed(2) ?? 'PRIZE';

  return (
    <div className="relative mt-[74px] h-[378px] w-[560px]" data-testid="tournament-prize-podium">
      <PrizeCard
        position={2}
        prize={prizeFor(2)}
        star={TOURNAMENT_ASSETS.rankStar2}
        className="left-0 top-[78px] h-[300px] w-[167px]"
        starClassName="left-[5px] top-[3px] h-[153px] w-[153px]"
      />
      <PrizeCard
        position={1}
        prize={prizeFor(1)}
        star={TOURNAMENT_ASSETS.rankStar1}
        className="left-[197px] top-0 h-[378px] w-[210px]"
        starClassName="left-[15px] top-[9px] h-[180px] w-[180px]"
        primary
      />
      <PrizeCard
        position={3}
        prize={prizeFor(3)}
        star={TOURNAMENT_ASSETS.rankStar3}
        className="left-[425px] top-[78px] h-[300px] w-[167px]"
        starClassName="left-[6px] top-[-4px] h-[156px] w-[156px]"
      />
    </div>
  );
}

function PrizeCard({
  position,
  prize,
  star,
  className,
  starClassName,
  primary,
}: {
  position: number;
  prize: string;
  star: string;
  className: string;
  starClassName: string;
  primary?: boolean;
}) {
  return (
    <div className={`absolute rounded-[16px] border border-[#ff1654] bg-[#282828] shadow-[0_4px_4px_rgba(0,0,0,0.25)] ${className}`}>
      <div className={`absolute ${starClassName}`}>
        <img className="h-full w-full object-contain" src={star} alt="" aria-hidden="true" />
        <p
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[46%] text-[44px] leading-none text-white"
          style={{ fontFamily: FONTS.expandedBlack }}
        >
          #{position}
        </p>
      </div>
      <p
        className="absolute left-1/2 top-[198px] -translate-x-1/2 text-center text-[22px] leading-[1.25] text-white"
        style={{ fontFamily: FONTS.expandedBold }}
      >
        {primary ? prize : prize === 'PRIZE' ? 'PRIZE' : prize}
      </p>
      {prize !== 'PRIZE' ? (
        <p className="absolute left-1/2 top-[230px] -translate-x-1/2 text-[13px] uppercase tracking-[0.12em] text-white/50" style={{ fontFamily: FONTS.expanded }}>
          coins
        </p>
      ) : null}
    </div>
  );
}

function TournamentLeaderboardOverlay({
  open,
  title,
  rows,
  onClose,
}: {
  open: boolean;
  title: string;
  rows: Array<{
    id: string;
    rank: number;
    name: string;
    avatarUrl?: string | null;
    points: number;
    winRate: string;
    record: string;
    status: string;
  }>;
  onClose: () => void;
}) {
  const podiumRows = rows.slice(0, 3);

  return (
    <TournamentModalShell
      open={open}
      onClose={onClose}
      eyebrow="TOURNAMENT LEADERBOARD"
      title="LEADERBOARD"
      maxWidth={1120}
      footer={
        <div className="flex justify-end">
          <FigmaPillButton pink className="w-[247px]" onClick={onClose}>
            Close
          </FigmaPillButton>
        </div>
      }
    >
      <div className="rounded-[18px] border border-[#ff1654] bg-[#0f0404]/55 p-5">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-[18px] uppercase tracking-[0.14em] text-white/45" style={{ fontFamily: FONTS.expandedBold }}>
              {title}
            </p>
            <p className="mt-2 text-[30px] text-white" style={{ fontFamily: FONTS.expandedBlack }}>
              LIVE RANKING
            </p>
          </div>
          <div className="rounded-[16px] border border-[#ff1654] bg-[rgba(255,22,84,0.12)] px-4 py-3 text-right">
            <p className="text-[13px] uppercase tracking-[0.14em] text-white/45" style={{ fontFamily: FONTS.expandedBold }}>
              Total Entries
            </p>
            <p className="mt-1 text-[26px] text-white" style={{ fontFamily: FONTS.expandedBlack }}>
              {rows.length}
            </p>
          </div>
        </div>

        {podiumRows.length > 0 ? (
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            {podiumRows.map((row) => (
              <div
                key={row.id}
                className="rounded-[18px] border border-[#ff1654] bg-[#161616] px-5 py-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {row.avatarUrl ? (
                      <img src={row.avatarUrl} alt="" aria-hidden="true" className="h-[58px] w-[58px] rounded-full object-cover" />
                    ) : (
                      <img src={TOURNAMENT_ASSETS.teamAvatar} alt="" aria-hidden="true" className="h-[58px] w-[58px]" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-[24px] text-white" style={{ fontFamily: FONTS.expandedBold }}>
                        {row.name}
                      </p>
                      <p className="mt-1 text-[13px] uppercase tracking-[0.12em] text-white/45" style={{ fontFamily: FONTS.expandedBold }}>
                        {row.record} record
                      </p>
                    </div>
                  </div>
                  <div className="rounded-[14px] border border-[#ff1654] bg-[rgba(255,22,84,0.16)] px-3 py-2 text-[24px] text-white" style={{ fontFamily: FONTS.expandedBlack }}>
                    #{row.rank}
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between rounded-[14px] bg-black/35 px-4 py-4">
                  <div>
                    <p className="text-[12px] uppercase tracking-[0.14em] text-white/45" style={{ fontFamily: FONTS.expandedBold }}>
                      Points
                    </p>
                    <p className="mt-1 text-[30px] text-white" style={{ fontFamily: FONTS.expandedBlack }}>
                      {row.points}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[12px] uppercase tracking-[0.14em] text-white/45" style={{ fontFamily: FONTS.expandedBold }}>
                      Win Rate
                    </p>
                    <p className="mt-1 text-[26px] text-white" style={{ fontFamily: FONTS.expandedBold }}>
                      {row.winRate}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {rows.length === 0 ? (
          <p className="text-[24px] text-white/65" style={{ fontFamily: FONTS.expanded }}>
            No players registered yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-[18px] border border-white/10 bg-[#1b1b1b]">
            <table className="w-full min-w-[760px] text-left text-white">
              <thead className="text-[14px] uppercase text-white/55" style={{ fontFamily: FONTS.expandedBold }}>
                <tr>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Player</th>
                  <th className="px-4 py-3">Points</th>
                  <th className="px-4 py-3">Record</th>
                  <th className="px-4 py-3">Win Rate</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="text-[20px]" style={{ fontFamily: FONTS.expandedBold }}>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-white/10">
                    <td className="px-4 py-4 text-[#ff1654]">#{row.rank}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        {row.avatarUrl ? (
                          <img src={row.avatarUrl} alt="" aria-hidden="true" className="h-[40px] w-[40px] rounded-full object-cover" />
                        ) : (
                          <img src={TOURNAMENT_ASSETS.teamAvatar} alt="" aria-hidden="true" className="h-[40px] w-[40px]" />
                        )}
                        <span>{row.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">{row.points}</td>
                    <td className="px-4 py-4">{row.record}</td>
                    <td className="px-4 py-4">{row.winRate}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-[999px] border px-3 py-2 text-[13px] uppercase tracking-[0.12em] ${
                          row.status === 'IN MATCH'
                            ? 'border-[#ff1654] bg-[rgba(255,22,84,0.16)] text-white'
                            : row.status === 'READY'
                              ? 'border-[#7fe05b] bg-[rgba(127,224,91,0.14)] text-[#7fe05b]'
                              : row.status === 'COMPLETED'
                                ? 'border-[#7fe05b] bg-[rgba(127,224,91,0.14)] text-[#7fe05b]'
                                : row.status === 'CANCELLED'
                                  ? 'border-white/20 bg-white/5 text-white/55'
                              : row.status === 'OUT'
                                ? 'border-white/20 bg-white/5 text-white/55'
                                : 'border-white/20 bg-white/5 text-white/75'
                        }`}
                        style={{ fontFamily: FONTS.expandedBold }}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </TournamentModalShell>
  );
}

function TournamentPrizeOverlay({
  open,
  tournament,
  onClose,
}: {
  open: boolean;
  tournament: Tournament;
  onClose: () => void;
}) {
  const prizes = [...(tournament.prize_positions ?? [])].sort((a, b) => a.position - b.position);
  const prizeCards: Array<{ position: number; amount: number }> =
    prizes.length > 0
      ? prizes.map(({ position, amount }) => ({ position, amount }))
      : [
          { position: 1, amount: tournament.prize_pool_total },
          { position: 2, amount: 0 },
          { position: 3, amount: 0 },
        ];

  return (
    <TournamentModalShell
      open={open}
      onClose={onClose}
      eyebrow="TOURNAMENT PRIZE"
      title="PRIZE SPLIT"
      footer={
        <div className="flex justify-end">
          <FigmaPillButton pink className="w-[247px]" onClick={onClose}>
            Close
          </FigmaPillButton>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        {prizeCards.slice(0, 6).map((prize) => (
          <div
            key={prize.position}
            className="rounded-[18px] border border-[#ff1654] bg-[#0f0404]/55 p-6 text-center"
          >
            <p className="text-[40px] leading-none text-[#ff1654]" style={{ fontFamily: FONTS.expandedBlack }}>
              #{prize.position}
            </p>
            <p className="mt-5 text-[34px] leading-none text-white" style={{ fontFamily: FONTS.expandedBold }}>
              {Number(prize.amount).toFixed(2)}
            </p>
            <p className="mt-2 text-[13px] uppercase tracking-[0.12em] text-white/50" style={{ fontFamily: FONTS.expanded }}>
              coins
            </p>
          </div>
        ))}
      </div>
    </TournamentModalShell>
  );
}

function ReadyUpOverlay({
  open,
  tournament,
  busy,
  onClose,
  onReady,
}: {
  open: boolean;
  tournament: Tournament;
  busy: boolean;
  onClose: () => void;
  onReady: () => Promise<void>;
}) {
  return (
    <TournamentModalShell
      open={open}
      onClose={onClose}
      eyebrow="TOURNAMENT STARTING"
      title="READY UP"
      footer={
        <div className="flex justify-end gap-3">
          <FigmaPillButton className="w-[160px]" onClick={onClose}>
            Later
          </FigmaPillButton>
          <FigmaPillButton pink className="w-[247px]" disabled={busy} onClick={onReady}>
            {busy ? 'Working...' : 'Ready Up'}
          </FigmaPillButton>
        </div>
      }
    >
      <div className="rounded-[18px] border border-[#ff1654] bg-[#0f0404]/55 p-7">
        <p className="text-[26px] leading-[1.25] text-white" style={{ fontFamily: FONTS.expandedBold }}>
          Confirm ready before the deadline. Once players are ready, the tournament starts pairing random matches automatically and leaderboard points update after every result.
        </p>
        <p className="mt-5 text-[44px] leading-none text-[#ff1654]" style={{ fontFamily: FONTS.expandedBlack }}>
          {formatRemaining(tournament.ready_up_deadline)}
        </p>
      </div>
    </TournamentModalShell>
  );
}

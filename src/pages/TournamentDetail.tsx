import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { FooterSection } from '@/components/home/sections/FooterSection';
import { TournamentDetailHeader } from '@/components/tournaments/TournamentDetailHeader';
import { TournamentRegisterOverlay } from '@/components/tournaments/TournamentRegisterOverlay';
import { TournamentRulesOverlay } from '@/components/tournaments/TournamentRulesOverlay';
import {
  TournamentTeamsTable,
  type TournamentTeamRow,
} from '@/components/tournaments/TournamentTeamsTable';
import {
  FigmaPillButton,
  FONTS,
  TOURNAMENT_ASSETS,
  TournamentBottomNeon,
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
  useTournament,
} from '@/hooks/useTournaments';
import { getDiscordAvatarUrl } from '@/lib/avatar';
import type { Tournament } from '@/types';

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
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (isToday) return `Today, ${time}`;
  const month = d.toLocaleString('en-US', { month: 'short' });
  return `${month} ${d.getDate()}, ${time}`;
}

function tournamentCode(id: string): string {
  const compact = id.replace(/-/g, '').slice(0, 12).toUpperCase();
  return compact.match(/.{1,4}/g)?.join(' - ') ?? compact;
}

export default function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: tournament, isLoading } = useTournament(id);
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
          toast({ title: 'Ready up confirmed' });
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
  const navigate = useNavigate();
  const [registerOpen, setRegisterOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [readyOpen, setReadyOpen] = useState(true);
  const participants = useMemo(() => t.participants ?? [], [t.participants]);
  const participantCount = participants.length;
  const fillPct = Math.min(100, (participantCount / t.max_participants) * 100);
  const alreadyJoined = isParticipating(t, currentUserId);
  const isCreator = t.creator_id === currentUserId;
  const isTeamTournament = t.team_size > 1;
  const headerTitle = `${t.team_size}V${t.team_size} ${t.mode.toUpperCase()}`;
  const rosterLabel = isTeamTournament ? `TEAMS (${participantCount})` : `PLAYERS (${participantCount})`;
  const canRegister = !!currentUserId && t.status === 'registering' && !alreadyJoined;
  const canStart = (isCreator || isAdmin) && t.status === 'registering' && participantCount >= 2;
  const canCancel = (isCreator || isAdmin) && (t.status === 'registering' || t.status === 'ready_up');
  const myParticipation = participants.find(
    (p) => p.user_id === currentUserId || p.payer_user_id === currentUserId,
  );
  const needsReady = t.status === 'ready_up' && alreadyJoined && !myParticipation?.ready;

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
      size: isTeamTournament ? `${t.team_size}/${t.team_size}` : `${participant.wins}/${participant.losses || 0}`,
      winRate:
        participant.matches_played > 0
          ? `${((participant.wins / participant.matches_played) * 100).toFixed(2)}%`
          : '0.00%',
      variant: 'view',
      avatarUrl,
    };
  });

  return (
    <PublicLayout>
      <TournamentPageShell minHeight={1800} contentClassName="pb-20">
        <div className="relative min-h-[1105px]">
          <div className="absolute left-0 top-[241px]">
            <TournamentDetailHeader
              title={headerTitle}
              entry={Number(t.entry_fee) === 0 ? 'free' : Number(t.entry_fee).toFixed(2)}
              prize={Number(t.prize_pool_total).toFixed(2)}
              firstTo={String(t.first_to)}
              platform={t.platform === 'All' ? 'ANY' : String(t.platform).toUpperCase()}
              matchId={tournamentCode(t.id)}
              matchTime={formatStartDate(t.scheduled_start_at)}
              registrationProgress={{
                current: participantCount,
                total: t.max_participants,
                percent: fillPct,
              }}
              registerLabel={
                t.status !== 'registering'
                  ? tournamentStatusLabel(t.status)
                  : alreadyJoined
                    ? 'Joined'
                    : busy
                      ? 'Working...'
                      : 'Register'
              }
              registerDisabled={!canRegister || busy}
              onRegister={() => setRegisterOpen(true)}
            />
          </div>

          <div className="absolute right-0 top-[380px] flex w-[560px] flex-col items-center">
            <button
              type="button"
              className="flex h-[47px] w-[144px] items-center justify-center gap-[8px] rounded-[16px] border border-white/50 bg-[rgba(40,40,40,0.8)] text-[24px] text-white transition hover:brightness-110"
              style={{ fontFamily: FONTS.expandedBold }}
              onClick={() => setRulesOpen(true)}
            >
              <img className="h-[16px] w-[16px]" src={TOURNAMENT_ASSETS.infoCircle} alt="" aria-hidden="true" />
              RULES
            </button>
            <PrizePodium tournament={t} />
          </div>

          <div className="absolute left-1/2 top-[1005px] -translate-x-1/2">
            <button
              type="button"
              className="flex h-[65px] w-[292px] items-center justify-center gap-[20px] rounded-[50px] border border-[#ff1654] bg-[rgba(255,22,84,0.23)] text-[32px] leading-none text-white shadow-[inset_0px_-4px_4px_rgba(0,0,0,0.25),inset_0px_4px_4px_rgba(255,255,255,0.14)] transition hover:brightness-110"
              style={{ fontFamily: FONTS.wideBlack }}
              onClick={() => navigate(isTeamTournament ? '/teams' : '/profile')}
            >
              {isTeamTournament ? 'TEAMS' : 'PLAYER'}
              <img className="h-[27px] w-[19px]" src={TOURNAMENT_ASSETS.detailArrow} alt="" aria-hidden="true" />
            </button>
          </div>

          <TournamentBottomNeon top={959} />
        </div>

        <section className="relative">
          <TournamentTitle outlineWidth={616}>{rosterLabel}</TournamentTitle>
          <div className="mt-[40px] overflow-x-auto pb-2">
            {teamRows.length === 0 ? (
              <div
                className="flex h-[260px] w-[1448px] items-center justify-center rounded-[14px] bg-[#282828] text-[24px] text-white/60"
                style={{ fontFamily: FONTS.expanded }}
              >
                No participants yet.
              </div>
            ) : (
              <TournamentTeamsTable
                teams={teamRows}
                onView={(rowId) => {
                  const participant = participants.find((item) => item.id === rowId);
                  if (participant?.team_id) navigate('/teams');
                  else navigate('/profile');
                }}
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
          {needsReady ? (
            <FigmaPillButton pink className="w-[222px]" disabled={busy} onClick={() => setReadyOpen(true)}>
              Ready Up
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
      <ReadyUpOverlay
        open={needsReady && readyOpen}
        tournament={t}
        busy={busy}
        onClose={() => setReadyOpen(false)}
        onReady={onReady}
      />
    </PublicLayout>
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
      <img className={`absolute object-contain ${starClassName}`} src={star} alt="" aria-hidden="true" />
      <p
        className="absolute left-1/2 top-[96px] -translate-x-1/2 text-[44px] leading-none text-white"
        style={{ fontFamily: FONTS.expandedBlack }}
      >
        #{position}
      </p>
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
          Confirm ready before the deadline. Players who do not ready up can be eliminated when the tournament starts.
        </p>
        <p className="mt-5 text-[44px] leading-none text-[#ff1654]" style={{ fontFamily: FONTS.expandedBlack }}>
          {formatRemaining(tournament.ready_up_deadline)}
        </p>
      </div>
    </TournamentModalShell>
  );
}


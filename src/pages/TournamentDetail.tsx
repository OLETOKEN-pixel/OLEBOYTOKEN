import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, ShieldCheck, Trophy } from 'lucide-react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { FooterSection } from '@/components/home/sections/FooterSection';
import { TournamentDetailHeader } from '@/components/tournaments/TournamentDetailHeader';
import {
  TournamentTeamsTable,
  type TournamentTeamRow,
} from '@/components/tournaments/TournamentTeamsTable';
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
import type { Tournament } from '@/types';

const FONT_EXPANDED =
  "'Base_Neue_Trial:Expanded', 'Base Neue Trial-Expanded', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED_BOLD =
  "'Base_Neue_Trial:Expanded_Bold', 'Base Neue Trial-ExpandedBold', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED_BLACK =
  "'Base_Neue_Trial:Expanded_Black_Oblique', 'Base Neue Trial-ExpandedBlack Oblique', 'Base Neue Trial', sans-serif";
const FONT_WIDE_BLACK =
  "'Base_Neue_Trial:Wide_Black', 'Base Neue Trial-WideBlack', 'Base Neue Trial', sans-serif";

function formatRemaining(endsAt: string | null): string {
  if (!endsAt) return '—';
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
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  if (isToday) return `Today, ${time}`;
  const month = d.toLocaleString([], { month: 'short' });
  return `${month} ${d.getDate()}, ${time}`;
}

function tournamentCode(id: string): string {
  const compact = id.replace(/-/g, '').slice(0, 12).toUpperCase();
  return compact.match(/.{1,4}/g)!.join(' - ');
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
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  if (isLoading) {
    return (
      <PublicLayout>
        <div className="flex min-h-screen items-center justify-center text-white/60" style={{ background: '#0f0404' }}>
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </PublicLayout>
    );
  }

  if (!tournament || !id) {
    return (
      <PublicLayout>
        <div className="flex min-h-screen items-center justify-center pt-32" style={{ background: '#0f0404' }}>
          <p className="text-white/60">Tournament not found.</p>
        </div>
      </PublicLayout>
    );
  }

  return (
    <TournamentDetailContent
      tournament={tournament}
      currentUserId={user?.id ?? null}
      isAdmin={profile?.role === 'admin'}
      onRegister={async (teamId) => {
        try {
          await registerMutation.mutateAsync({ tournament_id: tournament.id, team_id: teamId ?? null });
          toast({ title: 'Registered!' });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Registration failed';
          toast({ title: 'Error', description: msg, variant: 'destructive' });
        }
      }}
      onStart={async () => {
        try {
          await startMutation.mutateAsync(tournament.id);
          toast({ title: 'Tournament started' });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Failed to start';
          toast({ title: 'Error', description: msg, variant: 'destructive' });
        }
      }}
      onReady={async () => {
        try {
          await readyMutation.mutateAsync(tournament.id);
          toast({ title: 'Ready up confirmed' });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Failed to ready up';
          toast({ title: 'Error', description: msg, variant: 'destructive' });
        }
      }}
      onCancel={async () => {
        if (!confirm('Cancel this tournament? All entry fees will be refunded.')) return;
        try {
          await cancelMutation.mutateAsync(tournament.id);
          toast({ title: 'Tournament cancelled' });
          navigate('/tournaments');
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Failed to cancel';
          toast({ title: 'Error', description: msg, variant: 'destructive' });
        }
      }}
      busy={
        registerMutation.isPending ||
        startMutation.isPending ||
        readyMutation.isPending ||
        cancelMutation.isPending
      }
    />
  );
}

interface ContentProps {
  tournament: Tournament;
  currentUserId: string | null;
  isAdmin: boolean;
  onRegister: (teamId?: string) => Promise<void>;
  onStart: () => Promise<void>;
  onReady: () => Promise<void>;
  onCancel: () => Promise<void>;
  busy: boolean;
}

function TournamentDetailContent({
  tournament: t,
  currentUserId,
  isAdmin,
  onRegister,
  onStart,
  onReady,
  onCancel,
  busy,
}: ContentProps) {
  const navigate = useNavigate();
  const participants = useMemo(() => t.participants ?? [], [t.participants]);
  const participantCount = participants.length;
  const fillPct = Math.min(100, (participantCount / t.max_participants) * 100);
  const myParticipation = useMemo(
    () =>
      participants.find(
        (p) => p.user_id === currentUserId || p.payer_user_id === currentUserId
      ),
    [participants, currentUserId]
  );
  const alreadyJoined = isParticipating(t, currentUserId);
  const isCreator = t.creator_id === currentUserId;
  const canStart =
    (isCreator || isAdmin) && t.status === 'registering' && participantCount >= 2;
  const canCancel =
    (isCreator || isAdmin) && (t.status === 'registering' || t.status === 'ready_up');
  const canRegister =
    !!currentUserId && t.status === 'registering' && !alreadyJoined && t.team_size === 1;

  const ranked = useMemo(
    () =>
      [...participants].sort((a, b) => {
        if (a.points !== b.points) return b.points - a.points;
        const aRate = a.matches_played > 0 ? a.wins / a.matches_played : 0;
        const bRate = b.matches_played > 0 ? b.wins / b.matches_played : 0;
        if (aRate !== bRate) return bRate - aRate;
        return b.matches_played - a.matches_played;
      }),
    [participants]
  );

  const headerTitle = `${t.team_size}V${t.team_size} ${t.mode.toUpperCase()}`;
  const isTeamTournament = t.team_size > 1;
  const rosterLabel = isTeamTournament ? `TEAMS (${participantCount})` : `PLAYERS (${participantCount})`;

  const teamRows: TournamentTeamRow[] = ranked.map((p) => ({
    id: p.id,
    name: isTeamTournament ? p.team?.name ?? '—' : p.user?.username ?? '—',
    size: isTeamTournament ? `${t.team_size}/${t.team_size}` : `${p.wins}/${p.losses || 0}`,
    winRate:
      p.matches_played > 0 ? ((p.wins / p.matches_played) * 100).toFixed(2) + '%' : '0.00%',
    variant:
      p.user_id === currentUserId || p.payer_user_id === currentUserId ? 'view' : 'join',
  }));

  return (
    <PublicLayout>
      <section className="relative min-h-screen overflow-x-hidden bg-[#0f0404] text-white">
        <img
          className="pointer-events-none absolute left-1/2 top-0 h-[146px] w-screen -translate-x-1/2 object-cover"
          src="/figma-assets/figma-neon.png"
          alt=""
          aria-hidden="true"
        />

        {t.status === 'ready_up' && alreadyJoined && !myParticipation?.ready && (
          <div className="sticky top-24 z-50 mx-auto mb-6 mt-32 w-full max-w-[1000px] rounded-xl border-2 border-[#ff1654] bg-[#ff1654]/15 px-6 py-4 backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[14px] uppercase tracking-[0.15em] text-[#ff1654]" style={{ fontFamily: FONT_EXPANDED_BOLD }}>
                  TOURNAMENT STARTING
                </p>
                <p className="mt-1 text-[20px] text-white" style={{ fontFamily: FONT_EXPANDED_BOLD }}>
                  Ready up — deadline{' '}
                  <span className="text-[#ff1654]">{t.ready_up_deadline ? formatRemaining(t.ready_up_deadline) : '—'}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={onReady}
                disabled={busy}
                className="rounded-lg bg-[#ff1654] px-8 py-3 text-[16px] uppercase text-white transition-colors hover:bg-[#ff1654]/90 disabled:opacity-50"
                style={{ fontFamily: FONT_EXPANDED_BOLD }}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'READY UP'}
              </button>
            </div>
          </div>
        )}

        <div
          className="relative mx-auto flex flex-col"
          style={{ width: 'min(1700px, calc(100% - 60px))', paddingTop: '180px', paddingBottom: '60px' }}
        >
          <div className="flex w-full items-start justify-between gap-[40px]">
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
                  ? 'Working…'
                  : 'Register'
              }
              registerDisabled={!canRegister || busy}
              onRegister={() => onRegister()}
            />

            <div className="relative flex flex-col items-end" style={{ width: '600px' }}>
              <button
                type="button"
                className="flex h-[47px] w-[211px] items-center justify-center gap-[10px] rounded-[16px] border border-solid border-white/50 bg-[rgba(40,40,40,0.8)] text-white transition hover:brightness-110"
                style={{ fontFamily: FONT_EXPANDED_BOLD, fontSize: '24px' }}
                onClick={() => navigate('/rules')}
              >
                <img
                  className="h-[16px] w-[16px]"
                  src="/figma-assets/tournaments/info-circle.svg"
                  alt=""
                  aria-hidden="true"
                />
                <span>RULES</span>
              </button>

              <div className="relative mt-[60px] flex h-[400px] w-[600px] items-center justify-center">
                <img
                  className="absolute inset-0 h-full w-full object-contain"
                  src="/figma-assets/tournaments/star-shape.svg"
                  alt=""
                  aria-hidden="true"
                  style={{ transform: 'rotate(-15.44deg)' }}
                />
                <p
                  className="relative z-10 whitespace-nowrap text-center text-[40px] leading-tight text-white"
                  style={{ fontFamily: FONT_EXPANDED_BOLD }}
                >
                  Winner of the week
                  <br />
                  earns EXTRA coins!*
                </p>
              </div>

              <button
                type="button"
                className="relative mt-[20px] flex h-[65px] w-[292px] items-center justify-center gap-[20px] rounded-[50px] border border-solid border-[#ff1654] bg-[rgba(255,22,84,0.23)] text-white shadow-[inset_0px_-4px_4px_rgba(0,0,0,0.25),inset_0px_4px_4px_rgba(255,255,255,0.14)] transition hover:brightness-110"
                onClick={() => navigate('/teams')}
              >
                <span style={{ fontFamily: FONT_WIDE_BLACK, fontSize: '32px', lineHeight: 1 }}>
                  {isTeamTournament ? 'TEAMS' : 'PLAYER'}
                </span>
                <img
                  className="h-[27px] w-[19px]"
                  src="/figma-assets/tournaments/detail-arrow.svg"
                  alt=""
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          {(t.creator_is_admin || t.prize_positions?.length || canStart || canCancel) && (
            <div className="mt-[40px] flex flex-wrap items-center gap-3">
              {t.creator_is_admin && (
                <span
                  className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1 text-[13px] text-emerald-300"
                  style={{ fontFamily: FONT_EXPANDED }}
                >
                  <ShieldCheck className="mr-1 inline h-3 w-3" /> ADMIN-FUNDED
                </span>
              )}
              {t.status === 'running' && t.ends_at && (
                <span
                  className="inline-flex items-center rounded-full border border-[#ff1654] bg-[#ff1654]/15 px-4 py-1 text-[13px] text-white"
                  style={{ fontFamily: FONT_EXPANDED }}
                >
                  Ends in:&nbsp;<strong className="text-[#ff1654]">{formatRemaining(t.ends_at)}</strong>
                </span>
              )}
              {canStart && (
                <button
                  type="button"
                  onClick={onStart}
                  disabled={busy}
                  className="rounded-full border border-white/30 bg-white/10 px-6 py-2 text-[13px] uppercase text-white transition-colors hover:bg-white/20 disabled:opacity-50"
                  style={{ fontFamily: FONT_EXPANDED_BOLD }}
                >
                  Start Now
                </button>
              )}
              {canCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={busy}
                  className="text-[12px] uppercase text-white/40 underline transition-colors hover:text-red-400"
                >
                  Cancel tournament
                </button>
              )}
            </div>
          )}

          {t.prize_positions && t.prize_positions.length > 0 && (
            <div className="mt-[40px]">
              <h3
                className="mb-3 flex items-center gap-2 text-[24px] text-white"
                style={{ fontFamily: FONT_EXPANDED_BOLD }}
              >
                <Trophy className="h-6 w-6 text-[#ff1654]" /> PRIZE POOL
              </h3>
              <div className="flex flex-wrap gap-3">
                {[...t.prize_positions]
                  .sort((a, b) => a.position - b.position)
                  .map((pp) => (
                    <div
                      key={pp.id}
                      className="rounded-xl border border-[#ff1654]/40 bg-[#1a0a0a] px-5 py-3"
                    >
                      <p className="text-[12px] uppercase text-white/60">Position #{pp.position}</p>
                      <p className="text-[22px] text-white" style={{ fontFamily: FONT_EXPANDED_BOLD }}>
                        {pp.amount.toFixed(2)} <span className="text-[12px] text-white/60">coins</span>
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="mt-[150px] flex flex-col items-center">
            <div className="relative h-[187px] w-[1060px] max-w-full">
              <img
                className="absolute left-0 top-0 h-[186px] w-[124px] object-contain"
                src="/figma-assets/tournaments/triangles.svg"
                alt=""
                aria-hidden="true"
              />
              <h2
                className="absolute left-[71px] top-[83px] whitespace-nowrap leading-none text-white"
                style={{ fontFamily: FONT_EXPANDED_BLACK, fontSize: '80px' }}
              >
                {rosterLabel}
              </h2>
              <img
                className="absolute left-[59px] top-[168px] h-[18px] w-[616px] max-w-none object-fill"
                src="/figma-assets/tournaments/outline.svg"
                alt=""
                aria-hidden="true"
              />
            </div>

            <div className="mt-[40px] flex w-full justify-center overflow-x-auto">
              {teamRows.length === 0 ? (
                <div
                  className="flex h-[200px] w-[1448px] items-center justify-center rounded-[14px] bg-[#282828] text-white/60"
                  style={{ fontFamily: FONT_EXPANDED }}
                >
                  No participants yet.
                </div>
              ) : (
                <TournamentTeamsTable
                  teams={teamRows}
                  onView={(rowId) => {
                    const p = participants.find((pp) => pp.id === rowId);
                    if (p?.user_id) navigate(`/profile/${p.user_id}`);
                  }}
                  onJoin={(rowId) => {
                    const p = participants.find((pp) => pp.id === rowId);
                    if (p?.team_id) navigate(`/teams/${p.team_id}`);
                    else if (p?.user_id) navigate(`/profile/${p.user_id}`);
                  }}
                />
              )}
            </div>
          </div>

          {t.rules && (
            <div className="mt-12 rounded-xl border border-white/10 bg-[#1a0a0a] p-6">
              <h3
                className="mb-2 text-[18px] uppercase tracking-[0.15em] text-[#ff1654]"
                style={{ fontFamily: FONT_EXPANDED_BOLD }}
              >
                Rules
              </h3>
              <p className="whitespace-pre-wrap text-[14px] text-white/80">{t.rules}</p>
            </div>
          )}
        </div>

        <FooterSection />
      </section>
    </PublicLayout>
  );
}


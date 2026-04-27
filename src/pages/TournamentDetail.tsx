import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, ShieldCheck, Trophy } from 'lucide-react';
import { PublicLayout } from '@/components/layout/PublicLayout';
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
import { cn } from '@/lib/utils';
import type { Tournament, TournamentParticipant } from '@/types';

const FONT_BLACK_OBLIQUE = "'Base Neue Trial', sans-serif";
const FONT_EXPANDED_BOLD = "'Base Neue Trial', sans-serif";
const FONT_EXPANDED = "'Base Neue Trial', sans-serif";

function formatDuration(seconds: number) {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
}

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
  return id.replace(/-/g, '').slice(0, 12).toUpperCase().match(/.{1,4}/g)!.join('-');
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

  // Tick every second to update countdown
  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  if (isLoading) {
    return (
      <PublicLayout>
        <div className="flex min-h-screen items-center justify-center text-white/60">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </PublicLayout>
    );
  }

  if (!tournament || !id) {
    return (
      <PublicLayout>
        <div className="flex min-h-screen items-center justify-center pt-32">
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

  return (
    <PublicLayout>
      <div className="relative min-h-screen pb-24 pt-32" style={{ background: '#0f0404' }}>
        {/* Ready-Up Banner */}
        {t.status === 'ready_up' && alreadyJoined && !myParticipation?.ready && (
          <div className="sticky top-24 z-50 mx-auto mb-6 w-full max-w-[1000px] rounded-xl border-2 border-[#ff1654] bg-[#ff1654]/15 px-6 py-4 backdrop-blur">
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

        <div className="mx-auto max-w-[1532px] px-8">
          {/* Top header */}
          <div className="mb-6">
            <h1
              className="text-[53px] leading-none text-white"
              style={{ fontFamily: FONT_BLACK_OBLIQUE, fontStyle: 'italic', fontWeight: 900 }}
            >
              {headerTitle}
            </h1>
          </div>

          {/* Stat chips */}
          <div className="mb-4 flex flex-wrap gap-3">
            <Chip>
              <span className="text-white/70">Entry:</span>{' '}
              <strong className="text-white">{t.entry_fee === 0 ? 'free' : t.entry_fee.toFixed(2)}</strong>
            </Chip>
            <Chip>
              <span className="text-white/70">Prize:</span>{' '}
              <strong className="text-white">{t.prize_pool_total.toFixed(2)}</strong>
            </Chip>
            <Chip>
              <span className="text-white/70">First to:</span>{' '}
              <strong className="text-white">{t.first_to}</strong>
            </Chip>
            <Chip>
              <span className="text-white/70">Platform:</span>{' '}
              <strong className="text-white">{t.platform === 'All' ? 'ANY' : t.platform.toUpperCase()}</strong>
            </Chip>
            <Chip>
              <span className="text-white/70">Region:</span>{' '}
              <strong className="text-white">{t.region}</strong>
            </Chip>
            <Chip>
              <span className="text-white/70">Starts:</span>{' '}
              <strong className="text-white">{formatStartDate(t.scheduled_start_at)}</strong>
            </Chip>
            <Chip>
              <span className="text-white/70">Duration:</span>{' '}
              <strong className="text-white">{formatDuration(t.duration_seconds)}</strong>
            </Chip>
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-3">
            <Chip variant="muted">
              <span className="font-mono">{tournamentCode(t.id)}</span>
            </Chip>
            <Chip variant="muted">{tournamentStatusLabel(t.status)}</Chip>
            {t.status === 'running' && t.ends_at && (
              <Chip>
                <span className="text-white/70">Ends in:</span>{' '}
                <strong className="text-[#ff1654]">{formatRemaining(t.ends_at)}</strong>
              </Chip>
            )}
            {t.creator_is_admin && (
              <Chip variant="emerald">
                <ShieldCheck className="mr-1 inline h-3 w-3" /> ADMIN-FUNDED
              </Chip>
            )}
          </div>

          {/* Action row + registration progress */}
          <div className="mb-12 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2
                className="mb-2 text-[36px] leading-none text-white"
                style={{ fontFamily: FONT_BLACK_OBLIQUE, fontStyle: 'italic', fontWeight: 900 }}
              >
                REGISTRATION PROGRESS
              </h2>
              <div className="mb-2 flex items-center justify-between text-[14px]">
                <span className="text-white/70" style={{ fontFamily: FONT_EXPANDED }}>
                  {Math.round(fillPct)}% FILLED
                </span>
                <span className="text-white" style={{ fontFamily: FONT_EXPANDED_BOLD }}>
                  {participantCount}/{t.max_participants} {isTeamTournament ? 'Teams' : 'Players'}
                </span>
              </div>
              <div className="h-[14px] w-full overflow-hidden rounded-md bg-[#1a0a0a]">
                <div
                  className="h-full rounded-md transition-[width] duration-500"
                  style={{
                    width: `${fillPct}%`,
                    background: 'linear-gradient(90deg, #77fe5c 0%, #ff1654 100%)',
                  }}
                />
              </div>
            </div>

            <div className="flex flex-col items-stretch gap-3 lg:items-end">
              {t.status === 'registering' && !alreadyJoined && currentUserId && !isTeamTournament && (
                <button
                  type="button"
                  onClick={() => onRegister()}
                  disabled={busy}
                  className="rounded-full border border-[#ff1654] bg-[#ff1654]/25 px-10 py-4 text-[18px] uppercase text-white transition-colors hover:bg-[#ff1654]/40 disabled:opacity-50"
                  style={{ fontFamily: FONT_EXPANDED_BOLD }}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'REGISTER'}
                </button>
              )}
              {alreadyJoined && t.status === 'registering' && (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-6 py-3 text-center text-[14px] uppercase text-emerald-300">
                  ✓ You're registered
                </span>
              )}
              {canStart && (
                <button
                  type="button"
                  onClick={onStart}
                  disabled={busy}
                  className="rounded-full border border-white/30 bg-white/10 px-8 py-3 text-[14px] uppercase text-white transition-colors hover:bg-white/20 disabled:opacity-50"
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
          </div>

          {/* Prize positions */}
          {t.prize_positions && t.prize_positions.length > 0 && (
            <div className="mb-12">
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

          {/* Roster section */}
          <div className="mb-6 flex items-end justify-between">
            <h2
              className="text-[44px] leading-none text-white"
              style={{ fontFamily: FONT_BLACK_OBLIQUE, fontStyle: 'italic', fontWeight: 900 }}
            >
              {rosterLabel}
            </h2>
            <div className="h-[3px] w-[260px] bg-[#ff1654]" />
          </div>

          <RosterTable participants={ranked} isTeamTournament={isTeamTournament} />

          {/* Rules */}
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
      </div>
    </PublicLayout>
  );
}

function Chip({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'muted' | 'emerald';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-[13px]',
        variant === 'default' && 'border-[#ff1654] bg-[#ff1654]/15 text-white',
        variant === 'muted' && 'border-white/20 bg-[#282828] text-white/80',
        variant === 'emerald' && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
      )}
      style={{ fontFamily: FONT_EXPANDED }}
    >
      {children}
    </span>
  );
}

function RosterTable({
  participants,
  isTeamTournament,
}: {
  participants: TournamentParticipant[];
  isTeamTournament: boolean;
}) {
  if (participants.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#282828] p-12 text-center text-white/60">
        No participants yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/5 bg-[#282828]">
      <div
        className="grid border-b border-white/10 px-6 py-4 text-[16px] uppercase tracking-[0.1em] text-white/80"
        style={{
          fontFamily: FONT_EXPANDED_BOLD,
          gridTemplateColumns: '60px 1fr 100px 100px 120px 140px',
        }}
      >
        <div>#</div>
        <div>Name</div>
        <div className="text-center">W/L</div>
        <div className="text-center">Points</div>
        <div className="text-center">Win Rate</div>
        <div className="text-right">Status</div>
      </div>
      {participants.map((p, idx) => {
        const winRate =
          p.matches_played > 0 ? ((p.wins / p.matches_played) * 100).toFixed(1) + '%' : '—';
        const name = isTeamTournament
          ? p.team?.name ?? '—'
          : p.user?.username ?? '—';
        const statusLabel = p.eliminated
          ? 'OUT'
          : p.current_match_id
            ? 'IN MATCH'
            : p.ready
              ? 'IDLE'
              : 'WAITING';
        return (
          <div
            key={p.id}
            className="grid items-center border-b border-white/5 px-6 py-4 text-[15px] text-white last:border-b-0"
            style={{
              fontFamily: FONT_EXPANDED,
              gridTemplateColumns: '60px 1fr 100px 100px 120px 140px',
            }}
          >
            <div className="text-white/40">{idx + 1}</div>
            <div className="truncate" style={{ fontFamily: FONT_EXPANDED_BOLD }}>
              {name}
            </div>
            <div className="text-center text-white/80">
              {p.wins}/{p.losses}
            </div>
            <div className="text-center">
              <strong className="text-[#ff1654]">{p.points}</strong>
            </div>
            <div className="text-center">{winRate}</div>
            <div className="text-right text-[12px] uppercase">
              <span
                className={cn(
                  'rounded-full px-2 py-0.5',
                  p.eliminated && 'bg-red-500/20 text-red-300',
                  !p.eliminated && p.current_match_id && 'bg-amber-500/20 text-amber-300',
                  !p.eliminated && !p.current_match_id && p.ready && 'bg-emerald-500/20 text-emerald-300',
                  !p.eliminated && !p.current_match_id && !p.ready && 'bg-white/10 text-white/60'
                )}
              >
                {statusLabel}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { isParticipating, useRegisterTournament } from '@/hooks/useTournaments';
import { cn } from '@/lib/utils';
import type { Tournament } from '@/types';

const FONT_HEAD =
  "'Base_Neue_Trial:Expanded_Black_Oblique', 'Base Neue Trial', 'Base Neue', sans-serif";
const FONT_BOLD =
  "'Base_Neue_Trial:Expanded_Bold', 'Base Neue Trial', 'Base Neue', sans-serif";
const FONT_REGULAR =
  "'Base_Neue_Trial:Regular', 'Base Neue Trial', 'Base Neue', sans-serif";

interface TournamentCardProps {
  tournament: Tournament;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const month = d.toLocaleString('en-US', { month: 'short' });
  const day = d.getDate();
  const hours = d.getHours().toString().padStart(2, '0');
  const mins = d.getMinutes().toString().padStart(2, '0');
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
  const h12 = d.getHours() % 12 || 12;
  return `${month} ${day}\n${h12}:${mins}${ampm}`;
}

function formatDurationShort(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
}

function formatOpensIn(iso: string | null): string {
  if (!iso) return '—';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'NOW';
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / 1440);
  if (days > 0) return `${days}d ${Math.floor((totalMin % 1440) / 60)}h`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function statusLabel(status: Tournament['status']): string {
  switch (status) {
    case 'registering': return 'OPEN';
    case 'ready_up':   return 'READY UP';
    case 'running':    return 'LIVE NOW';
    case 'completed':  return 'ENDED';
    case 'cancelled':  return 'CANCELLED';
  }
}

export function TournamentCard({ tournament: t }: TournamentCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const registerMutation = useRegisterTournament();

  const participantCount = t.participants?.length ?? t.participant_count ?? 0;
  const alreadyJoined = isParticipating(t, user?.id ?? null);
  const canRegister =
    !!user && t.status === 'registering' && !alreadyJoined && t.team_size === 1;

  async function handleRegister(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await registerMutation.mutateAsync({ tournament_id: t.id });
      toast({ title: 'Registered!' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  }

  const title = `${t.team_size}V${t.team_size} ${t.mode.toUpperCase()}`;
  const isFree = t.entry_fee === 0;

  return (
    <Link
      to={`/tournaments/${t.id}`}
      className="group block w-[200px] flex-shrink-0 overflow-hidden rounded-xl border border-[#3a1420] bg-[#170a0d] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#ff1654]/70 hover:shadow-[0_4px_24px_rgba(255,22,84,0.18)]"
    >
      {/* Card header */}
      <div className="border-b border-[#3a1420] px-4 pt-4 pb-3">
        <h3
          className="text-center text-[15px] leading-tight text-white"
          style={{ fontFamily: FONT_HEAD, fontStyle: 'italic' }}
        >
          {title}
        </h3>
      </div>

      {/* Card body */}
      <div className="px-4 py-3 space-y-3">
        {/* Date + Opens In row */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.1em] text-white/45" style={{ fontFamily: FONT_REGULAR }}>
              Date
            </p>
            <p
              className="mt-0.5 whitespace-pre-line text-[12px] leading-tight text-white"
              style={{ fontFamily: FONT_BOLD }}
            >
              {t.scheduled_start_at ? formatDate(t.scheduled_start_at) : 'TBD'}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.1em] text-white/45" style={{ fontFamily: FONT_REGULAR }}>
              {t.scheduled_start_at ? 'Opens In' : 'Duration'}
            </p>
            <p
              className="mt-0.5 text-[12px] leading-tight text-white"
              style={{ fontFamily: FONT_BOLD }}
            >
              {t.scheduled_start_at
                ? formatOpensIn(t.scheduled_start_at)
                : formatDurationShort(t.duration_seconds)}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-[#3a1420]" />

        {/* Entry fee + Prize pool row */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.1em] text-white/45" style={{ fontFamily: FONT_REGULAR }}>
              Entry fee
            </p>
            <div className="mt-0.5 flex items-center gap-1">
              {/* Red dot */}
              <span className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full bg-[#ff1654]" />
              <span className="text-[12px] text-white" style={{ fontFamily: FONT_BOLD }}>
                {isFree ? 'Free' : `${t.entry_fee.toFixed(2)}`}
              </span>
              {/* Arrow icon */}
              <span className="text-[10px] text-white/50">→</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.1em] text-white/45" style={{ fontFamily: FONT_REGULAR }}>
              Prize pool
            </p>
            <div className="mt-0.5 flex items-center gap-1">
              {/* Prize icon - small trophy dot */}
              <img
                src="/figma-assets/matches-prize-icon.svg"
                alt=""
                aria-hidden="true"
                className="h-3 w-3 flex-shrink-0"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
              <span className="text-[12px] font-bold text-white" style={{ fontFamily: FONT_BOLD }}>
                {t.prize_pool_total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Players registered */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.1em] text-white/45" style={{ fontFamily: FONT_REGULAR }}>
            Players register
          </p>
          <div className="mt-0.5 flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full bg-[#ff1654]" />
            <span className="text-[12px] text-white" style={{ fontFamily: FONT_BOLD }}>
              {participantCount}/{t.max_participants}
            </span>
          </div>
        </div>

        {/* Status badge */}
        <div>
          <span
            className={cn(
              'inline-block rounded-full px-2 py-0.5 text-[10px] uppercase',
              t.status === 'running'
                ? 'bg-[#ff1654]/20 text-[#ff1654]'
                : t.status === 'completed' || t.status === 'cancelled'
                  ? 'bg-white/10 text-white/50'
                  : 'bg-emerald-500/15 text-emerald-400'
            )}
            style={{ fontFamily: FONT_BOLD }}
          >
            {statusLabel(t.status)}
          </span>
        </div>
      </div>

      {/* Register / action button */}
      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={canRegister ? handleRegister : undefined}
          disabled={!canRegister || registerMutation.isPending}
          className={cn(
            'flex h-9 w-full items-center justify-center rounded-lg text-[13px] uppercase transition-all',
            canRegister
              ? 'bg-[#ff1654] text-white hover:bg-[#ff1654]/85'
              : alreadyJoined
                ? 'cursor-default bg-emerald-600/25 text-emerald-400'
                : 'cursor-default bg-white/8 text-white/40'
          )}
          style={{ fontFamily: FONT_BOLD }}
        >
          {registerMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : alreadyJoined ? (
            'JOINED'
          ) : t.team_size > 1 ? (
            'VIEW'
          ) : t.status === 'registering' ? (
            'Register'
          ) : (
            'VIEW'
          )}
        </button>
      </div>
    </Link>
  );
}

import { Link } from 'react-router-dom';
import { Coins, Loader2, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { isParticipating, useRegisterTournament } from '@/hooks/useTournaments';
import { cn } from '@/lib/utils';
import type { Tournament } from '@/types';

const FONT_WIDE_BLACK = "'Base Neue Trial', sans-serif";
const FONT_EXPANDED_BOLD = "'Base Neue Trial', sans-serif";
const FONT_REGULAR = "'Base Neue Trial', sans-serif";

interface TournamentCardProps {
  tournament: Tournament;
}

function formatDuration(seconds: number) {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
}

function formatStarts(t: Tournament): string {
  if (t.status === 'running') return 'LIVE NOW';
  if (t.status === 'completed') return 'ENDED';
  if (t.status === 'cancelled') return 'CANCELLED';
  if (t.status === 'ready_up') return 'READY UP';
  return 'OPEN';
}

export function TournamentCard({ tournament }: TournamentCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const registerMutation = useRegisterTournament();

  const participantCount = tournament.participants?.length ?? tournament.participant_count ?? 0;
  const alreadyJoined = isParticipating(tournament, user?.id ?? null);
  const canRegister =
    !!user && tournament.status === 'registering' && !alreadyJoined && tournament.team_size === 1;

  async function handleRegister(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await registerMutation.mutateAsync({ tournament_id: tournament.id });
      toast({ title: 'Registered!' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  }

  const title = `${tournament.team_size}V${tournament.team_size} ${tournament.mode.toUpperCase()}`;

  return (
    <Link
      to={`/tournaments/${tournament.id}`}
      className="block w-[300px] rounded-xl border border-[#ff1654]/70 bg-[#282828] p-5 transition-transform hover:scale-[1.02] hover:border-[#ff1654]"
    >
      <div className="mb-3 border-b border-white/15 pb-3">
        <h3
          className="text-center text-[22px] leading-tight text-white"
          style={{ fontFamily: FONT_WIDE_BLACK }}
        >
          {title}
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-y-3">
        <Field label="Status">
          <span
            className="text-[16px]"
            style={{ fontFamily: FONT_EXPANDED_BOLD, color: tournament.status === 'running' ? '#ff1654' : '#fff' }}
          >
            {formatStarts(tournament)}
          </span>
        </Field>
        <Field label="Duration">
          <span className="text-[16px] text-white" style={{ fontFamily: FONT_EXPANDED_BOLD }}>
            {formatDuration(tournament.duration_seconds)}
          </span>
        </Field>

        <Field label="Entry fee">
          <div className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-[#ff1654]" />
            <span className="text-[18px] text-white" style={{ fontFamily: FONT_EXPANDED_BOLD }}>
              {tournament.entry_fee === 0 ? 'Free' : tournament.entry_fee.toFixed(2)}
            </span>
          </div>
        </Field>
        <Field label="Prize pool">
          <div className="flex items-center gap-1">
            <Coins className="h-4 w-4 text-[#ff1654]" />
            <span className="text-[18px] text-white" style={{ fontFamily: FONT_EXPANDED_BOLD }}>
              {tournament.prize_pool_total.toFixed(2)}
            </span>
          </div>
        </Field>

        <div className="col-span-2">
          <Field label="Players registered">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[#ff1654]" />
              <span className="text-[18px] text-white" style={{ fontFamily: FONT_EXPANDED_BOLD }}>
                {participantCount}/{tournament.max_participants}
              </span>
            </div>
          </Field>
        </div>
      </div>

      <button
        type="button"
        onClick={canRegister ? handleRegister : undefined}
        disabled={!canRegister || registerMutation.isPending}
        className={cn(
          'mt-4 flex h-11 w-full items-center justify-center rounded-lg text-[15px] uppercase transition-colors',
          canRegister
            ? 'bg-[#ff1654] text-white hover:bg-[#ff1654]/90'
            : alreadyJoined
              ? 'cursor-default bg-emerald-600/30 text-emerald-300'
              : 'cursor-default bg-white/10 text-white/50'
        )}
        style={{ fontFamily: FONT_EXPANDED_BOLD }}
      >
        {registerMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : alreadyJoined ? (
          'JOINED'
        ) : tournament.team_size > 1 ? (
          'VIEW'
        ) : tournament.status === 'registering' ? (
          'Register'
        ) : (
          'VIEW'
        )}
      </button>
    </Link>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[13px] text-white/60" style={{ fontFamily: FONT_REGULAR }}>
        {label}
      </p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

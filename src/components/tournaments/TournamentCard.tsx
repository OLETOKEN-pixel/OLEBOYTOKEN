import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  isParticipating,
  tournamentStatusLabel,
  useRegisterTournament,
} from '@/hooks/useTournaments';
import type { Tournament } from '@/types';
import { FONTS, TOURNAMENT_ASSETS } from './TournamentDesign';

interface TournamentCardProps {
  tournament: Tournament;
}

function formatDate(iso: string | null): string {
  if (!iso) return 'TBD';
  const d = new Date(iso);
  const month = d.toLocaleString('en-US', { month: 'short' });
  return `${month} ${d.getDate()}`;
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).replace(' ', '');
}

function formatOpensIn(iso: string | null): string {
  if (!iso) return 'TBD';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'Now';
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / 1440);
  if (days > 0) return `${days}d ${Math.floor((totalMin % 1440) / 60)}h`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${Math.max(1, mins)}m`;
}

export function TournamentCard({ tournament: t }: TournamentCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const registerMutation = useRegisterTournament();

  const participantCount = t.participants?.length ?? t.participant_count ?? 0;
  const alreadyJoined = isParticipating(t, user?.id ?? null);
  const isSolo = t.team_size === 1;
  const canRegister =
    !!user &&
    t.status === 'registering' &&
    !alreadyJoined &&
    isSolo &&
    !registerMutation.isPending;

  const title = `${t.team_size}v${t.team_size} ${t.mode.toUpperCase()}`;
  const date = formatDate(t.scheduled_start_at);
  const time = formatTime(t.scheduled_start_at);
  const opensIn = formatOpensIn(t.scheduled_start_at);
  const entryFee = Number(t.entry_fee) === 0 ? 'Free' : Number(t.entry_fee).toFixed(2);
  const prizePool = Number(t.prize_pool_total).toFixed(2);
  const playersRegistered = `${participantCount}/${t.max_participants}`;
  const ctaLabel =
    alreadyJoined ? 'Joined' : t.status !== 'registering' ? tournamentStatusLabel(t.status) : 'Register';

  async function handleRegister(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!canRegister) return;

    try {
      await registerMutation.mutateAsync({ tournament_id: t.id });
      toast({ title: 'Registered!' });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Registration failed',
        variant: 'destructive',
      });
    }
  }

  return (
    <Link
      to={`/tournaments/${t.id}`}
      className="block rounded-[12px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff1654]/70"
      aria-label={`View ${title}`}
    >
      <article
        className="relative h-[400px] w-[300px] rounded-[12px] border border-[#ff1654] bg-[#282828] text-white transition hover:brightness-110"
        data-testid="tournament-card"
      >
        <h2
          className="absolute left-1/2 top-[9px] w-[280px] -translate-x-1/2 truncate text-center text-[32px] leading-none"
          style={{ fontFamily: FONTS.wideBlack }}
        >
          {title}
        </h2>

        <img
          className="absolute left-[20px] top-[70px] h-px w-[259px]"
          src={TOURNAMENT_ASSETS.cardDivider}
          alt=""
          aria-hidden="true"
        />

        <Metric label="Date" value={date} detail={time} left={38} top={90} />
        <Metric label="Opens in" value={opensIn} left={162} top={90} />

        <p className="absolute left-[38px] top-[179px] text-[20px] leading-none" style={{ fontFamily: FONTS.regular }}>
          Entry fee
        </p>
        <img className="absolute left-[38px] top-[210px] h-[19px] w-[19px]" src={TOURNAMENT_ASSETS.pinkDotSmall} alt="" aria-hidden="true" />
        <p className="absolute left-[62px] top-[205px] text-[24px] leading-none" style={{ fontFamily: FONTS.wideBlack }}>
          {entryFee}
        </p>
        <img
          className="absolute left-[138px] top-[214px] h-[11px] w-[16px]"
          src={TOURNAMENT_ASSETS.arrowStroke}
          alt=""
          aria-hidden="true"
          style={{ transform: 'rotate(-90deg)' }}
        />

        <p className="absolute left-[170px] top-[179px] text-[20px] leading-none" style={{ fontFamily: FONTS.regular }}>
          Prize pool
        </p>
        <img className="absolute left-[170px] top-[210px] h-[19px] w-[23px]" src={TOURNAMENT_ASSETS.prizeCrown} alt="" aria-hidden="true" />
        <p className="absolute left-[204px] top-[205px] text-[24px] leading-none" style={{ fontFamily: FONTS.wideBlack }}>
          {prizePool}
        </p>

        <p className="absolute left-[38px] top-[253px] text-[20px] leading-none" style={{ fontFamily: FONTS.regular }}>
          Players register
        </p>
        <img className="absolute left-[38px] top-[284px] h-[19px] w-[19px]" src={TOURNAMENT_ASSETS.pinkDot} alt="" aria-hidden="true" />
        <p className="absolute left-[62px] top-[279px] text-[24px] leading-none" style={{ fontFamily: FONTS.wideBlack }}>
          {playersRegistered}
        </p>

        <button
          type="button"
          onClick={handleRegister}
          disabled={!canRegister}
          className="absolute left-[26px] top-[327px] flex h-[44px] w-[247px] items-center justify-center rounded-[8px] bg-[#ff1654] text-[20px] leading-none text-white transition hover:bg-[#e61450] disabled:cursor-default disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          style={{ fontFamily: FONTS.wideBlack }}
        >
          {ctaLabel}
        </button>
      </article>
    </Link>
  );
}

function Metric({
  label,
  value,
  detail,
  left,
  top,
}: {
  label: string;
  value: string;
  detail?: string;
  left: number;
  top: number;
}) {
  return (
    <>
      <p
        className="absolute whitespace-nowrap text-[20px] leading-none"
        style={{ left, top, fontFamily: FONTS.regular }}
      >
        {label}
      </p>
      <p
        className="absolute w-[112px] text-[24px] leading-[1.04]"
        style={{ left, top: top + 27, fontFamily: FONTS.bold }}
      >
        {value}
        {detail ? (
          <>
            <br />
            {detail}
          </>
        ) : null}
      </p>
    </>
  );
}

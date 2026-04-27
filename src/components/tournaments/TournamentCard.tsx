import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { isParticipating, useRegisterTournament } from '@/hooks/useTournaments';
import type { Tournament } from '@/types';

const FONT_REGULAR =
  "'Base_Neue_Trial:Regular', 'Base Neue Trial-Regular', 'Base Neue Trial', sans-serif";
const FONT_BOLD =
  "'Base_Neue_Trial:Bold', 'Base Neue Trial-Bold', 'Base Neue Trial', sans-serif";
const FONT_WIDE_BLACK =
  "'Base_Neue_Trial:Wide_Black', 'Base Neue Trial-WideBlack', 'Base Neue Trial', sans-serif";

interface TournamentCardProps {
  tournament: Tournament;
}

function formatDate(iso: string | null): string {
  if (!iso) return 'TBD';
  const d = new Date(iso);
  const month = d.toLocaleString('en-US', { month: 'short' });
  const day = d.getDate();
  return `${month} ${day}`;
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m}${ampm}`;
}

function formatOpensIn(iso: string | null): string {
  if (!iso) return '—';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'Now';
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / 1440);
  if (days > 0) return `${days}d ${Math.floor((totalMin % 1440) / 60)}h`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function TournamentCard({ tournament: t }: TournamentCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const registerMutation = useRegisterTournament();

  const participantCount = t.participants?.length ?? t.participant_count ?? 0;
  const alreadyJoined = isParticipating(t, user?.id ?? null);
  const canRegister =
    !!user &&
    t.status === 'registering' &&
    !alreadyJoined &&
    t.team_size === 1 &&
    !registerMutation.isPending;

  const title = `${t.team_size}v${t.team_size} ${t.mode.toUpperCase()}`;
  const isFree = Number(t.entry_fee) === 0;
  const date = formatDate(t.scheduled_start_at);
  const time = formatTime(t.scheduled_start_at);
  const opensIn = formatOpensIn(t.scheduled_start_at);
  const entryFee = isFree ? 'Free' : Number(t.entry_fee).toFixed(2);
  const prizePool = Number(t.prize_pool_total).toFixed(2);
  const playersRegistered = `${participantCount}/${t.max_participants}`;

  async function handleRegister(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!canRegister) return;
    try {
      await registerMutation.mutateAsync({ tournament_id: t.id });
      toast({ title: 'Registered!' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  }

  return (
    <Link
      to={`/tournaments/${t.id}`}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff1654]/70 rounded-[12px]"
    >
      <article
        className="relative h-[400px] w-[300px] rounded-[12px] border border-solid border-[#ff1654] bg-[#282828] transition hover:brightness-110"
        data-testid="tournament-card"
      >
        <h2
          className="absolute left-1/2 top-[17px] -translate-x-1/2 whitespace-nowrap text-center text-[32px] leading-none text-white"
          style={{ fontFamily: FONT_WIDE_BLACK }}
        >
          {title}
        </h2>

        <img
          className="absolute left-[20px] top-[70px] h-px w-[259px] object-cover"
          src="/figma-assets/tournaments/card-divider.svg"
          alt=""
          aria-hidden="true"
        />

        <p
          className="absolute left-[38px] top-[90px] whitespace-nowrap text-[20px] leading-none text-white"
          style={{ fontFamily: FONT_REGULAR }}
        >
          Date
        </p>
        <p
          className="absolute left-[38px] top-[117px] w-[111px] text-[24px] leading-tight text-white"
          style={{ fontFamily: FONT_BOLD }}
        >
          {date}
          {time ? <><br />{time}</> : null}
        </p>

        <p
          className="absolute left-[162px] top-[90px] whitespace-nowrap text-[20px] leading-none text-white"
          style={{ fontFamily: FONT_REGULAR }}
        >
          Opens in
        </p>
        <p
          className="absolute left-[162px] top-[117px] whitespace-nowrap text-[24px] leading-none text-white"
          style={{ fontFamily: FONT_BOLD }}
        >
          {opensIn}
        </p>

        <p
          className="absolute left-[38px] top-[179px] whitespace-nowrap text-[20px] leading-none text-white"
          style={{ fontFamily: FONT_REGULAR }}
        >
          Entry fee
        </p>
        <img
          className="absolute left-[38px] top-[210px] h-[19px] w-[19px]"
          src="/figma-assets/tournaments/pink-dot-2.svg"
          alt=""
          aria-hidden="true"
        />
        <p
          className="absolute left-[62px] top-[205px] whitespace-nowrap text-[24px] leading-none text-white"
          style={{ fontFamily: FONT_WIDE_BLACK }}
        >
          {entryFee}
        </p>
        <img
          className="absolute left-[138px] top-[214px] h-[11px] w-[16px]"
          src="/figma-assets/tournaments/arrow-stroke.svg"
          alt=""
          aria-hidden="true"
          style={{ transform: 'rotate(-90deg)' }}
        />

        <p
          className="absolute left-[170px] top-[179px] whitespace-nowrap text-[20px] leading-none text-white"
          style={{ fontFamily: FONT_REGULAR }}
        >
          Prize pool
        </p>
        <img
          className="absolute left-[170px] top-[210px] h-[19px] w-[23px]"
          src="/figma-assets/tournaments/prize-crown.svg"
          alt=""
          aria-hidden="true"
        />
        <p
          className="absolute left-[204px] top-[205px] whitespace-nowrap text-[24px] leading-none text-white"
          style={{ fontFamily: FONT_WIDE_BLACK }}
        >
          {prizePool}
        </p>

        <p
          className="absolute left-[38px] top-[253px] whitespace-nowrap text-[20px] leading-none text-white"
          style={{ fontFamily: FONT_REGULAR }}
        >
          Players register
        </p>
        <img
          className="absolute left-[38px] top-[284px] h-[19px] w-[19px]"
          src="/figma-assets/tournaments/pink-dot.svg"
          alt=""
          aria-hidden="true"
        />
        <p
          className="absolute left-[62px] top-[279px] whitespace-nowrap text-[24px] leading-none text-white"
          style={{ fontFamily: FONT_WIDE_BLACK }}
        >
          {playersRegistered}
        </p>

        <button
          type="button"
          onClick={handleRegister}
          disabled={!canRegister}
          className="absolute left-[26px] top-[327px] flex h-[44px] w-[247px] items-center justify-center rounded-[8px] bg-[#ff1654] text-[20px] leading-none text-white transition-colors hover:bg-[#e61450] disabled:cursor-default disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          style={{ fontFamily: FONT_WIDE_BLACK }}
        >
          {alreadyJoined ? 'Joined' : 'Register'}
        </button>
      </article>
    </Link>
  );
}

import { Link } from 'react-router-dom';
import {
  formatEntryFee,
  formatFirstTo,
  formatPlatform,
  formatPrize,
} from '@/lib/matchFormatters';
import { getDiscordAvatarUrl } from '@/lib/avatar';
import type { Match, MatchParticipant, ProfileSummary } from '@/types';

interface MyMatchTokenCardProps {
  match: Match;
  now: number;
  currentUserId?: string;
  className?: string;
}

const FONT_REGULAR =
  "'Base_Neue_Trial:Regular', 'Base Neue Trial-Regular', 'Base Neue Trial', sans-serif";
const FONT_BOLD =
  "'Base_Neue_Trial:Bold', 'Base Neue Trial-Bold', 'Base Neue Trial', sans-serif";
const FONT_WIDE_BLACK =
  "'Base_Neue_Trial:Wide_Black', 'Base Neue Trial-WideBlack', 'Base Neue Trial', sans-serif";

function formatMyMatchTitle(match: Match): string {
  const size = Math.max(Number(match.team_size ?? 1), 1);
  const mode = String(match.mode ?? 'Match').trim().toUpperCase();
  return `${size}V${size} ${mode || 'MATCH'}`;
}

function getProfileName(profile?: ProfileSummary | null): string {
  return profile?.username || profile?.epic_username || 'Player';
}

function mergeCardProfile(
  primary?: ProfileSummary | null,
  fallback?: ProfileSummary | null,
): ProfileSummary | null {
  if (!primary && !fallback) return null;

  const avatarUrl = getDiscordAvatarUrl(primary) ?? getDiscordAvatarUrl(fallback);

  return {
    ...((fallback ?? {}) as ProfileSummary),
    ...((primary ?? {}) as ProfileSummary),
    avatar_url: primary?.avatar_url ?? fallback?.avatar_url ?? avatarUrl,
    discord_avatar_url: avatarUrl,
  } as ProfileSummary;
}

function getCardPlayers(match: Match) {
  const participants = (match.participants ?? []) as MatchParticipant[];
  const creatorProfile = match.creator as ProfileSummary | undefined;
  const creatorParticipant =
    participants.find((participant) => participant.user_id === match.creator_id) ??
    participants.find((participant) => participant.team_side === 'A');
  const opponentParticipant =
    participants.find((participant) => participant.team_side === 'B') ??
    participants.find((participant) => participant.user_id !== match.creator_id);

  const creator = mergeCardProfile(creatorParticipant?.profile as ProfileSummary | undefined, creatorProfile);
  const opponentFallback = opponentParticipant?.user_id === match.creator_id ? creatorProfile : null;
  const opponent = mergeCardProfile(opponentParticipant?.profile as ProfileSummary | undefined, opponentFallback);

  return {
    creator,
    creatorUserId: creatorParticipant?.user_id ?? match.creator_id,
    opponent,
    opponentUserId: opponentParticipant?.user_id ?? null,
  };
}

function getMatchResult(match: Match) {
  return Array.isArray(match.result) ? match.result[0] : match.result;
}

function getMyParticipant(match: Match, currentUserId?: string) {
  if (!currentUserId) return null;
  return (match.participants ?? []).find((participant) => participant.user_id === currentUserId) ?? null;
}

function isCurrentUserWinner(match: Match, currentUserId?: string) {
  if (!currentUserId) return false;

  const result = getMatchResult(match);
  const myParticipant = getMyParticipant(match, currentUserId);

  if (!result) return false;
  if (result.winner_user_id === currentUserId) return true;

  if (!result.winner_team_id) return false;
  if (myParticipant?.team_id && myParticipant.team_id === result.winner_team_id) return true;
  if (myParticipant?.team_side === 'A' && match.team_a_id === result.winner_team_id) return true;
  if (myParticipant?.team_side === 'B' && match.team_b_id === result.winner_team_id) return true;

  return false;
}

function getCurrentUserOutcome(match: Match, currentUserId?: string): 'WIN' | 'LOSS' | null {
  const myParticipant = getMyParticipant(match, currentUserId);
  if (myParticipant?.result_choice === 'WIN' || myParticipant?.result_choice === 'LOSS') {
    return myParticipant.result_choice;
  }

  const result = getMatchResult(match);
  const status = match.status || 'open';
  const hasFinalResult = Boolean(result && ['completed', 'finished', 'admin_resolved'].includes(status));

  if (!hasFinalResult) return null;

  return isCurrentUserWinner(match, currentUserId) ? 'WIN' : 'LOSS';
}

function getStatusBadge(match: Match): { label: string; color: string } | null {
  switch (match.status) {
    case 'open':
      return { label: 'OPEN', color: '#1f0' };
    case 'ready_check':
    case 'full':
      return { label: 'READY', color: '#ffffff' };
    case 'in_progress':
    case 'started':
      return { label: 'LIVE', color: '#1f0' };
    case 'result_pending':
      return { label: 'PENDING', color: '#ffffff' };
    case 'disputed':
      return { label: 'DISPUTED', color: '#ff1654' };
    case 'canceled':
      return { label: 'CANCELED', color: 'red' };
    case 'expired':
      return { label: 'EXPIRED', color: '#ffffff' };
    default:
      return null;
  }
}

export function MyMatchTokenCard({ match, now, currentUserId, className }: MyMatchTokenCardProps) {
  const { creator, creatorUserId, opponent, opponentUserId } = getCardPlayers(match);
  const creatorAvatarUrl = getDiscordAvatarUrl(creator);
  const opponentAvatarUrl = getDiscordAvatarUrl(opponent);
  const userOutcome = getCurrentUserOutcome(match, currentUserId);
  const statusBadge = getStatusBadge(match);
  const userOutcomeSide = currentUserId && opponentUserId === currentUserId && creatorUserId !== currentUserId ? 'right' : 'left';
  const title = formatMyMatchTitle(match);

  return (
    <article
      className={className}
      data-testid="my-match-token-card"
      data-match-status={match.status}
      style={{
        position: 'relative',
        height: '400px',
        width: '100%',
        maxWidth: '300px',
        overflow: 'hidden',
        borderRadius: '12px',
        border: '1px solid #ff1654',
        background: '#282828',
        boxShadow: '0 4px 4px rgba(0,0,0,0.25)',
        flexShrink: 0,
      }}
    >
      <header>
        <h2
          style={{
            position: 'absolute',
            left: '50%',
            top: '25px',
            transform: 'translateX(-50%)',
            width: '273px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontFamily: FONT_WIDE_BLACK,
            fontSize: title.length > 13 ? '27px' : '32px',
            lineHeight: 1,
            color: '#ffffff',
            textAlign: 'center',
          }}
        >
          {title}
        </h2>
        <img
          src="/figma-assets/matches-card-divider.svg"
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '20px',
            top: '78px',
            width: '259px',
            height: '1px',
            objectFit: 'cover',
          }}
        />
      </header>

      <div style={{ position: 'absolute', left: '38px', top: '107px', width: '79px', height: '60px' }}>
        <span style={{ fontFamily: FONT_REGULAR, fontSize: '20px', lineHeight: 1, color: '#ffffff' }}>
          First to
        </span>
        <img
          src="/figma-assets/matches-first-to-triangles.svg"
          alt=""
          aria-hidden="true"
          style={{ position: 'absolute', left: 0, top: '28px', width: '19px', height: '28px' }}
        />
        <span
          style={{
            position: 'absolute',
            left: '22px',
            top: '24px',
            fontFamily: FONT_BOLD,
            fontSize: '30px',
            lineHeight: 1,
            color: '#ffffff',
            whiteSpace: 'nowrap',
          }}
        >
          {formatFirstTo(match)}
        </span>
      </div>

      <div style={{ position: 'absolute', left: '170px', top: '107px', width: '86px', height: '56px' }}>
        <span style={{ fontFamily: FONT_REGULAR, fontSize: '20px', lineHeight: 1, color: '#ffffff' }}>
          Platform
        </span>
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: '27px',
            fontFamily: FONT_BOLD,
            fontSize: '24px',
            lineHeight: 1,
            color: '#ffffff',
            whiteSpace: 'nowrap',
          }}
        >
          {formatPlatform(match.platform)}
        </span>
      </div>

      <div style={{ position: 'absolute', left: '38px', top: '187px', width: '232px', height: '55px' }}>
        <span style={{ position: 'absolute', left: 0, top: 0, fontFamily: FONT_REGULAR, fontSize: '20px', lineHeight: 1, color: '#ffffff' }}>
          Entry fee
        </span>
        <span style={{ position: 'absolute', left: '132px', top: 0, fontFamily: FONT_REGULAR, fontSize: '20px', lineHeight: 1, color: '#ffffff' }}>
          Prize
        </span>
        <img
          src="/figma-assets/matches-entry-dot.svg"
          alt=""
          aria-hidden="true"
          style={{ position: 'absolute', left: 0, top: '31px', width: '19px', height: '19px' }}
        />
        <span
          style={{
            position: 'absolute',
            left: '24px',
            top: '26px',
            fontFamily: FONT_WIDE_BLACK,
            fontSize: '24px',
            lineHeight: 1,
            color: '#ffffff',
            whiteSpace: 'nowrap',
          }}
        >
          {formatEntryFee(match)}
        </span>
        <img
          src="/figma-assets/figma-arrow-stroke.svg"
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '100px',
            top: '35px',
            width: '16px',
            height: '11px',
            transform: 'rotate(-90deg)',
          }}
        />
        <img
          src="/figma-assets/matches-prize-icon.svg"
          alt=""
          aria-hidden="true"
          style={{ position: 'absolute', left: '132px', top: '31px', width: '23px', height: '19px' }}
        />
        <span
          style={{
            position: 'absolute',
            left: '166px',
            top: '26px',
            fontFamily: FONT_WIDE_BLACK,
            fontSize: '24px',
            lineHeight: 1,
            color: '#ffffff',
            whiteSpace: 'nowrap',
          }}
        >
          {formatPrize(match)}
        </span>
      </div>

      <div
        aria-label={`Players ${getProfileName(creator)} versus ${opponent ? getProfileName(opponent) : 'waiting'}`}
        style={{ position: 'absolute', left: '38px', top: '272px', width: '224px', height: '50px' }}
      >
        {creatorAvatarUrl ? (
          <img
            src={creatorAvatarUrl}
            alt={getProfileName(creator)}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div
            aria-label="Discord avatar missing"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.05)',
              display: 'grid',
              placeItems: 'center',
              fontFamily: FONT_WIDE_BLACK,
              fontSize: '16px',
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            ?
          </div>
        )}
        <span
          style={{
            position: 'absolute',
            left: '89px',
            top: '13px',
            width: '46px',
            textAlign: 'center',
            fontFamily: FONT_WIDE_BLACK,
            fontSize: '20px',
            lineHeight: 1,
            color: '#ffffff',
          }}
        >
          VS
        </span>
        {opponent && opponentAvatarUrl ? (
          <img
            src={opponentAvatarUrl}
            alt={getProfileName(opponent)}
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div
            aria-label="Waiting for opponent"
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.05)',
              display: 'grid',
              placeItems: 'center',
              fontFamily: FONT_WIDE_BLACK,
              fontSize: '16px',
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            ?
          </div>
        )}
      </div>

      {userOutcome && (
        <span
          aria-label="User result"
          style={{
            position: 'absolute',
            left: userOutcomeSide === 'left' ? '38px' : '174px',
            top: userOutcome === 'WIN' ? '251px' : '252px',
            width: '88px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontFamily: FONT_WIDE_BLACK,
            fontSize: '15px',
            lineHeight: 1,
            color: userOutcome === 'WIN' ? '#1f0' : 'red',
            textAlign: userOutcomeSide === 'left' ? 'left' : 'right',
          }}
        >
          {userOutcome}
        </span>
      )}

      {statusBadge && (
        <span
          aria-label="Match status"
          style={{
            position: 'absolute',
            left: '90px',
            top: ['canceled', 'expired', 'disputed'].includes(match.status ?? '') ? '260px' : '252px',
            width: '120px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontFamily: FONT_WIDE_BLACK,
            fontSize: '15px',
            lineHeight: 1,
            color: statusBadge.color,
            textAlign: 'center',
          }}
        >
          {statusBadge.label}
        </span>
      )}

      <Link
        to={`/matches/${match.id}`}
        style={{
          position: 'absolute',
          left: '26px',
          top: '335px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '247px',
          height: '44px',
          borderRadius: '8px',
          background: '#ff1654',
          color: '#ffffff',
          textDecoration: 'none',
          fontFamily: FONT_WIDE_BLACK,
          fontSize: '20px',
          lineHeight: 1,
        }}
      >
        View token
      </Link>
    </article>
  );
}

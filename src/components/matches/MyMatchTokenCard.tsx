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
    opponent,
  };
}

export function MyMatchTokenCard({ match, now, className }: MyMatchTokenCardProps) {
  const { creator, opponent } = getCardPlayers(match);
  const creatorAvatarUrl = getDiscordAvatarUrl(creator);
  const opponentAvatarUrl = getDiscordAvatarUrl(opponent);
  const timeLeft = match.status === 'open'
    ? formatOpenTimeLeft(match.expires_at, now)
    : String(match.status ?? 'match').replace(/_/g, ' ').toUpperCase();

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
        borderRadius: '8px',
        border: '1px solid #ff1654',
        background: '#272727',
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
            fontSize: '24px',
            lineHeight: 1,
            color: '#ffffff',
            textAlign: 'center',
          }}
        >
          {formatMyMatchTitle(match)}
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

      <span
        aria-label="Match status"
        style={{
          position: 'absolute',
          left: '38px',
          top: '246px',
          maxWidth: '224px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: FONT_REGULAR,
          fontSize: '14px',
          lineHeight: 1,
          color: 'rgba(255,255,255,0.62)',
          textTransform: 'uppercase',
        }}
      >
        {timeLeft}
      </span>

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

function formatOpenTimeLeft(expiresAt: string, now: number): string {
  const expiresAtMs = new Date(expiresAt).getTime();
  const diff = expiresAtMs - now;

  if (!Number.isFinite(expiresAtMs) || diff <= 0) {
    return 'EXPIRES 00:00';
  }

  const totalSeconds = Math.floor(diff / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `EXPIRES ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

import type { CSSProperties } from 'react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePlayerProfileView, type PlayerProfileHistoryItem, type PlayerProfileView } from '@/hooks/usePlayerProfileView';
import { useToast } from '@/hooks/use-toast';
import { copyTextToClipboard } from '@/lib/copyToClipboard';

const FONT_REGULAR = "'Base_Neue_Trial:Regular', 'Base Neue Trial-Regular', 'Base Neue Trial', sans-serif";
const FONT_BOLD = "'Base_Neue_Trial:Bold', 'Base Neue Trial-Bold', 'Base Neue Trial', sans-serif";
const FONT_BOLD_OBLIQUE = "'Base_Neue_Trial:Bold_Oblique', 'Base Neue Trial-Bold', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED_BLACK = "'Base_Neue_Trial:Expanded_Bold', 'Base Neue Trial-ExpandedBold', 'Base Neue Trial', sans-serif";

const PROFILE_ASSETS = {
  epicLogo: '/figma-assets/player-profile/epic-games-logo.png',
  twitchLogo: '/figma-assets/player-profile/twitch-logo.png',
  xLogo: '/figma-assets/player-profile/x-logo.png',
  fortniteTracker: '/figma-assets/player-profile/fortnite-tracker.png',
  dividerTop: '/figma-assets/player-profile/divider-top.svg',
  dividerMiddle: '/figma-assets/player-profile/divider-middle.svg',
  historyIcons: '/figma-assets/player-profile/history-icons.svg',
  teamUser: '/figma-assets/player-profile/team-user.svg',
  teamUserSmall: '/figma-assets/player-profile/team-user-small.svg',
};

interface PlayerStatsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  rankOverride?: number | null;
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 100,
  background: 'rgba(15, 4, 4, 0.7)',
};

const panelStyle: CSSProperties = {
  position: 'absolute',
  left: 'calc(50% - 9.5px)',
  top: 'calc(50% + 0.5px)',
  transform: 'translate(-50%, -50%)',
  width: 903,
  maxWidth: 'calc(100vw - 32px)',
  height: 800,
  maxHeight: 'calc(100vh - 32px)',
  borderRadius: 18,
  border: '1.462px solid #ff1654',
  background: '#282828',
  color: '#ffffff',
  overflow: 'auto',
  boxSizing: 'border-box',
};

const cardStyle: CSSProperties = {
  width: 340,
  height: 197,
  borderRadius: 10,
  background: 'rgba(15, 4, 4, 0.43)',
  boxSizing: 'border-box',
};

const smallCardStyle: CSSProperties = {
  ...cardStyle,
  height: 129,
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontFamily: FONT_EXPANDED_BLACK,
  fontSize: 32,
  lineHeight: '38px',
  color: '#ffffff',
};

const labelStyle: CSSProperties = {
  margin: 0,
  fontFamily: FONT_BOLD,
  fontSize: 11,
  lineHeight: '13px',
  color: 'rgba(255,255,255,0.46)',
};

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function formatToken(value: number, signed = false) {
  const prefix = signed && value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}`;
}

function cleanHandle(value?: string | null) {
  const trimmed = value?.trim().replace(/^@+/, '');
  return trimmed || null;
}

function getSocials(profile: PlayerProfileView) {
  const twitch = cleanHandle(profile.twitch_username);
  const x = cleanHandle(profile.twitter_username);
  const epic = cleanHandle(profile.epic_username);

  return [
    {
      key: 'epic',
      src: PROFILE_ASSETS.epicLogo,
      label: epic ? `Epic: ${epic}` : 'Epic not linked',
      href: null,
      active: !!epic,
      copyValue: epic,
    },
    {
      key: 'twitch',
      src: PROFILE_ASSETS.twitchLogo,
      label: twitch ? `Twitch: ${twitch}` : 'Twitch not linked',
      href: twitch ? `https://www.twitch.tv/${encodeURIComponent(twitch)}` : null,
      active: !!twitch,
      copyValue: null,
    },
    {
      key: 'x',
      src: PROFILE_ASSETS.xLogo,
      label: x ? `X: ${x}` : 'X not linked',
      href: x ? `https://x.com/${encodeURIComponent(x)}` : null,
      active: !!x,
      copyValue: null,
    },
    {
      key: 'tracker',
      src: PROFILE_ASSETS.fortniteTracker,
      label: epic ? `Fortnite Tracker: ${epic}` : 'Fortnite Tracker unavailable',
      href: epic ? `https://fortnitetracker.com/profile/all/${encodeURIComponent(epic)}` : null,
      active: !!epic,
      copyValue: null,
    },
  ];
}

function StatValue({ label, value, color = '#ffffff', large = true }: {
  label: string;
  value: string | number;
  color?: string;
  large?: boolean;
}) {
  return (
    <div style={{ minWidth: 96 }}>
      <p style={labelStyle}>{label}</p>
      <p
        style={{
          margin: 0,
          fontFamily: FONT_BOLD,
          fontSize: large ? 24 : 20,
          lineHeight: large ? '29px' : '24px',
          color,
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </p>
    </div>
  );
}

function HistoryIcon({ item }: { item?: PlayerProfileHistoryItem }) {
  const status = item?.status ?? 'pending';
  const isWin = status === 'win';
  const isLoss = status === 'loss';
  const color = isWin ? '#77fe5c' : isLoss ? '#ff1654' : '#6c6c6c';
  const label = isWin ? 'History win' : isLoss ? 'History loss' : 'History pending';

  return (
    <svg
      aria-label={label}
      role="img"
      viewBox="0 0 35 35"
      width="35"
      height="35"
      style={{
        width: 35,
        height: 35,
        display: 'block',
        flexShrink: 0,
      }}
    >
      <circle cx="17" cy="17" r="17" fill={color} fillOpacity={isWin ? 0.79 : 1} />
      {isWin && (
        <path
          d="M25 24H8V10L11.5417 17L10.8333 20.85L16.7931 10L20.75 17L20.3958 20.85L25 10V24Z"
          fill="#ffffff"
        />
      )}
      {isLoss && (
        <path
          d="M16.8496 13.3137L21.7994 6.94975L26.7491 11.8995L18.8642 18.3701L21.9761 18.0867L23.5671 19.3241L26.7491 21.799L21.7994 26.7487L16.8496 20.3848L11.8999 26.7487L6.95011 21.799L13.3141 16.8492L6.95011 11.8995L11.8999 6.94975L16.8496 13.3137Z"
          fill="#ffffff"
        />
      )}
      {!isWin && !isLoss && (
        <path
          d="M12 17.5H23"
          stroke="#9c9c9c"
          strokeWidth="3"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

function ProfileAvatar({ profile, size }: { profile?: PlayerProfileView; size: number }) {
  if (profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          display: 'block',
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div
      aria-label="Player avatar missing"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#565656',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontFamily: FONT_BOLD,
        fontSize: Math.max(18, Math.round(size / 3)),
        color: '#9c9c9c',
      }}
    >
      {profile?.username?.charAt(0).toUpperCase() || '?'}
    </div>
  );
}

function ProfileLoadingState() {
  return (
    <div style={{ position: 'absolute', inset: '180px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ margin: 0, fontFamily: FONT_BOLD, fontSize: 24, color: '#9c9c9c' }}>Loading profile...</p>
    </div>
  );
}

function ProfileErrorState({ message }: { message: string }) {
  return (
    <div style={{ position: 'absolute', inset: '180px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 32 }}>
      <p style={{ margin: 0, fontFamily: FONT_BOLD, fontSize: 24, color: '#ff1654' }}>{message}</p>
    </div>
  );
}

function PlayerProfileContent({ profile, rankOverride }: { profile: PlayerProfileView; rankOverride?: number | null }) {
  const { toast } = useToast();
  const winRate = Math.max(0, Math.min(100, profile.stats.win_rate));
  const lossRate = 100 - winRate;
  const displayRank = rankOverride ?? profile.rank;
  const history = profile.history.length > 0
    ? profile.history
    : Array.from({ length: 5 }, (_, index) => ({
        match_id: `empty-${index}`,
        status: 'pending' as const,
        finished_at: null,
      }));

  const handleCopyEpicName = async (epicName: string) => {
    try {
      const copied = await copyTextToClipboard(epicName);
      toast({
        title: copied ? 'Epic username copied' : 'Copy unavailable',
        description: copied ? epicName : 'Copy it manually from the profile.',
        variant: copied ? undefined : 'destructive',
      });
    } catch (err: any) {
      toast({
        title: 'Copy failed',
        description: err?.message || 'Unable to copy Epic username.',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <div style={{ position: 'absolute', inset: 0 }}>
        <div style={{ position: 'absolute', left: 96, top: 181 }}>
          <ProfileAvatar profile={profile} size={132} />
        </div>

        <div
          style={{
            position: 'absolute',
            left: 247,
            top: 195,
            height: 43,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            maxWidth: 410,
            minWidth: 0,
          }}
        >
          <p
            style={{
              margin: 0,
              maxWidth: 270,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontFamily: FONT_BOLD_OBLIQUE,
              fontSize: 36,
              lineHeight: '43px',
              color: '#ffffff',
              flexShrink: 1,
            }}
          >
            {profile.username}
          </p>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
            {getSocials(profile).map((social) => {
              const icon = (
                <img
                  src={social.src}
                  alt=""
                  aria-hidden
                  style={{ width: 24, height: 24, objectFit: 'contain', opacity: social.active ? 1 : 0.32, display: 'block' }}
                />
              );

              if (!social.href) {
                if (social.copyValue) {
                  return (
                    <button
                      key={social.key}
                      type="button"
                      aria-label={`Copy Epic username ${social.copyValue}`}
                      title="Copy Epic username"
                      onClick={() => handleCopyEpicName(social.copyValue!)}
                      style={{
                        width: 24,
                        height: 24,
                        padding: 0,
                        border: 0,
                        outline: 'none',
                        background: 'transparent',
                        display: 'inline-flex',
                        cursor: 'copy',
                      }}
                    >
                      {icon}
                    </button>
                  );
                }

                return (
                  <span key={social.key} aria-label={social.label} title={social.label} style={{ width: 24, height: 24, display: 'inline-flex' }}>
                    {icon}
                  </span>
                );
              }

              return (
                <a
                  key={social.key}
                  href={social.href}
                  aria-label={social.label}
                  title={social.label}
                  target="_blank"
                  rel="noreferrer"
                  style={{ width: 24, height: 24, display: 'inline-flex' }}
                >
                  {icon}
                </a>
              );
            })}
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            left: 670,
            top: 222,
            width: 130,
            height: 60,
            borderRadius: 30,
            border: '1px solid #ff1654',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 6,
              height: 48,
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontFamily: FONT_BOLD, fontSize: 18, lineHeight: '18px', color: '#ffffff' }}>LVL.</span>
            <span style={{ fontFamily: FONT_BOLD, fontSize: 48, lineHeight: '48px', color: '#ffffff' }}>{profile.level}</span>
          </div>
        </div>

        <div style={{ position: 'absolute', left: 247, top: 265, display: 'flex', gap: 14 }}>
          <div
            style={{
              width: 111,
              height: 28,
              borderRadius: 10,
              border: '1px solid #ff1654',
              background: 'rgba(255,22,84,0.34)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box',
              fontFamily: FONT_BOLD,
              fontSize: 14,
            }}
          >
            Rank: {displayRank ? `#${displayRank}` : '--'}
          </div>
          <div
            style={{
              width: 111,
              height: 28,
              borderRadius: 10,
              border: '1px solid #ff1654',
              background: 'rgba(255,22,84,0.34)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              boxSizing: 'border-box',
              fontFamily: FONT_BOLD,
              fontSize: 14,
            }}
          >
            <span style={{ position: 'relative', width: 18, height: 14, flexShrink: 0 }}>
              <img src={PROFILE_ASSETS.teamUser} alt="" aria-hidden style={{ position: 'absolute', left: 0, top: 0, width: 10, height: 13 }} />
              <img src={PROFILE_ASSETS.teamUserSmall} alt="" aria-hidden style={{ position: 'absolute', left: 10, top: 4, width: 7, height: 9 }} />
            </span>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile.team_tag || profile.team_name || '--'}
            </span>
          </div>
        </div>
      </div>

      <img src={PROFILE_ASSETS.dividerMiddle} alt="" aria-hidden style={{ position: 'absolute', left: 144, top: 348, width: 615, height: 2 }} />

      <div style={{ position: 'absolute', left: 99, top: 385, display: 'grid', gridTemplateColumns: '340px 340px', gap: '17px 25px' }}>
        <section style={{ ...cardStyle, position: 'relative' }} aria-label="Player stats">
          <h3 style={{ ...sectionTitleStyle, position: 'absolute', left: 26, top: 15 }}>STATS</h3>
          <div style={{ position: 'absolute', left: 26, top: 73, display: 'flex', gap: 86 }}>
            <StatValue label="Win Rate" value={formatPercent(profile.stats.win_rate)} />
            <StatValue label="Total matches" value={profile.stats.total_matches} />
          </div>
          <div style={{ position: 'absolute', left: 26, top: 137, width: 278, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: FONT_BOLD, fontSize: 20, color: '#ffffff' }}>W <span style={{ fontFamily: FONT_REGULAR }}>{profile.stats.wins}</span></span>
            <span style={{ fontFamily: FONT_BOLD, fontSize: 20, color: '#ffffff' }}>L <span style={{ fontFamily: FONT_REGULAR }}>{profile.stats.losses}</span></span>
          </div>
          <div
            style={{
              position: 'absolute',
              left: 26,
              bottom: 23,
              width: 278,
              height: 13,
              borderRadius: 4,
              background: `linear-gradient(90deg, rgba(119,254,92,0.79) 0 ${winRate}%, #ff1654 ${winRate}% ${winRate + lossRate}%)`,
            }}
          />
        </section>

        <section style={{ ...cardStyle, position: 'relative' }} aria-label="Player tokens">
          <h3 style={{ ...sectionTitleStyle, position: 'absolute', left: 26, top: 15 }}>TOKENS</h3>
          <div style={{ position: 'absolute', left: 32, top: 73, display: 'grid', gridTemplateColumns: '118px 140px', rowGap: 10 }}>
            <StatValue label="Profit" value={formatToken(profile.tokens.total_profit, true)} color={profile.tokens.total_profit >= 0 ? 'rgba(119,254,92,0.79)' : '#ff1654'} />
            <StatValue label="Total earnings" value={formatToken(profile.tokens.total_earned)} />
            <StatValue label="AVG/Profit" value={formatToken(profile.tokens.avg_profit_per_match, true)} color={profile.tokens.avg_profit_per_match >= 0 ? 'rgba(119,254,92,0.79)' : '#ff1654'} large={false} />
            <StatValue label="AVG/Match" value={formatToken(profile.tokens.avg_earnings_per_match)} large={false} />
          </div>
        </section>

        <section style={{ ...smallCardStyle, position: 'relative' }} aria-label="Player history">
          <h3 style={{ ...sectionTitleStyle, position: 'absolute', left: 26, top: 14 }}>HISTORY</h3>
          <div
            style={{
              position: 'absolute',
              left: 26,
              top: 66,
              width: 278,
              height: 35,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            {history.slice(0, 5).map((item) => (
              <HistoryIcon key={item.match_id} item={item} />
            ))}
          </div>
        </section>

        <section style={{ ...smallCardStyle, position: 'relative' }} aria-label="Player streak">
          <h3 style={{ ...sectionTitleStyle, position: 'absolute', left: 26, top: 14 }}>STREAK</h3>
          <div style={{ position: 'absolute', left: 32, top: 66, display: 'flex', gap: 102 }}>
            <StatValue label="Best" value={profile.streak.best} large={false} />
            <StatValue label="Current" value={profile.streak.current} color="#ff1654" large={false} />
          </div>
        </section>
      </div>
    </>
  );
}

function PlayerStatsModalSurface({ userId, onClose, rankOverride }: { userId: string; onClose: () => void; rankOverride?: number | null }) {
  const { data, isPending, error } = usePlayerProfileView(userId, true);

  return (
    <div
      data-testid="player-profile-overlay"
      style={overlayStyle}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-profile-title"
        style={panelStyle}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2
          id="player-profile-title"
          style={{
            position: 'absolute',
            left: 0,
        top: 37,
            width: '100%',
            margin: 0,
            fontFamily: FONT_EXPANDED_BLACK,
            fontSize: 64,
            lineHeight: '77px',
            textAlign: 'center',
            color: '#ffffff',
          }}
        >
          PROFILE VIEW
        </h2>
        <img src={PROFILE_ASSETS.dividerTop} alt="" aria-hidden style={{ position: 'absolute', left: 144, top: 124, width: 615, height: 2 }} />

        {isPending && <ProfileLoadingState />}
        {error && <ProfileErrorState message={error instanceof Error ? error.message : 'Player profile unavailable'} />}
        {data && <PlayerProfileContent profile={data} rankOverride={rankOverride} />}
      </section>
    </div>
  );
}

export function PlayerStatsModal({ open, onOpenChange, userId, rankOverride }: PlayerStatsModalProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onOpenChange, open]);

  if (!open || !userId || typeof document === 'undefined') return null;

  return createPortal(
    <PlayerStatsModalSurface userId={userId} rankOverride={rankOverride} onClose={() => onOpenChange(false)} />,
    document.body,
  );
}

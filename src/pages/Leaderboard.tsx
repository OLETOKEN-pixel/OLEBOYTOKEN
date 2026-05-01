import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FooterSection } from '@/components/home/sections/FooterSection';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { PlayerStatsModal } from '@/components/player/PlayerStatsModal';
import {
  leaderboardPageSize,
  usePlayerLeaderboard,
  useTeamLeaderboard,
} from '@/hooks/useLeaderboardPage';
import { useIsMobile } from '@/hooks/use-mobile';
import { getDiscordAvatarUrl } from '@/lib/avatar';
import type {
  LeaderboardTab,
  PlayerLeaderboardMetricRow,
  PlayerLeaderboardTab,
  TeamLeaderboardRow,
} from '@/types';

const FONT_REGULAR = "'Base_Neue_Trial:Regular', 'Base Neue Trial', sans-serif";
const FONT_REGULAR_OBLIQUE = "'Base_Neue_Trial:Regular_Oblique', 'Base Neue Trial', sans-serif";
const FONT_BOLD = "'Base_Neue_Trial:Bold', 'Base Neue Trial', sans-serif";
const FONT_BOLD_OBLIQUE = "'Base_Neue_Trial:Bold_Oblique', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED = "'Base_Neue_Trial:Expanded', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED_BOLD = "'Base_Neue_Trial:Expanded_Bold', 'Base Neue Trial', sans-serif";
const FONT_HEAD = "'Base_Neue_Trial:Expanded_Black_Oblique', 'Base Neue Trial', sans-serif";

const ASSETS = {
  topNeon: '/figma-assets/leaderboard/top-neon.png',
  titleOutline: '/figma-assets/leaderboard/title-outline.svg',
  titleTriangles: '/figma-assets/leaderboard/title-triangles.svg',
  searchIcon: '/figma-assets/leaderboard/search-icon.svg',
  rowDivider: '/figma-assets/leaderboard/row-divider.svg',
  paginationArrowLeft: '/figma-assets/leaderboard/pagination-arrow-left.svg',
  paginationArrowRight: '/figma-assets/leaderboard/pagination-arrow-right.svg',
  activeTabUnderline: '/figma-assets/leaderboard/active-tab-underline.svg',
  rankStars: {
    1: '/figma-assets/leaderboard/rank-star-1.svg',
    2: '/figma-assets/leaderboard/rank-star-2.svg',
    3: '/figma-assets/leaderboard/rank-star-3.svg',
  } as const,
};

const DESKTOP_TAB_SPECS: Record<
  LeaderboardTab,
  { label: string; value: LeaderboardTab; width: number; left: number }
> = {
  earnings: { label: 'MOST EARNINGS', value: 'earnings', width: 192, left: 150 },
  profit: { label: 'MOST PROFIT', value: 'profit', width: 153, left: 471 },
  wins: { label: 'MOST WINS', value: 'wins', width: 132, left: 753 },
  teams: { label: 'TEAMS EARNINGS', value: 'teams', width: 211, left: 1014 },
};

const TAB_ORDER: LeaderboardTab[] = ['earnings', 'profit', 'wins', 'teams'];
const DESKTOP_RAIL_WIDTH = 1350;
const DESKTOP_ROW_LAYOUT = {
  railWidth: 1350,
  rankWidth: 111,
  avatarLeft: 146,
  avatarSize: 68,
  nameLeft: 253,
  metricWidth: 353,
};

const pageShellStyle: CSSProperties = {
  position: 'relative',
  minHeight: '100vh',
  background: '#0f0404',
  color: '#ffffff',
  overflowX: 'hidden',
};

const titleLockupStyle: CSSProperties = {
  position: 'relative',
  width: 'min(1532px, calc(100vw - 120px))',
  margin: '0 auto',
  minHeight: '216px',
  zIndex: 2,
};

const boardPanelStyle: CSSProperties = {
  width: 'min(1448px, calc(100vw - 96px))',
  minHeight: '1136px',
  margin: '0 auto',
  borderRadius: '14px',
  background: '#282828',
  position: 'relative',
  overflow: 'hidden',
  boxSizing: 'border-box',
};

const DESKTOP_TITLE_OUTLINE_FRAME = {
  width: 1023.462,
  height: 21.999,
  innerWidth: 18.421,
  innerHeight: 1023.404,
};

type LeaderboardRow = PlayerLeaderboardMetricRow | TeamLeaderboardRow;

function isLeaderboardTab(value: string | null): value is LeaderboardTab {
  return value === 'earnings' || value === 'profit' || value === 'wins' || value === 'teams';
}

function getActiveTab(searchParams: URLSearchParams): LeaderboardTab {
  const raw = searchParams.get('tab');
  return isLeaderboardTab(raw) ? raw : 'earnings';
}

function isPlayerTab(tab: LeaderboardTab): tab is PlayerLeaderboardTab {
  return tab !== 'teams';
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(Math.abs(value))
    .replace(/,/g, ' ');
}

function formatRowMetric(tab: LeaderboardTab, row: LeaderboardRow) {
  if (tab === 'wins') return String(Math.round(row.wins));

  const rawValue =
    tab === 'profit'
      ? (row as PlayerLeaderboardMetricRow).total_profit
      : row.total_earnings;

  if (rawValue === 0) return '0.00';
  const sign = rawValue > 0 ? '+ ' : '- ';
  return `${sign}${formatDecimal(rawValue)}`;
}

function getMetricColor(tab: LeaderboardTab, row: LeaderboardRow) {
  if (tab === 'wins') return 'rgba(119,254,92,0.79)';
  const rawValue =
    tab === 'profit'
      ? (row as PlayerLeaderboardMetricRow).total_profit
      : row.total_earnings;
  return rawValue >= 0 ? 'rgba(119,254,92,0.79)' : '#ff8ead';
}

function getAvatarInitial(label: string) {
  return label.trim().charAt(0).toUpperCase() || 'P';
}

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);

  return debounced;
}

function RowDivider({ top }: { top?: string | number }) {
  return (
    <img
      src={ASSETS.rowDivider}
      alt=""
      aria-hidden="true"
      style={{
        position: top != null ? 'absolute' : 'relative',
        top,
        left: top != null ? '50%' : undefined,
        transform: top != null ? 'translateX(-50%)' : undefined,
        width: '1350px',
        height: '1px',
        display: 'block',
        maxWidth: 'calc(100% - 98px)',
        pointerEvents: 'none',
      }}
    />
  );
}

function AvatarCircle({
  src,
  label,
  size,
  square = false,
}: {
  src: string | null;
  label: string;
  size: number;
  square?: boolean;
}) {
  const radius = square ? '18px' : '999px';

  if (src) {
    return (
      <img
        src={src}
        alt={label}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: radius,
          objectFit: 'cover',
          flex: '0 0 auto',
          display: 'block',
          background: '#d9d9d9',
        }}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: radius,
        background: 'rgba(255,255,255,0.82)',
        flex: '0 0 auto',
        display: 'grid',
        placeItems: 'center',
        color: '#1d1d1d',
        fontFamily: FONT_EXPANDED_BOLD,
        fontSize: `${Math.max(20, size * 0.34)}px`,
        lineHeight: 1,
      }}
    >
      {getAvatarInitial(label)}
    </div>
  );
}

function TeamAvatar({ row, size }: { row: TeamLeaderboardRow; size: number }) {
  return (
    <AvatarCircle
      src={row.logo_url || getDiscordAvatarUrl({
        avatar_url: row.owner_avatar_url,
        discord_avatar_url: row.owner_discord_avatar_url,
      })}
      label={row.team_name}
      size={size}
    />
  );
}

function PlayerAvatar({
  row,
  size,
  onOpen,
  compact = false,
}: {
  row: PlayerLeaderboardMetricRow;
  size: number;
  onOpen: () => void;
  compact?: boolean;
}) {
  const avatarUrl = getDiscordAvatarUrl(row);
  const radius = compact ? '18px' : '999px';

  return (
    <button
      type="button"
      aria-label={`Open ${row.username} profile`}
      onClick={onOpen}
      style={{
        border: 0,
        background: 'transparent',
        padding: 0,
        cursor: 'pointer',
        flex: '0 0 auto',
        borderRadius: radius,
      }}
    >
      <AvatarCircle src={avatarUrl} label={row.username} size={size} />
    </button>
  );
}

function RankBadgeDesktop({ rank }: { rank: number }) {
  const isTopThree = rank >= 1 && rank <= 3;

  if (!isTopThree) {
    return (
      <div
        aria-hidden="true"
        style={{
          width: '111px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#9c9c9c',
          fontFamily: FONT_HEAD,
          fontSize: '24px',
          lineHeight: '29px',
          letterSpacing: 0,
        }}
      >
        <span style={{ fontFamily: FONT_BOLD_OBLIQUE }}>#{rank}</span>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      style={{
        width: '111px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      <img
        src={ASSETS.rankStars[rank as 1 | 2 | 3]}
        alt=""
        style={{ width: '95.938px', height: '95.938px', display: 'block' }}
      />
      <span
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -58%)',
          fontFamily: FONT_HEAD,
          fontSize: '27.164px',
          lineHeight: '33px',
          color: '#ffffff',
          whiteSpace: 'nowrap',
        }}
      >
        #{rank}
      </span>
    </div>
  );
}

function DesktopRow({
  row,
  tab,
  onOpenPlayer,
}: {
  row: LeaderboardRow | null;
  tab: LeaderboardTab;
  onOpenPlayer: (userId: string, rank: number) => void;
}) {
  const name =
    row == null
      ? ''
      : 'team_name' in row
        ? row.team_name
        : row.username;

  return (
    <div
      style={{
        position: 'relative',
        height: '105px',
        width: 'min(1350px, calc(100% - 98px))',
        margin: '0 auto',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: `${DESKTOP_ROW_LAYOUT.rankWidth}px`,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {row ? <RankBadgeDesktop rank={row.rank} /> : <div style={{ width: '111px' }} />}
      </div>

      <div
        style={{
          position: 'absolute',
          left: `${DESKTOP_ROW_LAYOUT.avatarLeft}px`,
          top: 0,
          width: `${DESKTOP_ROW_LAYOUT.avatarSize}px`,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {row == null ? null : 'team_name' in row ? (
          <TeamAvatar row={row} size={68} />
        ) : (
          <PlayerAvatar row={row} size={68} onOpen={() => onOpenPlayer(row.user_id, row.rank)} />
        )}
      </div>

      <div
        style={{
          position: 'absolute',
          left: `${DESKTOP_ROW_LAYOUT.nameLeft}px`,
          right: `${DESKTOP_ROW_LAYOUT.metricWidth}px`,
          top: 0,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          minWidth: 0,
          fontFamily: FONT_EXPANDED_BOLD,
          fontSize: '24px',
          lineHeight: '29px',
          color: '#ffffff',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {name}
      </div>

      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: `${DESKTOP_ROW_LAYOUT.metricWidth}px`,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          justifyContent: 'flex-end',
          color: row ? getMetricColor(tab, row) : 'transparent',
          fontFamily: FONT_EXPANDED_BOLD,
          fontSize: '24px',
          lineHeight: '29px',
          textAlign: 'right',
          whiteSpace: 'nowrap',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: '14px',
            height: '14px',
            borderRadius: '999px',
            background: '#ff1654',
            display: 'inline-block',
            opacity: row ? 1 : 0,
            flexShrink: 0,
          }}
        />
        <span>{row ? formatRowMetric(tab, row) : ''}</span>
      </div>
    </div>
  );
}

function DesktopBoard({
  activeTab,
  rows,
  isLoading,
  isError,
  onOpenPlayer,
  onChangeTab,
}: {
  activeTab: LeaderboardTab;
  rows: LeaderboardRow[];
  isLoading: boolean;
  isError: boolean;
  onOpenPlayer: (userId: string, rank: number) => void;
  onChangeTab: (tab: LeaderboardTab) => void;
}) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Record<LeaderboardTab, HTMLButtonElement | null>>({
    earnings: null,
    profit: null,
    wins: null,
    teams: null,
  });
  const [underlineLeft, setUnderlineLeft] = useState(0);

  useEffect(() => {
    const updateUnderline = () => {
      const rail = railRef.current;
      const activeButton = tabRefs.current[activeTab];
      if (!rail || !activeButton) return;

      const railRect = rail.getBoundingClientRect();
      const activeRect = activeButton.getBoundingClientRect();
      setUnderlineLeft(activeRect.left - railRect.left + (activeRect.width - 211) / 2);
    };

    updateUnderline();
    window.addEventListener('resize', updateUnderline);
    return () => window.removeEventListener('resize', updateUnderline);
  }, [activeTab]);

  const paddedRows = [...rows];
  while (paddedRows.length < leaderboardPageSize) paddedRows.push(null as never);

  return (
    <div style={boardPanelStyle}>
      <div
        ref={railRef}
        style={{
          position: 'relative',
          width: 'min(1350px, calc(100% - 98px))',
          margin: '0 auto',
          height: '75px',
        }}
      >
        {TAB_ORDER.map((tab) => {
          const spec = DESKTOP_TAB_SPECS[tab];
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              ref={(node) => {
                tabRefs.current[tab] = node;
              }}
              type="button"
              onClick={() => onChangeTab(tab)}
              style={{
                position: 'absolute',
                left: `${(spec.left / DESKTOP_RAIL_WIDTH) * 100}%`,
                top: 0,
                width: `${spec.width}px`,
                height: '75px',
                border: 0,
                background: 'transparent',
                cursor: isActive ? 'default' : 'pointer',
                padding: 0,
                opacity: isActive ? 1 : 0.5,
                color: '#ffffff',
                fontFamily: isActive ? FONT_BOLD : FONT_REGULAR,
                fontSize: '24px',
                lineHeight: '29px',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                whiteSpace: 'nowrap',
                letterSpacing: 0,
              }}
            >
              {spec.label}
            </button>
          );
        })}

        <img
          src={ASSETS.activeTabUnderline}
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: `${underlineLeft}px`,
            bottom: 0,
            width: '211px',
            height: '3px',
            display: 'block',
          }}
        />
        <RowDivider top={75} />
      </div>

      <div style={{ position: 'relative' }}>
        {paddedRows.map((row, index) => (
          <div key={row ? `${activeTab}-${'team_id' in row ? row.team_id : row.user_id}` : `empty-${index}`}>
            <DesktopRow row={row} tab={activeTab} onOpenPlayer={onOpenPlayer} />
            {index < leaderboardPageSize - 1 ? <RowDivider /> : null}
          </div>
        ))}

        {isLoading ? (
          <BoardOverlay message="Loading leaderboard..." />
        ) : null}
        {isError ? (
          <BoardOverlay message="Unable to load leaderboard right now." />
        ) : null}
      </div>
    </div>
  );
}

function BoardOverlay({ message }: { message: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(40,40,40,0.72)',
        display: 'grid',
        placeItems: 'center',
        pointerEvents: 'none',
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: FONT_EXPANDED_BOLD,
          fontSize: '22px',
          lineHeight: '26px',
          color: '#ffffff',
          textAlign: 'center',
        }}
      >
        {message}
      </p>
    </div>
  );
}

function PaginationControls({
  page,
  hasNextPage,
  onPrevious,
  onNext,
  compact = false,
}: {
  page: number;
  hasNextPage: boolean;
  onPrevious: () => void;
  onNext: () => void;
  compact?: boolean;
}) {
  const iconStyle: CSSProperties = {
    width: compact ? '18px' : '21.071px',
    height: compact ? '14px' : '15.653px',
    display: 'block',
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        gap: compact ? '28px' : '86px',
        alignItems: 'center',
        marginTop: compact ? '30px' : '68px',
      }}
    >
      <button
        type="button"
        onClick={onPrevious}
        disabled={page === 0}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: compact ? '8px' : '12px',
          border: 0,
          background: 'transparent',
          color: '#ffffff',
          cursor: page === 0 ? 'not-allowed' : 'pointer',
          opacity: page === 0 ? 0.34 : 1,
          fontFamily: FONT_BOLD,
          fontSize: compact ? '20px' : '24px',
          lineHeight: compact ? '24px' : '29px',
          padding: 0,
        }}
      >
        <img
          src={ASSETS.paginationArrowLeft}
          alt=""
          aria-hidden="true"
          style={{ ...iconStyle, transform: 'rotate(-90deg) scaleY(-1)' }}
        />
        <span>PREVIOUS</span>
      </button>

      <button
        type="button"
        onClick={onNext}
        disabled={!hasNextPage}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: compact ? '8px' : '12px',
          border: 0,
          background: 'transparent',
          color: '#ffffff',
          cursor: !hasNextPage ? 'not-allowed' : 'pointer',
          opacity: !hasNextPage ? 0.34 : 1,
          fontFamily: FONT_BOLD,
          fontSize: compact ? '20px' : '24px',
          lineHeight: compact ? '24px' : '29px',
          padding: 0,
        }}
      >
        <span>NEXT</span>
        <img
          src={ASSETS.paginationArrowRight}
          alt=""
          aria-hidden="true"
          style={{ ...iconStyle, transform: 'rotate(90deg) scaleY(-1)' }}
        />
      </button>
    </div>
  );
}

function TitleLockup({ compact = false }: { compact?: boolean }) {
  const desktopOutlineTargetWidth = compact ? 612 : DESKTOP_TITLE_OUTLINE_FRAME.width;
  const desktopOutlineScale = desktopOutlineTargetWidth / DESKTOP_TITLE_OUTLINE_FRAME.width;

  if (compact) {
    return (
      <div
        style={{
          ...titleLockupStyle,
          width: '100%',
          minHeight: '126px',
        }}
      >
        <img
          src={ASSETS.titleTriangles}
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '74px',
            height: '111px',
            display: 'block',
          }}
        />
        <h1
          style={{
            position: 'absolute',
            top: '20px',
            left: '24px',
            margin: 0,
            fontFamily: FONT_HEAD,
            fontSize: '48px',
            lineHeight: '58px',
            color: '#ffffff',
            letterSpacing: 0,
            whiteSpace: 'nowrap',
          }}
        >
          LEADERBOARD
        </h1>
        <div
          style={{
            position: 'absolute',
            top: '84px',
            left: '17px',
            width: 'min(612px, calc(100% - 12px))',
            height: `${DESKTOP_TITLE_OUTLINE_FRAME.height * desktopOutlineScale}px`,
            overflow: 'visible',
          }}
        >
          <div
            style={{
              width: `${DESKTOP_TITLE_OUTLINE_FRAME.width}px`,
              height: `${DESKTOP_TITLE_OUTLINE_FRAME.height}px`,
              transform: `scale(${desktopOutlineScale})`,
              transformOrigin: 'top left',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  transform: 'rotate(89.8deg) scaleY(-1)',
                  width: `${DESKTOP_TITLE_OUTLINE_FRAME.innerWidth}px`,
                  height: `${DESKTOP_TITLE_OUTLINE_FRAME.innerHeight}px`,
                  position: 'relative',
                  flex: '0 0 auto',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: '25%',
                    left: '6.7%',
                    right: '6.7%',
                  }}
                >
                  <img
                    src={ASSETS.titleOutline}
                    alt=""
                    aria-hidden="true"
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'block',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        ...titleLockupStyle,
        width: titleLockupStyle.width,
        minHeight: titleLockupStyle.minHeight,
      }}
    >
      <img
        src={ASSETS.titleTriangles}
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: '-70px',
          width: '123.871px',
          height: '185.808px',
          display: 'block',
        }}
      />
      <h1
        style={{
          position: 'absolute',
          top: '77px',
          left: '0',
          margin: 0,
          fontFamily: FONT_HEAD,
          fontSize: '80px',
          lineHeight: '97px',
          color: '#ffffff',
          letterSpacing: 0,
          whiteSpace: 'nowrap',
        }}
      >
        LEADERBOARD
      </h1>
      <div
        style={{
          position: 'absolute',
          top: '164.79px',
          left: '-12px',
          width: `${DESKTOP_TITLE_OUTLINE_FRAME.width}px`,
          height: `${DESKTOP_TITLE_OUTLINE_FRAME.height}px`,
          overflow: 'visible',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              transform: 'rotate(89.8deg) scaleY(-1)',
              width: `${DESKTOP_TITLE_OUTLINE_FRAME.innerWidth}px`,
              height: `${DESKTOP_TITLE_OUTLINE_FRAME.innerHeight}px`,
              position: 'relative',
              flex: '0 0 auto',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: '25%',
                left: '6.7%',
                right: '6.7%',
              }}
            >
              <img
                src={ASSETS.titleOutline}
                alt=""
                aria-hidden="true"
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'block',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SearchBar({
  value,
  onChange,
  compact = false,
}: {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  compact?: boolean;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        width: compact ? '100%' : '400px',
        height: compact ? '49px' : '47px',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.15)',
        background: '#282828',
        padding: '0 16px 0 18px',
        boxSizing: 'border-box',
      }}
    >
      <input
        value={value}
        onChange={onChange}
        placeholder="Search for a player"
        aria-label="Search for a player"
        style={{
          flex: 1,
          minWidth: 0,
          background: 'transparent',
          border: 0,
          outline: 'none',
          color: '#ffffff',
          opacity: 1,
          fontFamily: FONT_REGULAR,
          fontSize: compact ? '18px' : '20px',
          lineHeight: compact ? '22px' : '24px',
        }}
      />
      <img
        src={ASSETS.searchIcon}
        alt=""
        aria-hidden="true"
        style={{
          width: '18px',
          height: '26px',
          display: 'block',
          opacity: 0.6,
          transform: 'rotate(-45deg)',
          flexShrink: 0,
        }}
      />
    </label>
  );
}

function MobileTabBar({
  activeTab,
  onChangeTab,
}: {
  activeTab: LeaderboardTab;
  onChangeTab: (tab: LeaderboardTab) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '10px',
        overflowX: 'auto',
        paddingBottom: '6px',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {TAB_ORDER.map((tab) => {
        const spec = DESKTOP_TAB_SPECS[tab];
        const isActive = tab === activeTab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChangeTab(tab)}
            style={{
              flex: '0 0 auto',
              minWidth: `${Math.max(126, spec.width - 18)}px`,
              height: '42px',
              borderRadius: '999px',
              border: `1px solid ${isActive ? '#ff1654' : 'rgba(255,255,255,0.12)'}`,
              background: isActive ? 'rgba(255,22,84,0.22)' : 'rgba(255,255,255,0.03)',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '0 16px',
              fontFamily: isActive ? FONT_BOLD : FONT_REGULAR,
              fontSize: '16px',
              lineHeight: '20px',
              whiteSpace: 'nowrap',
            }}
          >
            {spec.label}
          </button>
        );
      })}
    </div>
  );
}

function MobileRow({
  row,
  tab,
  onOpenPlayer,
}: {
  row: LeaderboardRow | null;
  tab: LeaderboardTab;
  onOpenPlayer: (userId: string, rank: number) => void;
}) {
  const name =
    row == null
      ? ''
      : 'team_name' in row
        ? row.team_name
        : row.username;

  return (
    <div
      style={{
        borderRadius: '14px',
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(40,40,40,0.96)',
        padding: '14px',
        minHeight: '88px',
        display: 'grid',
        gridTemplateColumns: '56px 52px minmax(0,1fr)',
        columnGap: '12px',
        alignItems: 'center',
        position: 'relative',
      }}
    >
      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          fontFamily: FONT_BOLD_OBLIQUE,
          fontSize: '22px',
          lineHeight: '26px',
          color: row ? '#ffffff' : 'transparent',
        }}
      >
        {row && row.rank <= 3 ? (
          <div style={{ position: 'relative', width: '56px', height: '56px' }}>
            <img
              src={ASSETS.rankStars[row.rank as 1 | 2 | 3]}
              alt=""
              aria-hidden="true"
              style={{ width: '56px', height: '56px', display: 'block' }}
            />
            <span
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                fontFamily: FONT_HEAD,
                fontSize: '18px',
                lineHeight: '22px',
              }}
            >
              #{row.rank}
            </span>
          </div>
        ) : (
          row ? `#${row.rank}` : ''
        )}
      </div>

      {row == null ? null : 'team_name' in row ? (
        <TeamAvatar row={row} size={52} />
      ) : (
        <PlayerAvatar row={row} size={52} onOpen={() => onOpenPlayer(row.user_id, row.rank)} compact />
      )}

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: FONT_EXPANDED_BOLD,
            fontSize: '20px',
            lineHeight: '24px',
            color: '#ffffff',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {name}
        </div>
        <div
          style={{
            marginTop: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: row ? getMetricColor(tab, row) : 'transparent',
            fontFamily: FONT_EXPANDED_BOLD,
            fontSize: '18px',
            lineHeight: '22px',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '999px',
              background: '#ff1654',
              display: 'inline-block',
              opacity: row ? 1 : 0,
              flexShrink: 0,
            }}
          />
          <span>{row ? formatRowMetric(tab, row) : ''}</span>
        </div>
      </div>
    </div>
  );
}

function MobileFooter() {
  const groupTitle: CSSProperties = {
    margin: 0,
    fontFamily: FONT_HEAD,
    fontSize: '20px',
    lineHeight: '24px',
    color: '#ff1654',
  };

  const linkStyle: CSSProperties = {
    fontFamily: FONT_REGULAR,
    fontSize: '14px',
    lineHeight: '20px',
    color: '#e6e6e6',
    textDecoration: 'underline',
  };

  return (
    <section
      style={{
        position: 'relative',
        marginTop: '72px',
        padding: '40px 20px 34px',
        borderTop: '0.5px solid #ffffff',
        background: '#0f0404',
        overflow: 'hidden',
      }}
    >
      <p
        aria-hidden="true"
        style={{
          margin: 0,
          fontFamily: FONT_HEAD,
          fontSize: '112px',
          lineHeight: '0.9',
          backgroundImage: 'linear-gradient(180.075deg, rgb(15, 4, 4) 10.117%, rgb(255, 255, 255) 99.722%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          color: 'transparent',
          position: 'absolute',
          top: '-6px',
          left: '20px',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      >
        OLEBOY
      </p>

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'grid',
          gap: '24px',
          paddingTop: '96px',
        }}
      >
        <div style={{ display: 'grid', gap: '10px' }}>
          <p style={groupTitle}>SOCIALS</p>
          <a href="https://x.com/oleboytokens" rel="noopener noreferrer" target="_blank" style={linkStyle}>X/Twitter</a>
          <a href="https://www.tiktok.com/@oleboytokens" rel="noopener noreferrer" target="_blank" style={linkStyle}>TikTok</a>
          <a href="https://discord.gg/2XVffNDPAE" rel="noopener noreferrer" target="_blank" style={linkStyle}>Discord</a>
        </div>

        <div style={{ display: 'grid', gap: '10px' }}>
          <p style={groupTitle}>CONTACT US</p>
          <a href="mailto:coolowner.2025@gmail.com" style={linkStyle}>coolowner.2025@gmail.com</a>
          <a href="mailto:letterio.tomasini@gmail.com" style={linkStyle}>letterio.tomasini@gmail.com</a>
        </div>

        <div style={{ display: 'grid', gap: '10px' }}>
          <p style={groupTitle}>PRIVACY</p>
          <Link to="/terms" style={linkStyle}>Terms &amp; Conditions</Link>
        </div>

        <p
          style={{
            margin: '8px 0 0',
            fontFamily: FONT_REGULAR,
            fontSize: '14px',
            lineHeight: '18px',
            color: '#e6e6e6',
          }}
        >
          {'\u00A9'} 2026 OLEBOY. All Rights Reserved.
        </p>
      </div>
    </section>
  );
}

function LeaderboardDesktopContent({
  activeTab,
  searchInput,
  onSearchChange,
  rows,
  page,
  hasNextPage,
  isLoading,
  isError,
  onChangeTab,
  onPreviousPage,
  onNextPage,
  onOpenPlayer,
}: {
  activeTab: LeaderboardTab;
  searchInput: string;
  onSearchChange: (event: ChangeEvent<HTMLInputElement>) => void;
  rows: LeaderboardRow[];
  page: number;
  hasNextPage: boolean;
  isLoading: boolean;
  isError: boolean;
  onChangeTab: (tab: LeaderboardTab) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onOpenPlayer: (userId: string, rank: number) => void;
}) {
  return (
    <>
      <div style={{ paddingTop: '156px' }}>
        <TitleLockup />

        <div
          style={{
            width: 'min(1532px, calc(100vw - 120px))',
            margin: '0 auto',
            marginTop: '24px',
            marginBottom: '53px',
          }}
        >
          <SearchBar value={searchInput} onChange={onSearchChange} />
        </div>

        <DesktopBoard
          activeTab={activeTab}
          rows={rows}
          isLoading={isLoading}
          isError={isError}
          onOpenPlayer={onOpenPlayer}
          onChangeTab={onChangeTab}
        />

        <PaginationControls
          page={page}
          hasNextPage={hasNextPage}
          onPrevious={onPreviousPage}
          onNext={onNextPage}
        />
      </div>

      <div style={{ marginTop: '75px' }}>
        <FooterSection />
      </div>
    </>
  );
}

function LeaderboardMobileContent({
  activeTab,
  searchInput,
  onSearchChange,
  rows,
  page,
  hasNextPage,
  isLoading,
  isError,
  onChangeTab,
  onPreviousPage,
  onNextPage,
  onOpenPlayer,
}: {
  activeTab: LeaderboardTab;
  searchInput: string;
  onSearchChange: (event: ChangeEvent<HTMLInputElement>) => void;
  rows: LeaderboardRow[];
  page: number;
  hasNextPage: boolean;
  isLoading: boolean;
  isError: boolean;
  onChangeTab: (tab: LeaderboardTab) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onOpenPlayer: (userId: string, rank: number) => void;
}) {
  const paddedRows = [...rows];
  while (paddedRows.length < leaderboardPageSize) paddedRows.push(null as never);

  return (
    <>
      <div style={{ padding: '104px 16px 0', position: 'relative', zIndex: 2 }}>
        <div style={{ maxWidth: '430px', margin: '0 auto' }}>
          <TitleLockup compact />

          <div style={{ marginTop: '18px' }}>
            <SearchBar value={searchInput} onChange={onSearchChange} compact />
          </div>

          <div style={{ marginTop: '22px' }}>
            <MobileTabBar activeTab={activeTab} onChangeTab={onChangeTab} />
          </div>

          <div style={{ marginTop: '18px', display: 'grid', gap: '10px' }}>
            {paddedRows.map((row, index) => (
              <MobileRow
                key={row ? `${activeTab}-${'team_id' in row ? row.team_id : row.user_id}` : `mobile-empty-${index}`}
                row={row}
                tab={activeTab}
                onOpenPlayer={onOpenPlayer}
              />
            ))}
          </div>

          {isLoading ? (
            <p
              style={{
                margin: '18px 0 0',
                fontFamily: FONT_EXPANDED_BOLD,
                fontSize: '18px',
                lineHeight: '22px',
                textAlign: 'center',
              }}
            >
              Loading leaderboard...
            </p>
          ) : null}

          {isError ? (
            <p
              style={{
                margin: '18px 0 0',
                fontFamily: FONT_EXPANDED_BOLD,
                fontSize: '18px',
                lineHeight: '22px',
                textAlign: 'center',
              }}
            >
              Unable to load leaderboard right now.
            </p>
          ) : null}

          <PaginationControls
            page={page}
            hasNextPage={hasNextPage}
            onPrevious={onPreviousPage}
            onNext={onNextPage}
            compact
          />
        </div>
      </div>

      <MobileFooter />
    </>
  );
}

export default function Leaderboard() {
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = getActiveTab(searchParams);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 250);
  const [page, setPage] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRank, setSelectedRank] = useState<number | null>(null);

  const playerQuery = usePlayerLeaderboard(
    isPlayerTab(activeTab) ? activeTab : 'earnings',
    debouncedSearch,
    page,
    activeTab !== 'teams',
  );
  const teamQuery = useTeamLeaderboard(debouncedSearch, page, activeTab === 'teams');
  const activeQuery = activeTab === 'teams' ? teamQuery : playerQuery;

  const rows = useMemo<LeaderboardRow[]>(() => activeQuery.data?.rows ?? [], [activeQuery.data]);
  const hasNextPage = activeQuery.data?.hasNextPage ?? false;
  const isLoading = activeQuery.isLoading;
  const isError = activeQuery.isError;

  useEffect(() => {
    setSearchInput('');
    setPage(0);
  }, [activeTab]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const handleChangeTab = (tab: LeaderboardTab) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('tab', tab);
      return next;
    });
  };

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchInput(event.target.value);
  };

  const handleOpenPlayer = (userId: string, rank: number) => {
    setSelectedUserId(userId);
    setSelectedRank(rank);
  };

  return (
    <PublicLayout>
      <div data-testid="leaderboard-page" data-leaderboard-tab={activeTab} style={pageShellStyle}>
        <img
          src={ASSETS.topNeon}
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '146px',
            objectFit: 'cover',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />

        {isMobile ? (
          <LeaderboardMobileContent
            activeTab={activeTab}
            searchInput={searchInput}
            onSearchChange={handleSearchChange}
            rows={rows}
            page={page}
            hasNextPage={hasNextPage}
            isLoading={isLoading}
            isError={isError}
            onChangeTab={handleChangeTab}
            onPreviousPage={() => setPage((current) => Math.max(0, current - 1))}
            onNextPage={() => setPage((current) => (hasNextPage ? current + 1 : current))}
            onOpenPlayer={handleOpenPlayer}
          />
        ) : (
          <LeaderboardDesktopContent
            activeTab={activeTab}
            searchInput={searchInput}
            onSearchChange={handleSearchChange}
            rows={rows}
            page={page}
            hasNextPage={hasNextPage}
            isLoading={isLoading}
            isError={isError}
            onChangeTab={handleChangeTab}
            onPreviousPage={() => setPage((current) => Math.max(0, current - 1))}
            onNextPage={() => setPage((current) => (hasNextPage ? current + 1 : current))}
            onOpenPlayer={handleOpenPlayer}
          />
        )}
      </div>

      <PlayerStatsModal
        open={!!selectedUserId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedUserId(null);
            setSelectedRank(null);
          }
        }}
        userId={selectedUserId || ''}
        rankOverride={selectedRank}
      />
    </PublicLayout>
  );
}

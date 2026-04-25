import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LoadingPage } from '@/components/common/LoadingSpinner';
import { FooterSection } from '@/components/home/sections/FooterSection';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useChallenges, type Challenge } from '@/hooks/useChallenges';
import { useIsMobile } from '@/hooks/use-mobile';
import type { LevelReward } from '@/lib/levelRewards';

type ChallengeTab = 'overview' | 'daily' | 'weekly';

const FONT_REGULAR =
  "'Base_Neue_Trial:Regular', 'Base Neue Trial', 'Base Neue', sans-serif";
const FONT_BOLD =
  "'Base_Neue_Trial:Expanded_Bold', 'Base Neue Trial', 'Base Neue', sans-serif";
const FONT_HEAD =
  "'Base_Neue_Trial:Expanded_Black_Oblique', 'Base Neue Trial', 'Base Neue', sans-serif";
const FONT_ITALIC =
  "'Base_Neue_Trial:Regular_Oblique', 'Base Neue Trial', 'Base Neue', sans-serif";
const FONT_WIDE =
  "'Base_Neue_Trial:Wide_Black', 'Base Neue Trial', 'Base Neue', sans-serif";
const CHALLENGE_ASSETS = '/figma-assets/challenges';
const DESKTOP_CANVAS_WIDTH = 1920;
const DESKTOP_TOTAL_HEIGHT = 1592;

const TABS: Array<{ value: ChallengeTab; label: string }> = [
  { value: 'overview', label: 'OVERVIEW' },
  { value: 'daily', label: 'DAILY' },
  { value: 'weekly', label: 'WEEKLY' },
];

const DESKTOP_TAB_LAYOUT: Record<
  ChallengeTab,
  { center: number; width: number; fontSize: number }
> = {
  overview: { center: 902, width: 150, fontSize: 32 },
  daily: { center: 1181, width: 105, fontSize: 32 },
  weekly: { center: 1505, width: 130, fontSize: 32 },
};

function formatReward(challenge: Challenge) {
  const parts: string[] = [];

  if (challenge.reward_xp > 0) {
    parts.push(`+${challenge.reward_xp}XP`);
  }

  if (challenge.reward_coin > 0) {
    parts.push(`+${Number(challenge.reward_coin)}OBC`);
  }

  return parts.join(' ');
}

function formatResetLabel(ms: number, type: 'daily' | 'weekly') {
  const safeMs = Math.max(0, ms);
  const totalMinutes = Math.floor(safeMs / 60_000);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  if (type === 'weekly' && days > 0) {
    return `${days} ${days === 1 ? 'day' : 'days'} and ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }

  return `${totalHours} ${totalHours === 1 ? 'hour' : 'hours'} and ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}

function DesktopChallengesTitle() {
  return (
    <>
      <img
        src={`${CHALLENGE_ASSETS}/title-triangles.svg`}
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '165px',
          top: '156px',
          width: '123.871px',
          height: '185.808px',
          objectFit: 'contain',
        }}
      />

      <h1
        style={{
          position: 'absolute',
          left: '236px',
          top: '233px',
          margin: 0,
          fontFamily: FONT_HEAD,
          fontSize: '80px',
          lineHeight: 'normal',
          color: '#ffffff',
          whiteSpace: 'nowrap',
        }}
      >
        CHALLENGES
      </h1>

      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '224px',
          top: '321.1px',
          width: '933.968px',
          height: '21.686px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'visible',
        }}
      >
        <div
          style={{
            width: '18.421px',
            height: '933.91px',
            transform: 'rotate(89.8deg) scaleY(-1)',
            transformOrigin: 'center',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: '6.7%',
              right: '6.7%',
              top: 0,
              bottom: '25%',
            }}
          >
            <img
              src={`${CHALLENGE_ASSETS}/title-outline.svg`}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function DesktopChallengeTabs({
  activeTab,
  onChange,
}: {
  activeTab: ChallengeTab;
  onChange: (tab: ChallengeTab) => void;
}) {
  return (
    <div role="tablist" aria-label="Challenges views">
      {TABS.map((tab) => {
        const layout = DESKTOP_TAB_LAYOUT[tab.value];
        const active = tab.value === activeTab;

        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            data-testid={`challenges-tab-${tab.value}`}
            onClick={() => onChange(tab.value)}
            style={{
              position: 'absolute',
              left: `${layout.center}px`,
              top: '402px',
              transform: 'translateX(-50%)',
              width: `${layout.width}px`,
              padding: 0,
              border: 'none',
              background: 'transparent',
              color: active ? '#ffffff' : 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              outline: 'none',
              boxShadow: 'none',
              appearance: 'none',
              WebkitTapHighlightColor: 'transparent',
              fontFamily: active ? FONT_BOLD : FONT_REGULAR,
              fontSize: `${layout.fontSize}px`,
              lineHeight: 'normal',
              textAlign: 'center',
              textShadow: active
                ? '0px 4px 4px rgba(0,0,0,0.25)'
                : 'none',
            }}
          >
            {tab.label}
          </button>
        );
      })}

      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: `${DESKTOP_TAB_LAYOUT[activeTab].center - DESKTOP_TAB_LAYOUT[activeTab].width / 2}px`,
          top: '447px',
          width: `${DESKTOP_TAB_LAYOUT[activeTab].width}px`,
          height: '3px',
          background: '#ff1654',
        }}
      />
    </div>
  );
}

function DesktopXpRing({
  userXp,
  xpInLevel,
  xpRequired,
  xpToNext,
}: {
  userXp: number;
  xpInLevel: number;
  xpRequired: number;
  xpToNext: number;
}) {
  const size = 271.775;
  const center = size / 2;
  const radius = 100;
  const strokeWidth = 32;
  const circumference = 2 * Math.PI * radius;
  const progress = xpRequired > 0 ? xpInLevel / xpRequired : 0;
  const dashOffset = circumference * (1 - Math.min(1, Math.max(0, progress)));

  return (
    <div
      style={{
        position: 'absolute',
        left: '294px',
        top: '401px',
        width: `${size}px`,
        height: `${size}px`,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#231719"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#ff1654"
          strokeLinecap="round"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: FONT_HEAD,
            fontSize: '55.043px',
            lineHeight: 'normal',
            color: '#ffffff',
          }}
        >
          {userXp}
        </p>
        <p
          style={{
            margin: '-2px 0 0',
            fontFamily: FONT_BOLD,
            fontSize: '18.921px',
            lineHeight: 'normal',
            color: '#ffffff',
          }}
        >
          {xpToNext}XP left
        </p>
      </div>
    </div>
  );
}

function DesktopRewardCard({
  level,
  reward,
}: {
  level: number;
  reward: LevelReward | null;
}) {
  if (!reward) {
    return (
      <div
        data-testid="challenges-next-reward"
        style={{
          position: 'absolute',
          left: '285px',
          top: '673px',
          width: '324px',
          height: '117px',
        }}
      >
        <img
          src={`${CHALLENGE_ASSETS}/reward-star.svg`}
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '73.999px',
            height: '73.999px',
            transform: 'rotate(9.9deg)',
            transformOrigin: 'center',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '37px',
            top: '37px',
            width: '250px',
            height: '80px',
            border: '1px solid #ff1654',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontFamily: FONT_WIDE,
            fontSize: '20px',
          }}
        >
          All rewards unlocked
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="challenges-next-reward"
      style={{
        position: 'absolute',
        left: '285px',
        top: '673px',
        width: '324px',
        height: '117px',
      }}
    >
      <span className="sr-only">{reward.name}</span>

      <img
        src={`${CHALLENGE_ASSETS}/reward-star.svg`}
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '73.999px',
          height: '73.999px',
          transform: 'rotate(9.9deg)',
          transformOrigin: 'center',
        }}
      />

      <img
        src={`${CHALLENGE_ASSETS}/reward-lock-shackle.svg`}
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '34px',
          top: '27px',
          width: '10.123px',
          height: '8.567px',
          transform: 'rotate(17.19deg)',
          transformOrigin: 'center',
        }}
      />

      <img
        src={`${CHALLENGE_ASSETS}/reward-lock-body.svg`}
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '29px',
          top: '32.3px',
          width: '14.988px',
          height: '15.507px',
          transform: 'rotate(17.19deg)',
          transformOrigin: 'center',
        }}
      />

      <img
        src={`${CHALLENGE_ASSETS}/reward-lock-dot.svg`}
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '34px',
          top: '36px',
          width: '5.004px',
          height: '5.004px',
          transform: 'rotate(17.19deg)',
          transformOrigin: 'center',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: '37px',
          top: '37px',
          width: '250px',
          height: '80px',
          border: '1px solid #ff1654',
          borderRadius: '12px',
        }}
      />

      <p
        style={{
          position: 'absolute',
          left: '52px',
          top: '52px',
          margin: 0,
          fontFamily: FONT_REGULAR,
          fontSize: '0px',
          lineHeight: 0,
          color: '#ffffff',
          whiteSpace: 'nowrap',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '16px', lineHeight: 'normal' }}>LVL. </span>
        <span style={{ fontFamily: FONT_HEAD, fontSize: '32px', lineHeight: 'normal' }}>
          {reward.levelRequired}
        </span>
      </p>

      <div
        style={{
          position: 'absolute',
          left: '221px',
          top: '49px',
          width: '55.055px',
          height: '54.945px',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img
          src={reward.image}
          alt={reward.name}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
          }}
        />
      </div>
    </div>
  );
}

function DesktopOverviewItem({
  left,
  asset,
  value,
  lines,
}: {
  left: number;
  asset: string;
  value: number;
  lines: string[];
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: `${left}px`,
        top: '494px',
        width: '251.071px',
        height: '255.909px',
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
            position: 'relative',
            width: '121.364px',
            height: '237.281px',
            transform: 'rotate(43.31deg)',
            transformOrigin: 'center',
          }}
        >
          <img
            src={asset}
            alt=""
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '-0.6%',
              right: '-0.79%',
              top: '-0.21%',
              bottom: '-0.12%',
              width: '101.39%',
              height: '100.33%',
              maxWidth: 'none',
              display: 'block',
            }}
          />
        </div>
      </div>

      <p
        style={{
          position: 'absolute',
          left: '67px',
          top: '49px',
          margin: 0,
          fontFamily: FONT_HEAD,
          fontSize: '95.158px',
          lineHeight: 'normal',
          color: '#ffffff',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </p>

      <p
        style={{
          position: 'absolute',
          left: '163px',
          top: '62px',
          margin: 0,
          fontFamily: FONT_ITALIC,
          fontSize: '21.807px',
          lineHeight: 'normal',
          color: '#ffffff',
          whiteSpace: 'pre-line',
        }}
      >
        {lines.join('\n')}
      </p>
    </div>
  );
}

function DesktopOverviewPanel({
  overviewStats,
}: {
  overviewStats: { newCount: number; startedCount: number; completedCount: number };
}) {
  return (
    <>
      <DesktopOverviewItem
        left={774}
        asset={`${CHALLENGE_ASSETS}/overview-new.svg`}
        value={overviewStats.newCount}
        lines={['New', 'tasks', 'to do']}
      />
      <DesktopOverviewItem
        left={1055}
        asset={`${CHALLENGE_ASSETS}/overview-started.svg`}
        value={overviewStats.startedCount}
        lines={['Tasks', 'started']}
      />
      <DesktopOverviewItem
        left={1336}
        asset={`${CHALLENGE_ASSETS}/overview-completed.svg`}
        value={overviewStats.completedCount}
        lines={['Completed', 'tasks']}
      />
    </>
  );
}

function ChallengeRow({
  challenge,
  compact = false,
}: {
  challenge: Challenge;
  compact?: boolean;
}) {
  const completed = challenge.is_completed || challenge.is_claimed;
  const progressPercent =
    challenge.target_value > 0
      ? Math.min(100, Math.round((challenge.progress_value / challenge.target_value) * 100))
      : 0;
  const fillPercent = completed ? 100 : progressPercent;
  const fillColor = completed ? 'rgba(255,22,84,0.58)' : 'rgba(255,22,84,0.36)';
  const rowMinHeight = compact ? 47 : 62;
  const checkboxSize = compact ? 28 : 31;
  const checkboxRadius = compact ? 3 : 6;
  const titleSize = compact ? 15 : 20;
  const rewardMinWidth = compact ? 82 : 132;
  const rewardSize = compact ? 12 : 18;
  const completionSize = compact ? 10 : 12;

  return (
    <article
      className="flex items-center gap-4 rounded-[7px]"
      style={{
        minHeight: `${rowMinHeight}px`,
        padding: compact ? '8px 12px' : '12px 16px',
        background: `linear-gradient(90deg, ${fillColor} 0%, ${fillColor} ${fillPercent}%, rgba(40,40,40,0.42) ${fillPercent}%, rgba(40,40,40,0.42) 100%), linear-gradient(90deg, rgba(15,4,4,0.32) 0%, rgba(15,4,4,0.32) 100%)`,
      }}
    >
      <div
        className="flex flex-shrink-0 items-center justify-center"
        style={{
          width: `${checkboxSize}px`,
          height: `${checkboxSize}px`,
          borderRadius: `${checkboxRadius}px`,
          background: completed ? '#ff1654' : 'rgba(0,0,0,0.42)',
        }}
        aria-hidden="true"
      >
        {completed ? (
          <span className="block h-[11px] w-[18px] rotate-[-45deg] border-b-[3px] border-l-[3px] border-white" />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <p
            className="m-0 truncate leading-none text-white"
            style={{ fontFamily: FONT_BOLD, fontSize: `${titleSize}px` }}
          >
            {challenge.title}
          </p>

          {!completed && challenge.target_value > 1 ? (
            <span
              className="text-[13px] leading-none text-white/46 lg:text-[14px]"
              style={{ fontFamily: FONT_BOLD }}
            >
              ({challenge.progress_value}/{challenge.target_value})
            </span>
          ) : null}
        </div>

        {completed ? (
          <p
            className="mt-2 uppercase tracking-[0.18em] text-white/46"
            style={{ fontFamily: FONT_REGULAR, fontSize: `${completionSize}px` }}
          >
            Completed
          </p>
        ) : null}
      </div>

      <p
        className="m-0 flex-shrink-0 text-right leading-none text-white"
        style={{
          minWidth: `${rewardMinWidth}px`,
          fontFamily: FONT_HEAD,
          fontSize: `${rewardSize}px`,
        }}
      >
        {formatReward(challenge)}
      </p>
    </article>
  );
}

function DesktopChallengesList({
  challenges,
  resetLabel,
}: {
  challenges: Challenge[];
  resetLabel: string;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: '774px',
        top: '494px',
        width: '760px',
      }}
    >
      {challenges.length === 0 ? (
        <div className="rounded-[18px] border border-[#ff1654]/40 bg-white/[0.02] px-6 py-8">
          <p
            className="m-0 text-[18px] text-white/72"
            style={{ fontFamily: FONT_REGULAR }}
          >
            No active challenges found.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3">
            {challenges.map((challenge) => (
              <ChallengeRow key={challenge.id} challenge={challenge} compact />
            ))}
          </div>

          <p
            className="mt-5 text-center text-[20px] text-white/42"
            style={{ fontFamily: FONT_BOLD }}
            data-testid="challenges-reset-copy"
          >
            New tasks in: {resetLabel}!
          </p>
        </>
      )}
    </div>
  );
}

function MobileChallengesTitle() {
  return (
    <div className="relative min-h-[126px] w-full overflow-visible">
      <img
        className="absolute -left-3 top-0 h-[114px] w-[76px] object-contain"
        src={`${CHALLENGE_ASSETS}/title-triangles.svg`}
        alt=""
        aria-hidden="true"
      />
      <h1
        className="relative z-10 ml-[45px] pt-[45px] whitespace-nowrap text-[42px] leading-none text-white min-[390px]:text-[48px]"
        style={{ fontFamily: FONT_HEAD }}
      >
        CHALLENGES
      </h1>
      <div className="ml-[14px] mt-4 h-[6px] w-[calc(100%-28px)] bg-[#ff1654]" />
    </div>
  );
}

function MobileChallengesXpRing({
  userXp,
  xpInLevel,
  xpRequired,
  xpToNext,
}: {
  userXp: number;
  xpInLevel: number;
  xpRequired: number;
  xpToNext: number;
}) {
  const radius = 92;
  const strokeWidth = 22;
  const circumference = 2 * Math.PI * radius;
  const progress = xpRequired > 0 ? xpInLevel / xpRequired : 0;
  const dashOffset = circumference * (1 - Math.min(1, Math.max(0, progress)));

  return (
    <div className="flex w-full flex-col items-center">
      <div className="relative h-[220px] w-[220px]">
        <svg className="h-full w-full" viewBox="0 0 240 240" aria-hidden="true">
          <circle
            cx="120"
            cy="120"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.09)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx="120"
            cy="120"
            r={radius}
            fill="none"
            stroke="#ff1654"
            strokeLinecap="round"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 120 120)"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <p
            className="m-0 text-[40px] leading-none text-white"
            style={{ fontFamily: FONT_HEAD }}
          >
            {userXp}
          </p>
          <p
            className="mt-1 text-[15px] leading-[1.15] text-white"
            style={{ fontFamily: FONT_BOLD }}
          >
            {xpToNext}XP left
          </p>
        </div>
      </div>
    </div>
  );
}

function MobileNextRewardCard({
  level,
  reward,
}: {
  level: number;
  reward: LevelReward | null;
}) {
  return (
    <div
      className="relative mx-auto mt-8 w-full max-w-[280px] pl-8"
      data-testid="challenges-next-reward"
    >
      <img
        className="absolute left-0 top-[-12px] h-[74px] w-[74px] object-contain"
        src={`${CHALLENGE_ASSETS}/reward-star.svg`}
        alt=""
        aria-hidden="true"
      />

      <div className="ml-5 flex min-h-[92px] items-center justify-between rounded-[12px] border border-[#ff1654] px-4 py-3">
        {reward ? (
          <>
            <div className="min-w-0 pr-3">
              <p
                className="m-0 whitespace-nowrap text-[14px] leading-none text-white"
                style={{ fontFamily: FONT_REGULAR }}
              >
                LVL.{' '}
                <span style={{ fontFamily: FONT_HEAD, fontSize: '32px' }}>
                  {reward.levelRequired}
                </span>
              </p>
              <p
                className="mt-1 truncate text-[13px] uppercase tracking-[0.18em] text-[#ff97b8]"
                style={{ fontFamily: FONT_BOLD }}
              >
                {reward.name}
              </p>
            </div>

            <img
              className="h-[56px] w-[56px] flex-shrink-0 object-contain"
              src={reward.image}
              alt={reward.name}
            />
          </>
        ) : (
          <div className="min-w-0">
            <p
              className="mt-1 text-[18px] leading-[1.1] text-white"
              style={{ fontFamily: FONT_WIDE }}
            >
              All rewards unlocked
            </p>
            <p
              className="mt-2 text-[13px] text-[#ff97b8]"
              style={{ fontFamily: FONT_REGULAR }}
            >
              Current level: LVL.{level}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function MobileChallengeTabs({
  activeTab,
  onChange,
}: {
  activeTab: ChallengeTab;
  onChange: (tab: ChallengeTab) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Challenges views"
      className="grid grid-cols-3 gap-2 rounded-[18px] bg-white/[0.02] p-2"
    >
      {TABS.map((tab) => {
        const active = tab.value === activeTab;

        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            data-testid={`challenges-tab-${tab.value}`}
            onClick={() => onChange(tab.value)}
            className="relative rounded-[12px] px-2 py-3 text-center text-[18px] transition"
            style={{
              fontFamily: active ? FONT_BOLD : FONT_REGULAR,
              color: active ? '#ffffff' : 'rgba(255,255,255,0.45)',
              background: active ? 'rgba(255,255,255,0.03)' : 'transparent',
            }}
          >
            {tab.label}
            <span
              aria-hidden="true"
              className="absolute bottom-[8px] left-1/2 h-[3px] -translate-x-1/2 bg-[#ff1654] transition-all"
              style={{ width: active ? '76px' : '0px' }}
            />
          </button>
        );
      })}
    </div>
  );
}

function MobileOverviewStatCard({
  asset,
  value,
  lines,
}: {
  asset: string;
  value: number;
  lines: string[];
}) {
  return (
    <div className="relative h-[180px] overflow-hidden rounded-[18px]">
      <img
        className="absolute inset-0 h-full w-full object-contain opacity-90"
        src={asset}
        alt=""
        aria-hidden="true"
      />

      <div className="relative flex h-full items-center justify-between gap-4 px-6">
        <p
          className="m-0 text-[72px] leading-none text-white"
          style={{ fontFamily: FONT_HEAD }}
        >
          {value}
        </p>
        <p
          className="m-0 max-w-[132px] whitespace-pre-line text-left text-[20px] leading-[1.02] text-white"
          style={{ fontFamily: FONT_ITALIC }}
        >
          {lines.join('\n')}
        </p>
      </div>
    </div>
  );
}

function ChallengesList({
  challenges,
  resetLabel,
}: {
  challenges: Challenge[];
  resetLabel: string;
}) {
  if (challenges.length === 0) {
    return (
      <div className="mt-10 rounded-[18px] border border-[#ff1654]/40 bg-white/[0.02] px-6 py-8">
        <p className="m-0 text-[18px] text-white/72" style={{ fontFamily: FONT_REGULAR }}>
          No active challenges found.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-10">
      <div className="mx-auto grid max-w-[820px] gap-3">
        {challenges.map((challenge) => (
          <ChallengeRow key={challenge.id} challenge={challenge} />
        ))}
      </div>

      <p
        className="mt-5 text-center text-[18px] text-white/42"
        style={{ fontFamily: FONT_BOLD }}
        data-testid="challenges-reset-copy"
      >
        New tasks in: {resetLabel}!
      </p>
    </div>
  );
}

function ChallengesMobileView({
  activeTab,
  setActiveTab,
  dailyChallenges,
  weeklyChallenges,
  overviewStats,
  nextReward,
  level,
  userXp,
  xpInLevel,
  xpRequired,
  xpToNext,
  isLoading,
  dailyResetLabel,
  weeklyResetLabel,
}: {
  activeTab: ChallengeTab;
  setActiveTab: (tab: ChallengeTab) => void;
  dailyChallenges: Challenge[];
  weeklyChallenges: Challenge[];
  overviewStats: { newCount: number; startedCount: number; completedCount: number };
  nextReward: LevelReward | null;
  level: number;
  userXp: number;
  xpInLevel: number;
  xpRequired: number;
  xpToNext: number;
  isLoading: boolean;
  dailyResetLabel: string;
  weeklyResetLabel: string;
}) {
  const visibleChallenges = activeTab === 'daily' ? dailyChallenges : weeklyChallenges;

  return (
    <section
      data-testid="challenges-page"
      className="relative min-h-screen overflow-x-hidden bg-[#0f0404] text-white"
    >
      <img
        className="pointer-events-none absolute left-1/2 top-0 h-[146px] w-screen -translate-x-1/2 object-cover"
        src="/figma-assets/figma-neon.png"
        alt=""
        aria-hidden="true"
      />

      <div className="relative mx-auto w-full max-w-[1532px] px-4 pb-[90px] pt-[104px] sm:px-6">
        <MobileChallengesTitle />

        <div className="mt-8 grid gap-10">
          <aside className="mx-auto flex w-full max-w-[320px] flex-col items-center">
            <MobileChallengesXpRing
              userXp={userXp}
              xpInLevel={xpInLevel}
              xpRequired={xpRequired}
              xpToNext={xpToNext}
            />
            <MobileNextRewardCard level={level} reward={nextReward} />
          </aside>

          <div className="min-w-0">
            <MobileChallengeTabs activeTab={activeTab} onChange={setActiveTab} />

            {isLoading ? (
              <div className="mt-10 grid min-h-[320px] place-items-center rounded-[20px] border border-[#ff1654]/30 bg-white/[0.02]">
                <LoadingPage />
              </div>
            ) : activeTab === 'overview' ? (
              <div className="mt-10 grid gap-4 md:grid-cols-3 md:gap-6">
                <MobileOverviewStatCard
                  asset={`${CHALLENGE_ASSETS}/overview-new.svg`}
                  value={overviewStats.newCount}
                  lines={['New', 'tasks', 'to do']}
                />
                <MobileOverviewStatCard
                  asset={`${CHALLENGE_ASSETS}/overview-started.svg`}
                  value={overviewStats.startedCount}
                  lines={['Tasks', 'started']}
                />
                <MobileOverviewStatCard
                  asset={`${CHALLENGE_ASSETS}/overview-completed.svg`}
                  value={overviewStats.completedCount}
                  lines={['Completed', 'tasks']}
                />
              </div>
            ) : (
              <ChallengesList
                challenges={visibleChallenges.slice(0, 5)}
                resetLabel={activeTab === 'daily' ? dailyResetLabel : weeklyResetLabel}
              />
            )}
          </div>
        </div>
      </div>

      <div className="relative mt-10">
        <img
          className="pointer-events-none absolute left-0 top-0 h-[146px] w-full -scale-y-100 object-cover"
          src="/figma-assets/figma-neon.png"
          alt=""
          aria-hidden="true"
        />
        <FooterSection />
      </div>
    </section>
  );
}

function ChallengesDesktopView({
  activeTab,
  setActiveTab,
  dailyChallenges,
  weeklyChallenges,
  overviewStats,
  nextReward,
  level,
  userXp,
  xpInLevel,
  xpRequired,
  xpToNext,
  isLoading,
  dailyResetLabel,
  weeklyResetLabel,
}: {
  activeTab: ChallengeTab;
  setActiveTab: (tab: ChallengeTab) => void;
  dailyChallenges: Challenge[];
  weeklyChallenges: Challenge[];
  overviewStats: { newCount: number; startedCount: number; completedCount: number };
  nextReward: LevelReward | null;
  level: number;
  userXp: number;
  xpInLevel: number;
  xpRequired: number;
  xpToNext: number;
  isLoading: boolean;
  dailyResetLabel: string;
  weeklyResetLabel: string;
}) {
  const visibleChallenges = activeTab === 'daily' ? dailyChallenges : weeklyChallenges;

  return (
    <section
      data-testid="challenges-page"
      className="relative overflow-x-auto bg-[#0f0404] text-white"
    >
      <div
        style={{
          position: 'relative',
          width: `${DESKTOP_CANVAS_WIDTH}px`,
          minWidth: `${DESKTOP_CANVAS_WIDTH}px`,
          height: `${DESKTOP_TOTAL_HEIGHT}px`,
          margin: '0 auto',
          background: '#0f0404',
        }}
      >
        <img
          src="/figma-assets/figma-neon.png"
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '1920px',
            height: '146px',
            objectFit: 'cover',
            pointerEvents: 'none',
          }}
        />

        <DesktopChallengesTitle />

        <DesktopXpRing
          userXp={userXp}
          xpInLevel={xpInLevel}
          xpRequired={xpRequired}
          xpToNext={xpToNext}
        />

        <DesktopRewardCard level={level} reward={nextReward} />
        <DesktopChallengeTabs activeTab={activeTab} onChange={setActiveTab} />

        {isLoading ? (
          <div
            style={{
              position: 'absolute',
              left: '774px',
              top: '494px',
              width: '760px',
              minHeight: '240px',
              display: 'grid',
              placeItems: 'center',
              border: '1px solid rgba(255,22,84,0.3)',
              borderRadius: '20px',
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            <LoadingPage />
          </div>
        ) : activeTab === 'overview' ? (
          <DesktopOverviewPanel overviewStats={overviewStats} />
        ) : (
          <DesktopChallengesList
            challenges={visibleChallenges.slice(0, 5)}
            resetLabel={activeTab === 'daily' ? dailyResetLabel : weeklyResetLabel}
          />
        )}

        <img
          src="/figma-assets/figma-neon.png"
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            top: '827px',
            width: '1920px',
            height: '146px',
            objectFit: 'cover',
            transform: 'scaleY(-1)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            position: 'absolute',
            left: 0,
            top: '955px',
            width: '1920px',
          }}
        >
          <FooterSection />
        </div>
      </div>
    </section>
  );
}

export default function Challenges() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { user, loading } = useAuth();
  const {
    dailyChallenges,
    weeklyChallenges,
    overviewStats,
    nextReward,
    level,
    userXp,
    xpInLevel,
    xpRequired,
    xpToNext,
    isLoading,
    getResetTimes,
  } = useChallenges();
  const [activeTab, setActiveTab] = useState<ChallengeTab>('overview');
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!loading && !user) {
      navigate(
        `/auth?next=${encodeURIComponent(
          `${location.pathname}${location.search}${location.hash}`
        )}`,
        { replace: true }
      );
    }
  }, [loading, location.hash, location.pathname, location.search, navigate, user]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTick((value) => value + 1);
    }, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  const resetTimes = getResetTimes();
  const dailyResetLabel = formatResetLabel(resetTimes.dailyMs, 'daily');
  const weeklyResetLabel = formatResetLabel(resetTimes.weeklyMs, 'weekly');

  if (loading || !user) {
    return (
      <PublicLayout>
        <section className="min-h-screen bg-[#0f0404] pt-[148px]">
          <LoadingPage />
        </section>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      {isMobile ? (
        <ChallengesMobileView
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          dailyChallenges={dailyChallenges}
          weeklyChallenges={weeklyChallenges}
          overviewStats={overviewStats}
          nextReward={nextReward}
          level={level}
          userXp={userXp}
          xpInLevel={xpInLevel}
          xpRequired={xpRequired}
          xpToNext={xpToNext}
          isLoading={isLoading}
          dailyResetLabel={dailyResetLabel}
          weeklyResetLabel={weeklyResetLabel}
        />
      ) : (
        <ChallengesDesktopView
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          dailyChallenges={dailyChallenges}
          weeklyChallenges={weeklyChallenges}
          overviewStats={overviewStats}
          nextReward={nextReward}
          level={level}
          userXp={userXp}
          xpInLevel={xpInLevel}
          xpRequired={xpRequired}
          xpToNext={xpToNext}
          isLoading={isLoading}
          dailyResetLabel={dailyResetLabel}
          weeklyResetLabel={weeklyResetLabel}
        />
      )}
    </PublicLayout>
  );
}

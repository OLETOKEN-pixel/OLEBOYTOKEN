import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LoadingPage } from '@/components/common/LoadingSpinner';
import { FooterSection } from '@/components/home/sections/FooterSection';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useChallenges, type Challenge } from '@/hooks/useChallenges';
import type { LevelReward } from '@/lib/levelRewards';

type ChallengeTab = 'overview' | 'daily' | 'weekly';

const FONT_REGULAR =
  "'Base_Neue_Trial:Regular', 'Base Neue Trial', 'Base Neue', sans-serif";
const FONT_BOLD =
  "'Base_Neue_Trial:Expanded_Bold', 'Base Neue Trial', 'Base Neue', sans-serif";
const FONT_HEAD =
  "'Base_Neue_Trial:Expanded_Black_Oblique', 'Base Neue Trial', 'Base Neue', sans-serif";
const FONT_WIDE =
  "'Base_Neue_Trial:Wide_Black', 'Base Neue Trial', 'Base Neue', sans-serif";
const CHALLENGE_ASSETS = '/figma-assets/challenges';

const TABS: Array<{ value: ChallengeTab; label: string }> = [
  { value: 'overview', label: 'OVERVIEW' },
  { value: 'daily', label: 'DAILY' },
  { value: 'weekly', label: 'WEEKLY' },
];

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

function ChallengesTitle() {
  return (
    <>
      <div className="hidden lg:block">
        <div className="relative h-[186px] w-full max-w-[1032px] overflow-visible">
          <img
            className="absolute left-[-10px] top-0 h-[186px] w-[124px] object-contain"
            src={`${CHALLENGE_ASSETS}/title-triangles.svg`}
            alt=""
            aria-hidden="true"
          />
          <h1
            className="absolute left-[71px] top-[77px] whitespace-nowrap leading-none text-white"
            style={{ fontFamily: FONT_HEAD, fontSize: '80px' }}
          >
            CHALLENGES
          </h1>
          <div
            aria-hidden="true"
            className="absolute left-[-12px] top-[165px] flex h-[22px] w-[934px] items-center justify-center overflow-visible"
          >
            <div className="h-[934px] w-[18px] -scale-y-100 rotate-[89.8deg]">
              <div className="relative h-full w-full">
                <div className="absolute bottom-1/4 left-[6.7%] right-[6.7%] top-0">
                  <img
                    src={`${CHALLENGE_ASSETS}/title-underline-raw.svg`}
                    alt=""
                    className="block h-full w-full max-w-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative min-h-[126px] w-full overflow-visible lg:hidden">
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
        <div className="ml-[14px] mt-4 h-[6px] w-[calc(100%-28px)] rounded-full bg-[#ff1654]" />
      </div>
    </>
  );
}

function ChallengesXpRing({
  level,
  userXp,
  xpInLevel,
  xpRequired,
  xpToNext,
}: {
  level: number;
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
      <div className="relative h-[220px] w-[220px] sm:h-[248px] sm:w-[248px] lg:h-[272px] lg:w-[272px]">
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
            className="m-0 text-[40px] leading-none text-white sm:text-[48px] lg:text-[55px]"
            style={{ fontFamily: FONT_HEAD }}
          >
            {userXp}
          </p>
          <p
            className="mt-1 text-[15px] leading-[1.15] text-white sm:text-[16px] lg:text-[19px]"
            style={{ fontFamily: FONT_BOLD }}
          >
            {xpToNext}XP left
          </p>
          <p
            className="mt-3 text-[12px] uppercase tracking-[0.22em] text-white/58"
            style={{ fontFamily: FONT_REGULAR }}
          >
            LVL.{level}
          </p>
        </div>
      </div>
    </div>
  );
}

function NextRewardCard({
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

      <div className="ml-5 flex min-h-[92px] items-center justify-between rounded-[12px] border border-[#ff1654] bg-[linear-gradient(180deg,rgba(255,22,84,0.1),rgba(15,4,4,0.3))] px-4 py-3">
        {reward ? (
          <>
            <div className="min-w-0 pr-3">
              <p
                className="m-0 text-[11px] uppercase tracking-[0.22em] text-white/58"
                style={{ fontFamily: FONT_REGULAR }}
              >
                Next reward
              </p>
              <p
                className="mt-1 whitespace-nowrap text-[14px] leading-none text-white"
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
              className="m-0 text-[11px] uppercase tracking-[0.22em] text-white/58"
              style={{ fontFamily: FONT_REGULAR }}
            >
              Reward status
            </p>
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

function ChallengeTabs({
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
      className="grid grid-cols-3 gap-2 rounded-[18px] bg-white/[0.02] p-2 lg:flex lg:items-center lg:justify-center lg:gap-14 lg:bg-transparent lg:p-0"
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
            className="relative rounded-[12px] px-2 py-3 text-center text-[18px] transition sm:text-[24px] lg:rounded-none lg:px-0 lg:py-0 lg:text-[32px]"
            style={{
              fontFamily: active ? FONT_BOLD : FONT_REGULAR,
              color: active ? '#ffffff' : 'rgba(255,255,255,0.45)',
              background: active ? 'rgba(255,255,255,0.03)' : 'transparent',
            }}
          >
            {tab.label}
            <span
              aria-hidden="true"
              className="absolute bottom-[8px] left-1/2 h-[3px] -translate-x-1/2 rounded-full bg-[#ff1654] transition-all lg:bottom-[-14px]"
              style={{ width: active ? '76px' : '0px' }}
            />
          </button>
        );
      })}
    </div>
  );
}

function OverviewStatCard({
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
          className="m-0 text-[72px] leading-none text-white sm:text-[88px] lg:text-[95px]"
          style={{ fontFamily: FONT_HEAD }}
        >
          {value}
        </p>
        <p
          className="m-0 max-w-[132px] whitespace-pre-line text-left text-[20px] leading-[1.02] text-white sm:text-[22px]"
          style={{ fontFamily: FONT_REGULAR, fontStyle: 'italic' }}
        >
          {lines.join('\n')}
        </p>
      </div>
    </div>
  );
}

function ChallengeRow({ challenge }: { challenge: Challenge }) {
  const completed = challenge.is_completed || challenge.is_claimed;
  const progressPercent =
    challenge.target_value > 0
      ? Math.min(100, Math.round((challenge.progress_value / challenge.target_value) * 100))
      : 0;
  const fillPercent = completed ? 100 : progressPercent;
  const fillColor = completed ? 'rgba(255,22,84,0.58)' : 'rgba(255,22,84,0.36)';

  return (
    <article
      className="flex min-h-[62px] items-center gap-4 rounded-[13px] px-4 py-3"
      style={{
        background: `linear-gradient(90deg, ${fillColor} 0%, ${fillColor} ${fillPercent}%, rgba(40,40,40,0.42) ${fillPercent}%, rgba(40,40,40,0.42) 100%), linear-gradient(90deg, rgba(15,4,4,0.32) 0%, rgba(15,4,4,0.32) 100%)`,
      }}
    >
      <div
        className="flex h-[31px] w-[31px] flex-shrink-0 items-center justify-center rounded-[6px]"
        style={{ background: completed ? '#ff1654' : 'rgba(0,0,0,0.42)' }}
        aria-hidden="true"
      >
        {completed ? (
          <span className="block h-[11px] w-[18px] rotate-[-45deg] border-b-[3px] border-l-[3px] border-white" />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <p
            className="m-0 truncate text-[18px] leading-none text-white lg:text-[20px]"
            style={{ fontFamily: FONT_BOLD }}
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
            className="mt-2 text-[12px] uppercase tracking-[0.18em] text-white/46"
            style={{ fontFamily: FONT_REGULAR }}
          >
            Completed
          </p>
        ) : null}
      </div>

      <p
        className="m-0 min-w-[96px] flex-shrink-0 text-right text-[14px] leading-none text-white lg:min-w-[132px] lg:text-[18px]"
        style={{ fontFamily: FONT_HEAD }}
      >
        {formatReward(challenge)}
      </p>
    </article>
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
        className="mt-5 text-center text-[18px] text-white/42 lg:text-[20px]"
        style={{ fontFamily: FONT_BOLD }}
        data-testid="challenges-reset-copy"
      >
        New tasks in: {resetLabel}!
      </p>
    </div>
  );
}

export default function Challenges() {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [nowTick, setNowTick] = useState(() => Date.now());

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
    const interval = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const resetTimes = getResetTimes();
  const dailyResetLabel = formatResetLabel(resetTimes.dailyMs, 'daily');
  const weeklyResetLabel = formatResetLabel(resetTimes.weeklyMs, 'weekly');
  const visibleChallenges = activeTab === 'daily' ? dailyChallenges : weeklyChallenges;

  if (loading || !user) {
    return (
      <PublicLayout>
        <section className="min-h-screen bg-[#120006] pt-[148px]">
          <LoadingPage />
        </section>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <section
        data-testid="challenges-page"
        className="relative min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,rgba(118,12,38,0.24),transparent_30%),linear-gradient(180deg,#160406_0%,#090203_48%,#0f0404_100%)] text-white"
      >
        <img
          className="pointer-events-none absolute left-1/2 top-0 h-[146px] w-screen -translate-x-1/2 object-cover"
          src="/figma-assets/figma-neon.png"
          alt=""
          aria-hidden="true"
        />

        <div className="relative mx-auto w-full max-w-[1532px] px-4 pb-[90px] pt-[104px] sm:px-6 lg:px-0 lg:pb-[140px] lg:pt-[156px]">
          <ChallengesTitle />

          <div className="mt-8 grid gap-10 lg:mt-10 lg:grid-cols-[310px_minmax(0,1fr)] lg:items-start lg:gap-[68px]">
            <aside className="mx-auto flex w-full max-w-[320px] flex-col items-center lg:mx-0 lg:items-start">
              <ChallengesXpRing
                level={level}
                userXp={userXp}
                xpInLevel={xpInLevel}
                xpRequired={xpRequired}
                xpToNext={xpToNext}
              />
              <NextRewardCard level={level} reward={nextReward} />
            </aside>

            <div className="min-w-0">
              <ChallengeTabs activeTab={activeTab} onChange={setActiveTab} />

              {isLoading ? (
                <div className="mt-10 grid min-h-[320px] place-items-center rounded-[20px] border border-[#ff1654]/30 bg-white/[0.02]">
                  <LoadingPage />
                </div>
              ) : activeTab === 'overview' ? (
                <div className="mt-10 grid gap-4 md:grid-cols-3 md:gap-6">
                  <OverviewStatCard
                    asset={`${CHALLENGE_ASSETS}/overview-new.svg`}
                    value={overviewStats.newCount}
                    lines={['New', 'tasks', 'to do']}
                  />
                  <OverviewStatCard
                    asset={`${CHALLENGE_ASSETS}/overview-started.svg`}
                    value={overviewStats.startedCount}
                    lines={['Tasks', 'started']}
                  />
                  <OverviewStatCard
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

        <div className="relative">
          <img
            className="pointer-events-none absolute left-0 top-0 h-[146px] w-full -scale-y-100 object-cover"
            src="/figma-assets/figma-neon.png"
            alt=""
            aria-hidden="true"
          />
          <FooterSection />
        </div>
      </section>
    </PublicLayout>
  );
}

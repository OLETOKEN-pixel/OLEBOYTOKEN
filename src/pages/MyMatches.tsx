import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LoadingPage } from '@/components/common/LoadingSpinner';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { MyMatchTokenCard } from '@/components/matches/MyMatchTokenCard';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useMyMatches } from '@/hooks/useMatches';
import type { Match } from '@/types';

type MyMatchesTab = 'active' | 'win' | 'lose' | 'all';

const FONT_EXPANDED =
  "'Base_Neue_Trial:Expanded', 'Base Neue Trial-Expanded', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED_BLACK =
  "'Base_Neue_Trial:Expanded_Black_Oblique', 'Base Neue Trial-ExpandedBlack Oblique', 'Base Neue Trial', sans-serif";
const FONT_WIDE_BLACK =
  "'Base_Neue_Trial:Wide_Black', 'Base Neue Trial-WideBlack', 'Base Neue Trial', sans-serif";

const ACTIVE_STATUSES = new Set([
  'open',
  'ready_check',
  'full',
  'in_progress',
  'result_pending',
  'disputed',
  'joined',
  'started',
]);

const TABS: Array<{ value: MyMatchesTab; label: string; width: number; desktopOffset?: number }> = [
  { value: 'active', label: 'ACTIVE', width: 222 },
  { value: 'win', label: 'WIN', width: 147 },
  { value: 'lose', label: 'LOSE', width: 147 },
  { value: 'all', label: 'ALL', width: 147, desktopOffset: 76 },
];

function getMatchResult(match: Match) {
  return Array.isArray(match.result) ? match.result[0] : match.result;
}

function getMyParticipant(match: Match, userId: string) {
  return (match.participants ?? []).find((participant) => participant.user_id === userId) ?? null;
}

function isUserWinner(match: Match, userId: string) {
  const result = getMatchResult(match);
  const myParticipant = getMyParticipant(match, userId);

  if (!result) return false;
  if (result.winner_user_id === userId) return true;

  if (!result.winner_team_id) return false;
  if (myParticipant?.team_id && myParticipant.team_id === result.winner_team_id) return true;
  if (myParticipant?.team_side === 'A' && match.team_a_id === result.winner_team_id) return true;
  if (myParticipant?.team_side === 'B' && match.team_b_id === result.winner_team_id) return true;

  return false;
}

function getUserOutcome(match: Match, userId: string): 'WIN' | 'LOSS' | null {
  const myParticipant = getMyParticipant(match, userId);
  if (myParticipant?.result_choice === 'WIN' || myParticipant?.result_choice === 'LOSS') {
    return myParticipant.result_choice;
  }

  const result = getMatchResult(match);
  const status = match.status || 'open';
  const hasFinalResult = Boolean(result && ['completed', 'finished', 'admin_resolved'].includes(status));

  if (!hasFinalResult) return null;

  return isUserWinner(match, userId) ? 'WIN' : 'LOSS';
}

function filterMatchesByTab(matches: Match[], tab: MyMatchesTab, userId: string) {
  if (tab === 'all') return matches;

  return matches.filter((match) => {
    const status = match.status || 'open';
    if (tab === 'active') return ACTIVE_STATUSES.has(status);

    const outcome = getUserOutcome(match, userId);
    return tab === 'win' ? outcome === 'WIN' : outcome === 'LOSS';
  });
}

export default function MyMatches() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { user, loading } = useAuth();
  const { data: matches = [], isPending, isError, error } = useMyMatches();
  const [activeTab, setActiveTab] = useState<MyMatchesTab>('active');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!loading && !user) {
      navigate(`/auth?next=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`, { replace: true });
    }
  }, [loading, location.hash, location.pathname, location.search, navigate, user]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const filteredMatches = useMemo(
    () => filterMatchesByTab(matches as Match[], activeTab, user?.id ?? ''),
    [activeTab, matches, user?.id],
  );

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
        data-testid="my-matches-page"
        className="relative min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_bottom,rgba(255,22,84,0.23),transparent_38%),linear-gradient(180deg,#22000b_0%,#060003_48%,#090004_100%)] text-white"
      >
        <img
          className="pointer-events-none absolute left-1/2 top-0 h-[146px] w-screen -translate-x-1/2 object-cover"
          src="/figma-assets/figma-neon.png"
          alt=""
          aria-hidden="true"
        />

        {isMobile ? (
          <MyMatchesMobile
            activeTab={activeTab}
            error={isError ? error : null}
            isPending={isPending}
            matches={filteredMatches}
            now={now}
            currentUserId={user.id}
            onTabChange={setActiveTab}
          />
        ) : (
          <MyMatchesDesktop
            activeTab={activeTab}
            error={isError ? error : null}
            isPending={isPending}
            matches={filteredMatches}
            now={now}
            currentUserId={user.id}
            onTabChange={setActiveTab}
          />
        )}
      </section>
    </PublicLayout>
  );
}

interface MyMatchesViewProps {
  activeTab: MyMatchesTab;
  error: unknown;
  isPending: boolean;
  matches: Match[];
  now: number;
  currentUserId: string;
  onTabChange: (tab: MyMatchesTab) => void;
}

function MyMatchesDesktop({
  activeTab,
  error,
  isPending,
  matches,
  now,
  currentUserId,
  onTabChange,
}: MyMatchesViewProps) {
  return (
    <div
      className="relative mx-auto box-border min-h-screen pb-[146px] pt-[156px]"
      style={{ width: 'min(1532px, calc(100% - 100px))' }}
    >
      <div className="relative h-[186px] w-[1031px] max-w-full overflow-visible">
        <img
          className="absolute left-0 top-0 h-[186px] w-[124px] object-contain"
          src="/figma-assets/matches-title-triangles.svg"
          alt=""
          aria-hidden="true"
        />
        <h1
          className="absolute left-[91px] top-[77px] whitespace-nowrap leading-none text-white"
          style={{ fontFamily: FONT_EXPANDED_BLACK, fontSize: '80px' }}
        >
          MY MATCHES
        </h1>
        <img
          className="absolute left-[31px] top-[168px] h-[22px] w-[1000px] max-w-none object-fill"
          src="/figma-assets/matches-title-underline.svg"
          alt=""
          aria-hidden="true"
          data-testid="my-matches-title-underline"
        />
      </div>

      <MyMatchesTabs
        activeTab={activeTab}
        className="relative z-30 mt-[27px] flex h-[47px] items-start gap-[29px] pl-[42px]"
        onTabChange={onTabChange}
      />

      <div
        data-testid="my-matches-grid"
        className="mt-[47px] grid"
        style={{ gridTemplateColumns: 'repeat(auto-fill, 300px)', columnGap: '100px', rowGap: '40px' }}
      >
        <MyMatchesContent error={error} isPending={isPending} matches={matches} now={now} currentUserId={currentUserId} />
      </div>
    </div>
  );
}

function MyMatchesMobile({
  activeTab,
  error,
  isPending,
  matches,
  now,
  currentUserId,
  onTabChange,
}: MyMatchesViewProps) {
  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-4 pb-16 pt-[104px]">
      <div className="relative min-h-[126px] w-full overflow-visible">
        <img
          className="absolute -left-3 top-0 h-[114px] w-[76px] object-contain"
          src="/figma-assets/matches-title-triangles.svg"
          alt=""
          aria-hidden="true"
        />
        <h1
          className="relative z-10 ml-[45px] pt-[45px] whitespace-nowrap text-[42px] leading-none text-white min-[390px]:text-[48px]"
          style={{ fontFamily: FONT_EXPANDED_BLACK }}
        >
          MY MATCHES
        </h1>
        <div className="ml-[14px] mt-4 h-[6px] w-[calc(100%-28px)] rounded-full bg-[#ff1654]" />
      </div>

      <MyMatchesTabs
        activeTab={activeTab}
        className="mt-5 grid grid-cols-3 gap-2"
        mobile
        onTabChange={onTabChange}
      />

      <div className="mt-7 grid w-full justify-items-center gap-6">
        <MyMatchesContent error={error} isPending={isPending} matches={matches} now={now} currentUserId={currentUserId} />
      </div>
    </div>
  );
}

function MyMatchesTabs({
  activeTab,
  className,
  mobile = false,
  onTabChange,
}: {
  activeTab: MyMatchesTab;
  className: string;
  mobile?: boolean;
  onTabChange: (tab: MyMatchesTab) => void;
}) {
  return (
    <div className={className} role="tablist" aria-label="My matches filters">
      {TABS.map((tab) => {
        const isActive = tab.value === activeTab;
        const desktopMarginLeft = !mobile && tab.desktopOffset ? `${tab.desktopOffset}px` : undefined;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            className="flex h-[47px] items-center justify-center overflow-hidden rounded-[8px] border border-white/50 uppercase text-white shadow-[inset_0px_4px_4px_rgba(255,255,255,0.12)] transition hover:bg-[rgba(72,72,72,0.92)]"
            style={{
              marginLeft: desktopMarginLeft,
              width: mobile ? '100%' : `${tab.width}px`,
              background: isActive ? 'rgba(255, 22, 84, 0.42)' : 'rgba(61,61,61,0.82)',
              fontFamily: FONT_EXPANDED,
              fontSize: mobile ? '15px' : '18px',
              letterSpacing: 0,
            }}
            onClick={() => onTabChange(tab.value)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function MyMatchesContent({
  error,
  isPending,
  matches,
  now,
  currentUserId,
}: {
  error: unknown;
  isPending: boolean;
  matches: Match[];
  now: number;
  currentUserId: string;
}) {
  if (isPending) {
    return (
      <>
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`my-match-loading-${index}`}
            className="h-[400px] w-[300px] rounded-[8px] border border-[#ff1654]/50 bg-[#272727]/80 shadow-[0_4px_4px_rgba(0,0,0,0.25)]"
          />
        ))}
      </>
    );
  }

  if (error) {
    return <MyMatchesEmptyState title="MATCHES NOT LOADED" copy={error instanceof Error ? error.message : 'Refresh the page and try again.'} />;
  }

  if (matches.length === 0) {
    return <MyMatchesEmptyState title="NO TOKENS HERE" copy="Your active, win, loss and expired matches will land here as soon as they belong to you." />;
  }

  return (
    <>
      {matches.map((match) => (
        <MyMatchTokenCard key={match.id} match={match} now={now} currentUserId={currentUserId} />
      ))}
    </>
  );
}

function MyMatchesEmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div
      className="col-span-full flex min-h-[220px] w-full max-w-[620px] flex-col justify-center rounded-[8px] border border-[#ff1654]/70 bg-[#272727]/86 px-8 py-7 text-white"
      data-testid="my-matches-empty"
    >
      <h2 className="text-[32px] leading-none text-white" style={{ fontFamily: FONT_WIDE_BLACK }}>
        {title}
      </h2>
      <p className="mt-4 max-w-[520px] text-[18px] leading-[1.2] text-white/72" style={{ fontFamily: FONT_EXPANDED }}>
        {copy}
      </p>
    </div>
  );
}

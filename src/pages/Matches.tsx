import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { MatchesLiveCard } from '@/components/matches/MatchesLiveCard';
import { CreateMatchOverlay } from '@/components/matches/CreateMatchOverlay';
import { TeamSelectDialog } from '@/components/matches/TeamSelectDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useJoinMatch } from '@/hooks/useMatches';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  formatEntryFee,
  formatFirstTo,
  formatMatchTitle,
  formatPlatform,
  formatPrize,
  formatTimeLeft,
} from '@/lib/matchFormatters';
import { cn } from '@/lib/utils';
import type { Match, PaymentMode, Platform } from '@/types';

type TeamSizeFilter = 'all' | '1' | '2' | '3' | '4';
type PlatformFilter = 'all' | Platform;
type ModeFilter = 'all' | 'Box Fight' | 'Build Fight' | 'Realistic' | 'Zone Wars';
type MatchesFilterKey = 'teamSize' | 'platform' | 'mode';

const FONT_REGULAR =
  "'Base_Neue_Trial:Regular', 'Base Neue Trial-Regular', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED =
  "'Base_Neue_Trial:Expanded', 'Base Neue Trial-Expanded', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED_BOLD =
  "'Base_Neue_Trial:Expanded_Bold', 'Base Neue Trial-ExpandedBold', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED_BLACK =
  "'Base_Neue_Trial:Expanded_Black_Oblique', 'Base Neue Trial-ExpandedBlack Oblique', 'Base Neue Trial', sans-serif";
const FONT_WIDE_BLACK =
  "'Base_Neue_Trial:Wide_Black', 'Base Neue Trial-WideBlack', 'Base Neue Trial', sans-serif";

interface MatchesFilterOption<TValue extends string = string> {
  value: TValue;
  label: string;
  menuLabel?: string;
}

const TEAM_SIZE_OPTIONS: Array<MatchesFilterOption<TeamSizeFilter>> = [
  { value: 'all', label: 'TEAM SIZE', menuLabel: 'ALL' },
  { value: '1', label: '1V1' },
  { value: '2', label: '2V2' },
  { value: '3', label: '3V3' },
  { value: '4', label: '4V4' },
];

const PLATFORM_OPTIONS: Array<MatchesFilterOption<PlatformFilter>> = [
  { value: 'all', label: 'PLATFORM', menuLabel: 'ALL' },
  { value: 'PC', label: 'PC' },
  { value: 'Console', label: 'CONSOLE' },
  { value: 'Mobile', label: 'MOBILE' },
];

const MODE_OPTIONS: Array<MatchesFilterOption<ModeFilter>> = [
  { value: 'all', label: 'MODE', menuLabel: 'ALL' },
  { value: 'Box Fight', label: 'BOX FIGHT' },
  { value: 'Build Fight', label: 'BUILD FIGHT' },
  { value: 'Realistic', label: 'REALISTIC' },
  { value: 'Zone Wars', label: 'ZONE WARS' },
];

interface MatchesFilterSelectProps {
  value: string;
  options: Array<MatchesFilterOption>;
  width: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: string) => void;
}

function MatchesFilterSelect({
  value,
  options,
  width,
  open,
  onOpenChange,
  onChange,
}: MatchesFilterSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const activeOption = options.find((option) => option.value === value) ?? options[0];
  const placeholderLabel = options[0]?.label ?? 'Filter';
  const resolvedWidth = Math.max(
    width,
    ...options.map((option) => (option.menuLabel ?? option.label).length * 15 + 62),
  );

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onOpenChange, open]);

  return (
    <div
      ref={rootRef}
      className="relative z-40"
      style={{ width: `${resolvedWidth}px` }}
    >
      <button
        type="button"
        className={cn(
          'relative flex h-[47px] w-full items-center overflow-hidden rounded-[16px] border border-white/50 bg-[rgba(61,61,61,0.82)] pl-[19px] pr-[38px] text-left uppercase text-white shadow-[inset_0px_4px_4px_rgba(255,255,255,0.12)] transition hover:bg-[rgba(72,72,72,0.9)] focus:outline-none focus:ring-2 focus:ring-[#ff1654]/70',
          open && 'rounded-b-[5px] border-white/60 bg-[rgba(61,61,61,0.9)]',
        )}
        style={{ fontFamily: FONT_EXPANDED, fontSize: '24px', letterSpacing: '0em' }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${activeOption?.label ?? placeholderLabel} filter`}
        onClick={() => onOpenChange(!open)}
      >
        <span className="block min-w-0 whitespace-nowrap leading-none">{activeOption?.label}</span>
        <img
          className={cn(
            'pointer-events-none absolute right-[20px] top-1/2 h-[5px] w-[12px] -translate-y-1/2 transition-transform',
            open && 'rotate-180',
          )}
          src="/figma-assets/matches-filter-chevron.svg"
          alt=""
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          className="absolute left-0 top-[46px] z-50 w-full overflow-hidden rounded-b-[16px] border border-t-0 border-white/50 bg-[rgba(35,35,35,0.86)] py-[7px] shadow-[0_18px_34px_rgba(0,0,0,0.32),inset_0px_1px_0px_rgba(255,255,255,0.1)] backdrop-blur-[14px]"
          role="listbox"
          data-filter-menu={placeholderLabel}
          aria-label={`${placeholderLabel} options`}
          style={{ fontFamily: FONT_EXPANDED, letterSpacing: '0em' }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={cn(
                'flex min-h-[38px] w-full items-center whitespace-nowrap px-[18px] text-left uppercase text-white transition hover:bg-white/10',
                option.value === value && 'bg-[#ff1654]/24 text-white',
              )}
              style={{ fontSize: option.label.length > 12 ? '15px' : '18px' }}
              onClick={() => {
                onChange(option.value);
                onOpenChange(false);
              }}
            >
              <span className="block min-w-0 whitespace-nowrap leading-none">
                {option.menuLabel ?? option.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MatchesPlaceholderCard() {
  return (
    <article className="flex min-h-[392px] flex-col rounded-[30px] border border-[#ff1654]/45 bg-[#272727] px-[30px] pb-[28px] pt-[26px] shadow-[0_16px_36px_rgba(0,0,0,0.32)]">
      <div className="h-[34px] w-[242px] rounded-full bg-white/10" />
      <div className="mt-[13px] h-[3px] w-[258px] rounded-full bg-[#ff1654]/40" />

      <div className="mt-[25px] grid grid-cols-2 gap-x-7 gap-y-6">
        <div className="space-y-3">
          <div className="h-5 w-[92px] rounded-full bg-white/10" />
          <div className="flex items-center gap-3">
            <div className="h-[28px] w-[19px] rounded-full bg-[#ff1654]/30" />
            <div className="h-9 w-[86px] rounded-full bg-white/12" />
          </div>
        </div>

        <div className="space-y-3">
          <div className="h-5 w-[96px] rounded-full bg-white/10" />
          <div className="h-9 w-[88px] rounded-full bg-white/12" />
        </div>

        <div className="col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-5 w-[88px] rounded-full bg-white/10" />
            <div className="h-5 w-[60px] rounded-full bg-white/10" />
          </div>
          <div className="flex items-center justify-between">
            <div className="h-9 w-[120px] rounded-full bg-white/12" />
            <div className="h-3 w-[18px] rounded-full bg-white/8" />
            <div className="h-9 w-[120px] rounded-full bg-white/12" />
          </div>
        </div>

        <div className="col-span-2 space-y-3">
          <div className="h-5 w-[88px] rounded-full bg-white/10" />
          <div className="h-9 w-[126px] rounded-full bg-white/12" />
        </div>
      </div>

      <div className="mt-auto h-[58px] rounded-[18px] border border-[#ff1654]/45 bg-[rgba(255,22,84,0.18)]" />
    </article>
  );
}

interface MatchesEmptyStateProps {
  hasActiveFilters: boolean;
}

function MatchesEmptyState({ hasActiveFilters }: MatchesEmptyStateProps) {
  const eyebrow = hasActiveFilters ? 'FILTERED VIEW' : 'ARENA STANDBY';
  const description = hasActiveFilters
    ? 'Nothing is live for the selected team size, platform or mode. Widen the filters and the board refreshes the second a matching arena opens.'
    : 'The board is quiet for now. The second a player opens the next live arena, the first match card lands here in real time.';
  const status = hasActiveFilters ? 'FILTERS ARE NARROWING THE BOARD' : 'WAITING FOR THE NEXT LIVE DROP';
  const panelCopy = hasActiveFilters
    ? 'Your current setup is only showing a narrow slice of the live feed. Switch the filters back out and cards will repopulate immediately.'
    : 'This section is ready for real matches only. When the first lobby goes live, the feed wakes up automatically.';
  const tags = hasActiveFilters
    ? ['TEAM SIZE', 'PLATFORM', 'MODE']
    : ['REAL-TIME FEED', 'AUTO REFRESH', 'READY FOR THE NEXT ARENA'];
  const titleLines = hasActiveFilters ? ['NO MATCHES', 'FOR THIS', 'SETUP'] : ['NO LIVE', 'MATCHES', 'RIGHT NOW'];

  return (
    <section
      className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_456px] gap-[30px] overflow-hidden rounded-[34px] border border-[#ff1654] bg-[linear-gradient(180deg,rgba(90,8,31,0.7)_0%,rgba(24,4,9,0.97)_100%)] px-[32px] py-[28px] shadow-[inset_0px_1px_0px_rgba(255,255,255,0.06)]"
      aria-live="polite"
    >
      <div className="flex min-w-0 gap-[24px]">
        <img
          className="mt-[16px] h-[154px] w-[103px] flex-shrink-0"
          src="/figma-assets/matches-title-triangles.svg"
          alt=""
          aria-hidden="true"
        />

        <div className="min-w-0 pt-[16px]">
          <span
            className="inline-flex w-fit items-center gap-3 rounded-full border border-[#ff1654]/65 bg-[rgba(78,7,27,0.74)] px-4 py-[9px] uppercase text-[#ffb1c6]"
            style={{ fontFamily: FONT_EXPANDED, fontSize: '18px', letterSpacing: '0.06em' }}
          >
            <span className="h-3 w-3 rounded-full bg-[#ff1654]" aria-hidden="true" />
            {eyebrow}
          </span>

          <h2
            className="mt-[22px] whitespace-nowrap leading-[0.88] text-white"
            style={{ fontFamily: FONT_EXPANDED_BLACK, fontSize: '74px' }}
          >
            {titleLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h2>

          <p
            className="mt-[20px] max-w-[690px] text-white/88"
            style={{ fontFamily: FONT_REGULAR, fontSize: '23px', lineHeight: '1.17' }}
          >
            {description}
          </p>
        </div>
      </div>

      <aside className="flex min-h-0 flex-col rounded-[28px] border border-white/10 bg-[rgba(41,31,33,0.94)] px-[28px] py-[26px] shadow-[inset_0px_1px_0px_rgba(255,255,255,0.04)]">
        <span
          className="uppercase text-white/55"
          style={{ fontFamily: FONT_EXPANDED, fontSize: '16px', letterSpacing: '0.08em' }}
        >
          LIVE BOARD
        </span>

        <div className="mt-[30px] flex items-center gap-3 text-white">
          <span className="h-4 w-4 rounded-full bg-[#ff1654]" aria-hidden="true" />
          <span style={{ fontFamily: FONT_EXPANDED_BOLD, fontSize: '24px', lineHeight: '1.02' }}>
            {status}
          </span>
        </div>

        <p
          className="mt-[26px] text-white/74"
          style={{ fontFamily: FONT_REGULAR, fontSize: '20px', lineHeight: '1.18' }}
        >
          {panelCopy}
        </p>

        <div className="mt-auto flex w-full flex-col items-start gap-3 pt-8">
          {tags.map((tag) => {
            const isLongTag = tag.length > 20;

            return (
              <span
                key={tag}
                className={cn(
                  'inline-flex max-w-full items-center rounded-full border border-white/14 text-left uppercase leading-none text-white/92 whitespace-nowrap',
                  isLongTag ? 'w-full justify-start' : 'w-fit',
                )}
                style={{
                  fontFamily: FONT_EXPANDED,
                  fontSize: isLongTag ? '12px' : '16px',
                  letterSpacing: isLongTag ? '0.03em' : '0.08em',
                  padding: isLongTag ? '11px 14px' : '10px 16px',
                }}
              >
                {tag}
              </span>
            );
          })}
        </div>
      </aside>
    </section>
  );
}

export default function Matches() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const joinMatch = useJoinMatch();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [teamSizeFilter, setTeamSizeFilter] = useState<TeamSizeFilter>('all');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');
  const [openFilter, setOpenFilter] = useState<MatchesFilterKey | null>(null);
  const [teamSelectMatch, setTeamSelectMatch] = useState<Match | null>(null);
  const hasActiveFilters =
    teamSizeFilter !== 'all' || platformFilter !== 'all' || modeFilter !== 'all';
  const isCreateOverlayOpen = location.pathname === '/matches/create';
  const isEmptyState = !loading && matches.length === 0;
  const shouldDisablePageScroll = loading || isEmptyState;
  const shouldLockViewport = loading || matches.length <= 4;
  const contentPaddingTop = 156;
  const contentPaddingBottom = isEmptyState ? 72 : 104;

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflowY = html.style.overflowY;
    const previousBodyOverflowY = body.style.overflowY;
    const previousHtmlOverscroll = html.style.overscrollBehaviorY;
    const previousBodyOverscroll = body.style.overscrollBehaviorY;

    if (shouldDisablePageScroll) {
      html.style.overflowY = 'hidden';
      body.style.overflowY = 'hidden';
      html.style.overscrollBehaviorY = 'none';
      body.style.overscrollBehaviorY = 'none';
    }

    return () => {
      html.style.overflowY = previousHtmlOverflowY;
      body.style.overflowY = previousBodyOverflowY;
      html.style.overscrollBehaviorY = previousHtmlOverscroll;
      body.style.overscrollBehaviorY = previousBodyOverscroll;
    };
  }, [shouldDisablePageScroll]);

  const handleAccept = async (match: Match) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if ((match.team_size ?? 1) > 1) {
      setTeamSelectMatch(match);
      return;
    }

    try {
      await joinMatch.mutateAsync({ matchId: match.id });
      navigate(`/matches/${match.id}`);
    } catch (err: any) {
      toast({ title: 'Failed to join', description: err.message, variant: 'destructive' });
    }
  };

  const handleTeamJoin = async (teamId: string, paymentMode: PaymentMode) => {
    if (!teamSelectMatch) return;

    try {
      await joinMatch.mutateAsync({
        matchId: teamSelectMatch.id,
        teamId,
        paymentMode,
      });
      const matchId = teamSelectMatch.id;
      setTeamSelectMatch(null);
      navigate(`/matches/${matchId}`);
    } catch (err: any) {
      toast({ title: 'Failed to join', description: err.message, variant: 'destructive' });
    }
  };

  useEffect(() => {
    let isActive = true;

    const fetchMatches = async () => {
      const nowIso = new Date().toISOString();
      let query = supabase
        .from('matches')
        .select('*')
        .eq('status', 'open')
        .gt('expires_at', nowIso)
        .order('created_at', { ascending: false });

      if (teamSizeFilter !== 'all') {
        query = query.eq('team_size', Number(teamSizeFilter));
      }

      if (platformFilter !== 'all') {
        query = query.eq('platform', platformFilter);
      }

      if (modeFilter !== 'all') {
        query = query.eq('mode', modeFilter);
      }

      const { data, error } = await query;

      if (!isActive) {
        return;
      }

      if (error) {
        console.error('Failed to load live matches', error);
        setMatches([]);
      } else {
        setMatches((data ?? []) as Match[]);
      }

      setLoading(false);
    };

    setLoading(true);
    void fetchMatches();

    const channel = supabase
      .channel(`matches-page:${teamSizeFilter}:${platformFilter}:${modeFilter}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
        },
        () => {
          void fetchMatches();
        },
      )
      .subscribe();

    return () => {
      isActive = false;
      void supabase.removeChannel(channel);
    };
  }, [modeFilter, platformFilter, teamSizeFilter]);

  return (
    <PublicLayout>
      <section
        className={cn(
          'relative overflow-x-hidden bg-[radial-gradient(circle_at_bottom,rgba(118,12,38,0.24),transparent_28%),linear-gradient(180deg,#160406_0%,#090203_100%)] text-white',
          shouldDisablePageScroll && 'h-[100dvh] overflow-hidden',
          !shouldDisablePageScroll && 'min-h-screen',
        )}
      >
        <img
          className="pointer-events-none absolute left-1/2 top-0 h-[146px] w-screen -translate-x-1/2 object-cover"
          src="/figma-assets/figma-neon.png"
          alt=""
          aria-hidden="true"
        />

        <div
          className={cn('relative mx-auto flex flex-col box-border', shouldDisablePageScroll && 'h-full')}
          style={{
            width: 'min(1532px, calc(100% - 100px))',
            paddingTop: `${contentPaddingTop}px`,
            paddingBottom: `${contentPaddingBottom}px`,
            minHeight: shouldLockViewport
              ? `calc(100dvh - ${contentPaddingTop + contentPaddingBottom}px)`
              : undefined,
            height: shouldDisablePageScroll ? '100%' : undefined,
          }}
        >
          <div className="relative h-[187px] w-[1060px] max-w-full overflow-visible">
            <img
              className="absolute left-0 top-0 h-[186px] w-[124px] object-contain"
              src="/figma-assets/matches-title-triangles.svg"
              alt=""
              aria-hidden="true"
            />
            <h1
              className="absolute left-[71px] top-[77px] whitespace-nowrap leading-none text-white"
              style={{ fontFamily: FONT_EXPANDED_BLACK, fontSize: '80px' }}
            >
              LIVE MATCHES
            </h1>
            <img
              className="absolute left-[59px] top-[168px] h-[22px] w-[743px] max-w-none object-fill"
              src="/figma-assets/matches-title-underline.svg"
              alt=""
              aria-hidden="true"
              data-testid="matches-title-underline"
            />
          </div>

          <div className="relative z-30 mt-[26px] h-[47px] w-full">
            <div className="absolute left-[42px] top-0">
              <MatchesFilterSelect
                value={teamSizeFilter}
                options={TEAM_SIZE_OPTIONS}
                width={222}
                open={openFilter === 'teamSize'}
                onOpenChange={(open) => setOpenFilter(open ? 'teamSize' : null)}
                onChange={(value) => setTeamSizeFilter(value as TeamSizeFilter)}
              />
            </div>

            <div className="absolute left-[293px] top-0">
              <MatchesFilterSelect
                value={platformFilter}
                options={PLATFORM_OPTIONS}
                width={222}
                open={openFilter === 'platform'}
                onOpenChange={(open) => setOpenFilter(open ? 'platform' : null)}
                onChange={(value) => setPlatformFilter(value as PlatformFilter)}
              />
            </div>

            <div className="absolute left-[544px] top-0">
              <MatchesFilterSelect
                value={modeFilter}
                options={MODE_OPTIONS}
                width={222}
                open={openFilter === 'mode'}
                onOpenChange={(open) => setOpenFilter(open ? 'mode' : null)}
                onChange={(value) => setModeFilter(value as ModeFilter)}
              />
            </div>

            <button
              className="absolute left-[1264px] top-0 flex h-[47px] w-[222px] items-center justify-center gap-[18px] rounded-[16px] border border-white/50 bg-[#ff1654] text-white shadow-[inset_0px_4px_4px_rgba(255,255,255,0.16),inset_0px_-4px_4px_rgba(0,0,0,0.22)] transition hover:brightness-110"
              type="button"
              onClick={() => navigate('/matches/create')}
            >
              <img className="h-[18px] w-[18px]" src="/figma-assets/matches-create-plus.svg" alt="" aria-hidden="true" />
              <span style={{ fontFamily: FONT_EXPANDED, fontSize: '24px', lineHeight: 1 }}>CREATE</span>
            </button>
          </div>

          {loading ? (
            <div className="mt-[47px] grid" style={{ gridTemplateColumns: 'repeat(auto-fill, 300px)', columnGap: '111px', rowGap: '40px' }}>
              {Array.from({ length: 4 }).map((_, index) => (
                <MatchesPlaceholderCard key={`loading-${index}`} />
              ))}
            </div>
          ) : isEmptyState ? (
            <div className="mt-[47px] flex-1 min-h-0 overflow-hidden">
              <MatchesEmptyState hasActiveFilters={hasActiveFilters} />
            </div>
          ) : (
            <div className="mt-[47px] grid" style={{ gridTemplateColumns: 'repeat(auto-fill, 300px)', columnGap: '111px', rowGap: '40px' }}>
              {matches.map((match) => {
                const card = (
                  <MatchesLiveCard
                    title={formatMatchTitle(match)}
                    firstTo={formatFirstTo(match)}
                    platform={formatPlatform(match.platform)}
                    entryFee={formatEntryFee(match)}
                    prize={formatPrize(match)}
                    expiresIn={formatTimeLeft(match.expires_at, currentTime)}
                    onAccept={!user || match.creator_id !== user.id ? () => handleAccept(match) : undefined}
                    variant="page"
                  />
                );

                if (user && match.creator_id === user.id) {
                  return (
                    <Link key={match.id} to={`/matches/${match.id}`} style={{ textDecoration: 'none' }}>
                      {card}
                    </Link>
                  );
                }

                return <div key={match.id}>{card}</div>;
              })}
            </div>
          )}
        </div>

        <CreateMatchOverlay
          open={isCreateOverlayOpen}
          onClose={() => navigate('/matches')}
          onCreated={(matchId) => {
            if (matchId) {
              navigate(`/matches/${matchId}`, { replace: true });
            } else {
              navigate('/matches', { replace: true });
            }
          }}
        />

        {teamSelectMatch && (
          <TeamSelectDialog
            open={!!teamSelectMatch}
            match={teamSelectMatch}
            onClose={() => setTeamSelectMatch(null)}
            onConfirm={handleTeamJoin}
            isJoining={joinMatch.isPending}
          />
        )}
      </section>
    </PublicLayout>
  );
}

import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { MatchesLiveCard } from '@/components/matches/MatchesLiveCard';
import { CreateMatchOverlay } from '@/components/matches/CreateMatchOverlay';
import { TeamSelectDialog } from '@/components/matches/TeamSelectDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useJoinMatch } from '@/hooks/useMatches';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  formatMatchTitle,
  formatFirstTo,
  formatPlatform,
  formatPrize,
  formatEntryFee,
  formatTimeLeft,
} from '@/lib/matchFormatters';
import type { Match, Platform, PaymentMode } from '@/types';

type TeamSizeFilter = 'all' | '1' | '2' | '3' | '4';
type PlatformFilter = 'all' | Platform;
type ModeFilter = 'all' | 'Box Fight' | 'Build Fight' | 'Realistic' | 'Zone Wars';

const TEAM_SIZE_OPTIONS: Array<{ value: TeamSizeFilter; label: string }> = [
  { value: 'all', label: 'TEAM SIZE' },
  { value: '1', label: '1V1' },
  { value: '2', label: '2V2' },
  { value: '3', label: '3V3' },
  { value: '4', label: '4V4' },
];

const PLATFORM_OPTIONS: Array<{ value: PlatformFilter; label: string }> = [
  { value: 'all', label: 'PLATFORM' },
  { value: 'PC', label: 'PC' },
  { value: 'Console', label: 'CONSOLE' },
  { value: 'Mobile', label: 'MOBILE' },
  { value: 'All', label: 'CROSS-PLATFORM' },
];

const MODE_OPTIONS: Array<{ value: ModeFilter; label: string }> = [
  { value: 'all', label: 'MODE' },
  { value: 'Box Fight', label: 'BOX FIGHT' },
  { value: 'Build Fight', label: 'BUILD FIGHT' },
  { value: 'Realistic', label: 'REALISTIC' },
  { value: 'Zone Wars', label: 'ZONE WARS' },
];

interface MatchesFilterSelectProps {
  value: string;
  options: Array<{ value: string; label: string }>;
  width: 'wide' | 'narrow';
  onChange: (value: string) => void;
}

function MatchesFilterSelect({ value, options, width, onChange }: MatchesFilterSelectProps) {
  const activeOption = options.find((option) => option.value === value) ?? options[0];

  return (
    <div className={`matches-page__filter matches-page__filter--${width}`}>
      <span className="matches-page__filter-label">{activeOption?.label}</span>

      <select
        className="matches-page__filter-native"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={options[0]?.label ?? 'Filter'}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <img
        className="matches-page__filter-chevron"
        src="/figma-assets/matches-filter-chevron.svg"
        alt=""
        aria-hidden="true"
      />
    </div>
  );
}

function MatchesPlaceholderCard() {
  return (
    <article className="matches-live-card matches-live-card--placeholder" aria-hidden="true">
      <header className="matches-live-card__header">
        <div className="matches-live-card__placeholder-bar matches-live-card__placeholder-bar--title" />
        <div className="matches-live-card__divider matches-live-card__divider--placeholder" />
      </header>

      <div className="matches-live-card__info-grid">
        <div className="matches-live-card__metric">
          <div className="matches-live-card__placeholder-line matches-live-card__placeholder-line--label" />
          <div className="matches-live-card__value-row matches-live-card__value-row--first-to">
            <div className="matches-live-card__placeholder-dot" />
            <div className="matches-live-card__placeholder-line matches-live-card__placeholder-line--value-lg" />
          </div>
        </div>

        <div className="matches-live-card__metric matches-live-card__metric--platform">
          <div className="matches-live-card__placeholder-line matches-live-card__placeholder-line--label matches-live-card__placeholder-line--center" />
          <div className="matches-live-card__placeholder-line matches-live-card__placeholder-line--platform" />
        </div>

        <div className="matches-live-card__metric matches-live-card__metric--money">
          <div className="matches-live-card__money-labels">
            <div className="matches-live-card__placeholder-line matches-live-card__placeholder-line--label" />
            <div className="matches-live-card__placeholder-line matches-live-card__placeholder-line--label matches-live-card__placeholder-line--short" />
          </div>

          <div className="matches-live-card__money-values">
            <div className="matches-live-card__value-row">
              <div className="matches-live-card__placeholder-dot" />
              <div className="matches-live-card__placeholder-line matches-live-card__placeholder-line--value" />
            </div>

            <div className="matches-live-card__placeholder-arrow" />

            <div className="matches-live-card__value-row">
              <div className="matches-live-card__placeholder-prize" />
              <div className="matches-live-card__placeholder-line matches-live-card__placeholder-line--value" />
            </div>
          </div>
        </div>

        <div className="matches-live-card__metric matches-live-card__metric--expires">
          <div className="matches-live-card__placeholder-line matches-live-card__placeholder-line--label" />
          <div className="matches-live-card__value-row">
            <div className="matches-live-card__placeholder-dot" />
            <div className="matches-live-card__placeholder-line matches-live-card__placeholder-line--value" />
          </div>
        </div>
      </div>

      <div className="matches-live-card__accept matches-live-card__accept--placeholder" />
    </article>
  );
}

interface MatchesEmptyStateProps {
  hasActiveFilters: boolean;
}

function MatchesEmptyState({ hasActiveFilters }: MatchesEmptyStateProps) {
  const eyebrow = hasActiveFilters ? 'FILTERED VIEW' : 'ARENA STANDBY';
  const title = hasActiveFilters ? 'NO MATCHES FOR THIS SETUP' : 'NO LIVE MATCHES RIGHT NOW';
  const description = hasActiveFilters
    ? 'Nothing is live for the selected team size, platform or mode. Widen the filters and the board will refresh as soon as a matching arena opens.'
    : 'The board is quiet for now. The second a player opens the next live arena, the first match card lands here in real time.';
  const status = hasActiveFilters ? 'FILTERS ARE NARROWING THE BOARD' : 'WAITING FOR THE NEXT LIVE DROP';
  const panelCopy = hasActiveFilters
    ? 'Your filters are active, so only matching live cards can appear here. Change the setup and the feed updates instantly.'
    : 'This section is ready for real matches only. When the first lobby goes live, the feed wakes up automatically.';
  const tags = hasActiveFilters
    ? ['TEAM SIZE', 'PLATFORM', 'MODE']
    : ['REAL-TIME FEED', 'AUTO REFRESH', 'READY FOR THE NEXT ARENA'];

  return (
    <section className="matches-page__empty-state" aria-live="polite">
      <img
        className="matches-page__empty-triangles"
        src="/figma-assets/matches-title-triangles.svg"
        alt=""
        aria-hidden="true"
      />

      <div className="matches-page__empty-copy">
        <span className="matches-page__empty-kicker">{eyebrow}</span>
        <h2 className="matches-page__empty-title">{title}</h2>
        <p className="matches-page__empty-description">{description}</p>
      </div>

      <aside className="matches-page__empty-panel">
        <span className="matches-page__empty-panel-kicker">LIVE BOARD</span>

        <div className="matches-page__empty-status">
          <span className="matches-page__empty-status-dot" aria-hidden="true" />
          <span>{status}</span>
        </div>

        <p className="matches-page__empty-panel-copy">{panelCopy}</p>

        <div className="matches-page__empty-tags">
          {tags.map((tag) => (
            <span key={tag} className="matches-page__empty-tag">
              {tag}
            </span>
          ))}
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
  const [teamSelectMatch, setTeamSelectMatch] = useState<Match | null>(null);
  const hasActiveFilters =
    teamSizeFilter !== 'all' || platformFilter !== 'all' || modeFilter !== 'all';
  const isCreateOverlayOpen = location.pathname === '/matches/create';

  const handleAccept = async (match: Match) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if ((match.team_size ?? 1) > 1) {
      setTeamSelectMatch(match);
      return;
    }

    // 1v1: direct join
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
    const timer = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

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
        }
      )
      .subscribe();

    return () => {
      isActive = false;
      void supabase.removeChannel(channel);
    };
  }, [modeFilter, platformFilter, teamSizeFilter]);

  return (
    <PublicLayout>
      <section className="matches-page">
        <img
          className="matches-page__top-neon"
          src="/figma-assets/figma-neon.png"
          alt=""
          aria-hidden="true"
        />

        <div className="matches-page__content">
          <div className="matches-page__hero">
            <img
              className="matches-page__hero-triangles"
              src="/figma-assets/matches-title-triangles.svg"
              alt=""
              aria-hidden="true"
            />
            <img
              className="matches-page__title-underline"
              src="/figma-assets/matches-title-underline.svg"
              alt=""
              aria-hidden="true"
            />
            <h1 className="matches-page__title">LIVE MATCHES</h1>
          </div>

          <div className="matches-page__toolbar">
            <div className="matches-page__toolbar-left">
              <MatchesFilterSelect
                value={teamSizeFilter}
                options={TEAM_SIZE_OPTIONS}
                width="wide"
                onChange={(value) => setTeamSizeFilter(value as TeamSizeFilter)}
              />

              <MatchesFilterSelect
                value={platformFilter}
                options={PLATFORM_OPTIONS}
                width="wide"
                onChange={(value) => setPlatformFilter(value as PlatformFilter)}
              />

              <MatchesFilterSelect
                value={modeFilter}
                options={MODE_OPTIONS}
                width="narrow"
                onChange={(value) => setModeFilter(value as ModeFilter)}
              />
            </div>

            <button
              className="matches-page__create-button"
              type="button"
              onClick={() => navigate('/matches/create')}
            >
              <img src="/figma-assets/matches-create-plus.svg" alt="" aria-hidden="true" />
              <span>CREATE</span>
            </button>
          </div>

          <div className="matches-page__grid" aria-busy={loading}>
            {loading &&
              Array.from({ length: 4 }).map((_, index) => <MatchesPlaceholderCard key={`loading-${index}`} />)}

            {!loading &&
              matches.map((match) => (
                <MatchesLiveCard
                  key={match.id}
                  title={formatMatchTitle(match)}
                  firstTo={formatFirstTo(match)}
                  platform={formatPlatform(match.platform)}
                  entryFee={formatEntryFee(match)}
                  prize={formatPrize(match)}
                  expiresIn={formatTimeLeft(match.expires_at, currentTime)}
                  onAccept={() => handleAccept(match)}
                />
              ))}

            {!loading && matches.length === 0 && <MatchesEmptyState hasActiveFilters={hasActiveFilters} />}
          </div>
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

import { useEffect, useState } from 'react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { MatchesLiveCard } from '@/components/matches/MatchesLiveCard';
import { supabase } from '@/integrations/supabase/client';
import type { Match, Platform } from '@/types';

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

function formatTimeLeft(expiresAt: string, now: number): string {
  const expiresAtMs = new Date(expiresAt).getTime();
  const diff = expiresAtMs - now;

  if (!Number.isFinite(expiresAtMs) || diff <= 0) {
    return '00:00';
  }

  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  return `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatPlatform(platform: Match['platform']): string {
  if (platform === 'Console') {
    return 'PS5';
  }

  return String(platform ?? 'ALL').toUpperCase();
}

function formatTitle(match: Match): string {
  const rawMode = String(match.mode ?? '').trim();

  if (rawMode === 'Realistic') {
    return `REALISTIC ${match.team_size}v${match.team_size}`;
  }

  if (rawMode.length === 0) {
    return 'MATCH';
  }

  return rawMode.toUpperCase();
}

function formatFirstTo(match: Match): string {
  const firstTo = Number(match.first_to ?? 5);
  return `${firstTo}+2`;
}

function formatPrize(match: Match): string {
  const entryFee = Number(match.entry_fee ?? 0);
  const totalPot = entryFee * Math.max(Number(match.team_size ?? 1), 1) * 2;
  return (totalPot * 0.95).toFixed(2);
}

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

export default function Matches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [teamSizeFilter, setTeamSizeFilter] = useState<TeamSizeFilter>('all');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');

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
          <div className="matches-page__title-block">
            <img
              className="matches-page__title-art"
              src="/figma-assets/figma-spaccato-title.svg"
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

            <button className="matches-page__create-button" type="button" disabled aria-disabled="true">
              <img src="/figma-assets/matches-create-plus.svg" alt="" aria-hidden="true" />
              <span>CREATE</span>
            </button>
          </div>

          <div className="matches-page__grid" aria-busy={loading}>
            {loading &&
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="matches-live-card matches-live-card--skeleton" aria-hidden="true">
                  <div className="matches-live-card__skeleton matches-live-card__skeleton--title" />
                  <div className="matches-live-card__skeleton matches-live-card__skeleton--divider" />
                  <div className="matches-live-card__skeleton matches-live-card__skeleton--row" />
                  <div className="matches-live-card__skeleton matches-live-card__skeleton--row" />
                  <div className="matches-live-card__skeleton matches-live-card__skeleton--row" />
                  <div className="matches-live-card__skeleton matches-live-card__skeleton--button" />
                </div>
              ))}

            {!loading &&
              matches.map((match) => (
                <MatchesLiveCard
                  key={match.id}
                  title={formatTitle(match)}
                  firstTo={formatFirstTo(match)}
                  platform={formatPlatform(match.platform)}
                  entryFee={Number(match.entry_fee ?? 0).toFixed(2)}
                  prize={formatPrize(match)}
                  expiresIn={formatTimeLeft(match.expires_at, currentTime)}
                />
              ))}

            {!loading && matches.length === 0 && (
              <div className="matches-page__empty-state">
                <p className="matches-page__empty-eyebrow">MATCHES</p>
                <h2 className="matches-page__empty-title">NO LIVE MATCHES</h2>
                <p className="matches-page__empty-copy">
                  This layout is ready to host future live matches. As soon as a match opens, it will appear here
                  without breaking the grid or the scrollable flow of the page.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

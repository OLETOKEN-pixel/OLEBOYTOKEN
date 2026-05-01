import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { queryKeys } from '@/lib/queryKeys';
import type {
  PlayerLeaderboardMetricRow,
  PlayerLeaderboardTab,
  TeamLeaderboardRow,
} from '@/types';

const PAGE_SIZE = 10;
const FETCH_SIZE = PAGE_SIZE + 1;

type PlayerLeaderboardRpcRow =
  Database['public']['Functions']['get_player_leaderboard_metric']['Returns'][number];
type TeamLeaderboardRpcRow =
  Database['public']['Functions']['get_team_leaderboard_earnings']['Returns'][number];

export interface LeaderboardPageResult<T> {
  rows: T[];
  hasNextPage: boolean;
}

function normalizePlayerRow(row: PlayerLeaderboardRpcRow): PlayerLeaderboardMetricRow {
  return {
    rank: Number(row.rank ?? 0),
    user_id: row.user_id ?? '',
    username: row.username ?? 'Player',
    avatar_url: row.avatar_url ?? null,
    discord_avatar_url: row.discord_avatar_url ?? null,
    wins: Number(row.wins ?? 0),
    total_matches: Number(row.total_matches ?? 0),
    total_earnings: Number(row.total_earnings ?? 0),
    total_profit: Number(row.total_profit ?? 0),
  };
}

function normalizeTeamRow(row: TeamLeaderboardRpcRow): TeamLeaderboardRow {
  return {
    rank: Number(row.rank ?? 0),
    team_id: row.team_id ?? '',
    team_name: row.team_name ?? 'Team',
    team_tag: row.team_tag ?? '',
    logo_url: row.logo_url ?? null,
    owner_user_id: row.owner_user_id ?? '',
    owner_username: row.owner_username ?? 'Captain',
    owner_avatar_url: row.owner_avatar_url ?? null,
    owner_discord_avatar_url: row.owner_discord_avatar_url ?? null,
    wins: Number(row.wins ?? 0),
    total_matches: Number(row.total_matches ?? 0),
    total_earnings: Number(row.total_earnings ?? 0),
  };
}

export function usePlayerLeaderboard(
  metric: PlayerLeaderboardTab,
  search: string,
  page: number,
  enabled = true,
) {
  const normalizedSearch = search.trim();

  return useQuery<LeaderboardPageResult<PlayerLeaderboardMetricRow>>({
    enabled,
    queryKey: queryKeys.leaderboard.players(metric, normalizedSearch, page),
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_player_leaderboard_metric', {
        p_metric: metric,
        p_limit: FETCH_SIZE,
        p_offset: page * PAGE_SIZE,
        p_query: normalizedSearch || null,
      });

      if (error) throw error;

      const rows = (data ?? []).map(normalizePlayerRow);
      return {
        rows: rows.slice(0, PAGE_SIZE),
        hasNextPage: rows.length > PAGE_SIZE,
      };
    },
  });
}

export function useTeamLeaderboard(search: string, page: number, enabled = true) {
  const normalizedSearch = search.trim();

  return useQuery<LeaderboardPageResult<TeamLeaderboardRow>>({
    enabled,
    queryKey: queryKeys.leaderboard.teams(normalizedSearch, page),
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_team_leaderboard_earnings', {
        p_limit: FETCH_SIZE,
        p_offset: page * PAGE_SIZE,
        p_query: normalizedSearch || null,
      });

      if (error) throw error;

      const rows = (data ?? []).map(normalizeTeamRow);
      return {
        rows: rows.slice(0, PAGE_SIZE),
        hasNextPage: rows.length > PAGE_SIZE,
      };
    },
  });
}

export const leaderboardPageSize = PAGE_SIZE;

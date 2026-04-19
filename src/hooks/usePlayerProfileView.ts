import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getDiscordAvatarUrl } from '@/lib/avatar';
import { queryKeys } from '@/lib/queryKeys';

export type PlayerProfileHistoryStatus = 'win' | 'loss' | 'pending';

export interface PlayerProfileHistoryItem {
  match_id: string;
  status: PlayerProfileHistoryStatus;
  finished_at: string | null;
}

export interface PlayerProfileView {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  discord_avatar_url: string | null;
  epic_username: string | null;
  twitter_username: string | null;
  twitch_username: string | null;
  team_id: string | null;
  team_name: string | null;
  team_tag: string | null;
  total_xp: number;
  level: number;
  rank: number | null;
  stats: {
    total_matches: number;
    wins: number;
    losses: number;
    win_rate: number;
  };
  tokens: {
    total_earned: number;
    total_profit: number;
    avg_profit_per_match: number;
    avg_earnings_per_match: number;
    best_profit: number;
  };
  history: PlayerProfileHistoryItem[];
  streak: {
    best: number;
    current: number;
  };
}

type PlayerProfileRpcPayload = {
  success?: boolean;
  error?: string;
  profile?: Partial<PlayerProfileView>;
  stats?: Partial<PlayerProfileView['stats']>;
  tokens?: Partial<PlayerProfileView['tokens']>;
  history?: PlayerProfileHistoryItem[];
  streak?: Partial<PlayerProfileView['streak']>;
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function normalizePlayerProfilePayload(payload: PlayerProfileRpcPayload | null): PlayerProfileView {
  if (!payload?.success || !payload.profile?.user_id) {
    throw new Error(payload?.error || 'Player profile unavailable');
  }

  const profile = payload.profile;
  const avatarUrl = getDiscordAvatarUrl(profile);

  return {
    user_id: String(profile.user_id),
    username: String(profile.username || 'Unknown'),
    display_name: String(profile.display_name || profile.username || 'Unknown'),
    avatar_url: avatarUrl,
    discord_avatar_url: avatarUrl,
    epic_username: profile.epic_username ?? null,
    twitter_username: profile.twitter_username ?? null,
    twitch_username: profile.twitch_username ?? null,
    team_id: profile.team_id ?? null,
    team_name: profile.team_name ?? null,
    team_tag: profile.team_tag ?? null,
    total_xp: toNumber(profile.total_xp),
    level: toNumber(profile.level),
    rank: profile.rank == null ? null : toNumber(profile.rank),
    stats: {
      total_matches: toNumber(payload.stats?.total_matches),
      wins: toNumber(payload.stats?.wins),
      losses: toNumber(payload.stats?.losses),
      win_rate: toNumber(payload.stats?.win_rate),
    },
    tokens: {
      total_earned: toNumber(payload.tokens?.total_earned),
      total_profit: toNumber(payload.tokens?.total_profit),
      avg_profit_per_match: toNumber(payload.tokens?.avg_profit_per_match),
      avg_earnings_per_match: toNumber(payload.tokens?.avg_earnings_per_match),
      best_profit: toNumber(payload.tokens?.best_profit),
    },
    history: Array.isArray(payload.history) ? payload.history.slice(0, 5) : [],
    streak: {
      best: toNumber(payload.streak?.best),
      current: toNumber(payload.streak?.current),
    },
  };
}

export function usePlayerProfileView(userId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.playerProfile(userId || ''),
    enabled: enabled && !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!userId) throw new Error('Missing player id');

      const { data, error } = await supabase.rpc('get_player_profile_view', {
        p_user_id: userId,
      });

      if (error) throw error;
      return normalizePlayerProfilePayload(data as PlayerProfileRpcPayload | null);
    },
  });
}

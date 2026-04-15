import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getDiscordAvatarUrl } from '@/lib/avatar';
import { queryKeys } from '@/lib/queryKeys';
import type { Region, Platform, GameMode, Match, MatchParticipant, ProfileSummary } from '@/types';

export interface MatchFilters {
  region?: Region | 'all';
  platform?: Platform | 'all';
  mode?: GameMode | 'all';
  size?: number | 'all';
  sortBy?: 'newest' | 'entry_fee_low' | 'entry_fee_high' | 'expiring';
  searchQuery?: string;
}

const MY_MATCHES_SELECT = `
  *,
  creator:profiles_public!matches_creator_id_fkey(username, avatar_url, epic_username),
  participants:match_participants(
    id,
    match_id,
    user_id,
    team_side,
    team_id,
    ready,
    ready_at,
    result_choice,
    result_at,
    status,
    joined_at,
    profile:profiles_public!match_participants_user_id_fkey(username, avatar_url, epic_username)
  ),
  result:match_results(*)
`;

const ACTIVE_MY_MATCH_STATUSES = new Set([
  'open',
  'ready_check',
  'full',
  'in_progress',
  'result_pending',
  'disputed',
  'joined',
  'started',
]);

function sortMyMatches(matches: Match[]) {
  return [...matches].sort((a, b) => {
    const aActive = ACTIVE_MY_MATCH_STATUSES.has(a.status || '');
    const bActive = ACTIVE_MY_MATCH_STATUSES.has(b.status || '');

    if (aActive !== bActive) return aActive ? -1 : 1;

    const aUrgency = aActive ? new Date(a.expires_at || a.created_at || 0).getTime() : 0;
    const bUrgency = bActive ? new Date(b.expires_at || b.created_at || 0).getTime() : 0;

    if (aActive && bActive && aUrgency !== bUrgency) {
      return aUrgency - bUrgency;
    }

    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });
}

function normalizeProfileDiscordAvatar(profile?: ProfileSummary | null): ProfileSummary | null | undefined {
  if (!profile) return profile;
  return {
    ...profile,
    discord_avatar_url: getDiscordAvatarUrl(profile),
  };
}

function normalizeMatchDiscordAvatars<T extends Match | null>(match: T): T {
  if (!match) return match;

  const participants = (match.participants ?? []) as MatchParticipant[];

  return {
    ...match,
    creator: normalizeProfileDiscordAvatar(match.creator as ProfileSummary | undefined),
    participants: participants.map((participant) => ({
      ...participant,
      profile: normalizeProfileDiscordAvatar(participant.profile as ProfileSummary | undefined),
    })),
  } as T;
}

function collectMatchUserIds(matches: Array<Match | null>): string[] {
  const userIds = new Set<string>();

  for (const match of matches) {
    if (!match) continue;
    if (match.creator_id) userIds.add(match.creator_id);

    const participants = (match.participants ?? []) as MatchParticipant[];
    for (const participant of participants) {
      if (participant.user_id) userIds.add(participant.user_id);
    }
  }

  return Array.from(userIds);
}

function applyDiscordAvatarMap<T extends Match | null>(match: T, avatarMap: Map<string, string | null>): T {
  if (!match) return match;

  const participants = (match.participants ?? []) as MatchParticipant[];

  return {
    ...match,
    creator: {
      ...((match.creator as ProfileSummary | undefined) ?? {}),
      discord_avatar_url: avatarMap.get(match.creator_id) ?? getDiscordAvatarUrl(match.creator as ProfileSummary | undefined),
    },
    participants: participants.map((participant) => ({
      ...participant,
      profile: {
        ...((participant.profile as ProfileSummary | undefined) ?? {}),
        discord_avatar_url: avatarMap.get(participant.user_id) ?? getDiscordAvatarUrl(participant.profile as ProfileSummary | undefined),
      },
    })),
  } as T;
}

async function enrichMatchesWithDiscordAvatars(matches: Match[]): Promise<Match[]> {
  const normalizedMatches = matches.map((match) => normalizeMatchDiscordAvatars(match));
  const userIds = collectMatchUserIds(normalizedMatches);

  if (userIds.length === 0) return normalizedMatches;

  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, discord_avatar_url')
    .in('user_id', userIds);

  if (error || !data) {
    if (error) console.warn('Unable to hydrate Discord avatars for matches:', error);
    return normalizedMatches;
  }

  const avatarMap = new Map(data.map((profile) => [profile.user_id, getDiscordAvatarUrl(profile)]));
  return normalizedMatches.map((match) => applyDiscordAvatarMap(match, avatarMap));
}

async function enrichMatchWithDiscordAvatars(match: Match | null): Promise<Match | null> {
  const [enrichedMatch] = await enrichMatchesWithDiscordAvatars(match ? [match] : []);
  return enrichedMatch ?? null;
}

export function useOpenMatches(filters: MatchFilters = {}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.matches.open(filters),
    queryFn: async () => {
      let query = supabase
        .from('matches')
        .select(`
          *,
          creator:profiles_public!matches_creator_id_fkey(username, avatar_url, epic_username),
          participants:match_participants(
            id,
            match_id,
            user_id,
            team_side,
            team_id,
            ready,
            ready_at,
            result_choice,
            result_at,
            status,
            joined_at,
            profile:profiles_public!match_participants_user_id_fkey(username, avatar_url, epic_username)
          )
        `)
        .eq('status', 'open')
        .gt('expires_at', new Date().toISOString());

      // Apply filters
      if (filters.region && filters.region !== 'all') {
        query = query.eq('region', filters.region);
      }
      if (filters.platform && filters.platform !== 'all') {
        query = query.eq('platform', filters.platform);
      }
      if (filters.mode && filters.mode !== 'all') {
        query = query.eq('mode', filters.mode);
      }
      if (filters.size && filters.size !== 'all') {
        query = query.eq('team_size', filters.size);
      }

      // Apply sorting
      switch (filters.sortBy) {
        case 'entry_fee_low':
          query = query.order('entry_fee', { ascending: true });
          break;
        case 'entry_fee_high':
          query = query.order('entry_fee', { ascending: false });
          break;
        case 'expiring':
          query = query.order('expires_at', { ascending: true });
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;

      // Apply search filter client-side
      let matches = data || [];
      if (filters.searchQuery) {
        const search = filters.searchQuery.toLowerCase();
        matches = matches.filter(match =>
          match.creator?.username?.toLowerCase().includes(search) ||
          match.id.toLowerCase().includes(search)
        );
      }

      return enrichMatchesWithDiscordAvatars(matches as Match[]);
    },
    staleTime: 30_000, // 30 seconds
    refetchOnWindowFocus: false,
  });

  // Real-time subscription for matches
  useEffect(() => {
    const channel = supabase
      .channel('matches-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        () => {
          // Avoid global invalidation storms under load.
          // Refresh only OPEN list queries.
          queryClient.invalidateQueries({
            predicate: (q) => q.queryKey?.[0] === 'matches' && q.queryKey?.[1] === 'open',
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_participants' },
        () => {
          queryClient.invalidateQueries({
            predicate: (q) => q.queryKey?.[0] === 'matches' && q.queryKey?.[1] === 'open',
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [queryClient]);

  return query;
}

export function useMyMatches() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.matches.my(user?.id || ''),
    queryFn: async () => {
      if (!user) return [];

      const { data: participantData, error: participantError } = await supabase
        .from('match_participants')
        .select('match_id')
        .eq('user_id', user.id);

      if (participantError) throw participantError;

      const participantMatchIds = Array.from(
        new Set((participantData || []).map((participant) => participant.match_id).filter(Boolean))
      );

      const { data: createdMatches, error: createdError } = await supabase
        .from('matches')
        .select(MY_MATCHES_SELECT)
        .eq('creator_id', user.id);

      if (createdError) throw createdError;

      let participantMatches: Match[] = [];

      if (participantMatchIds.length > 0) {
        const { data, error } = await supabase
          .from('matches')
          .select(MY_MATCHES_SELECT)
          .in('id', participantMatchIds);

        if (error) throw error;
        participantMatches = (data || []) as Match[];
      }

      const mergedMatches = new Map<string, Match>();

      [...((createdMatches || []) as Match[]), ...participantMatches].forEach((match) => {
        if (match?.id) mergedMatches.set(match.id, match);
      });

      return sortMyMatches(await enrichMatchesWithDiscordAvatars(Array.from(mergedMatches.values())));
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // Real-time subscription for user's matches
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('my-matches-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.matches.my(user.id) });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_participants' },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.matches.my(user.id) });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_results' },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.matches.my(user.id) });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, queryClient]);

  return query;
}

export function useJoinMatch() {
  const queryClient = useQueryClient();
  const { refreshWallet, user } = useAuth();

  return useMutation({
    mutationFn: async ({
      matchId,
      teamId,
      paymentMode,
    }: {
      matchId: string;
      teamId?: string;
      paymentMode?: string;
    }) => {
      const { data, error } = await supabase.rpc('join_match', {
        p_match_id: matchId,
        p_team_id: teamId ?? null,
        p_payment_mode: paymentMode ?? 'cover',
      });
      if (error) throw error;
      const result = data as { success: boolean; message?: string; error?: string; reason_code?: string } | null;
      if (!result?.success) throw new Error(result?.message || result?.error || 'Failed to join match');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) => q.queryKey?.[0] === 'matches' && q.queryKey?.[1] === 'open',
      });
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.matches.my(user.id) });
      }
      refreshWallet();
    },
  });
}

export function useMatchDetail(matchId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.matches.detail(matchId || ''),
    queryFn: async () => {
      if (!matchId) return null;

      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          creator:profiles_public!matches_creator_id_fkey(username, avatar_url, epic_username),
          participants:match_participants(
            id,
            match_id,
            user_id,
            team_id,
            team_side,
            ready,
            ready_at,
            result_choice,
            result_at,
            status,
            joined_at,
            profile:profiles_public!match_participants_user_id_fkey(username, avatar_url, epic_username)
          ),
          result:match_results(*)
        `)
        .eq('id', matchId)
        .maybeSingle();

      if (error) throw error;
      return enrichMatchWithDiscordAvatars(data as Match | null);
    },
    enabled: !!matchId,
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!matchId) return;

    const channel = supabase
      .channel(`match-detail-${matchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.matches.detail(matchId) });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_participants', filter: `match_id=eq.${matchId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.matches.detail(matchId) });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_results', filter: `match_id=eq.${matchId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.matches.detail(matchId) });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [matchId, queryClient]);

  return query;
}

export function useSetPlayerReady() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (matchId: string) => {
      const { data, error } = await supabase.rpc('set_player_ready', { p_match_id: matchId });
      if (error) throw error;
      const result = data as { success: boolean; error?: string; status?: string; all_ready?: boolean } | null;
      if (!result?.success) throw new Error(result?.error || 'Failed to ready up');
      return result;
    },
    onSuccess: (_, matchId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.detail(matchId) });
    },
  });
}

export function useSubmitResult() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      matchId,
      result,
      isTeam,
    }: {
      matchId: string;
      result: 'WIN' | 'LOSS';
      isTeam: boolean;
    }) => {
      const params = { p_match_id: matchId, p_result: result };
      const { data, error } = isTeam
        ? await supabase.rpc('submit_team_declaration', params)
        : await supabase.rpc('submit_match_result', params);
      if (error) throw error;
      const res = data as { success: boolean; error?: string; status?: string; message?: string } | null;
      if (!res?.success) throw new Error(res?.error || res?.message || 'Failed to submit result');
      return res;
    },
    onSuccess: (_, { matchId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.detail(matchId) });
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.matches.my(user.id) });
      }
    },
  });
}

export function useCancelMatch() {
  const queryClient = useQueryClient();
  const { refreshWallet, user } = useAuth();

  return useMutation({
    mutationFn: async (matchId: string) => {
      const { data, error } = await supabase.rpc('cancel_match_v2', { p_match_id: matchId });
      if (error) throw error;
      const result = data as { success: boolean; error?: string } | null;
      if (!result?.success) throw new Error(result?.error || 'Failed to cancel match');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) => q.queryKey?.[0] === 'matches',
      });
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.matches.my(user.id) });
      }
      refreshWallet();
    },
  });
}

export function useCreateMatch() {
  const queryClient = useQueryClient();
  const { refreshWallet, user } = useAuth();

  return useMutation({
    mutationFn: async (matchData: {
      creator_id: string;
      game: string;
      region: string;
      platform: string;
      mode: string;
      team_size: number;
      first_to: number;
      entry_fee: number;
      is_private: boolean;
      expires_at: string;
    }) => {
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .insert(matchData)
        .select()
        .single();

      if (matchError) throw matchError;

      // Lock coins
      const { data: lockResult, error: lockError } = await supabase.rpc('lock_funds_for_match', {
        p_match_id: match.id,
        p_amount: matchData.entry_fee,
      });

      if (lockError) throw lockError;
      const lockData = lockResult as { success: boolean; error?: string } | null;
      if (lockData && !lockData.success) {
        throw new Error(lockData.error || 'Failed to lock funds');
      }

      // Add creator as participant
      await supabase.from('match_participants').insert({
        match_id: match.id,
        user_id: matchData.creator_id,
        team_side: 'A',
      });

      return match;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) => q.queryKey?.[0] === 'matches' && q.queryKey?.[1] === 'open',
      });
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.matches.my(user.id) });
      }
      refreshWallet();
    },
  });
}

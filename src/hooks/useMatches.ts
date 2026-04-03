import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { queryKeys } from '@/lib/queryKeys';
import type { Region, Platform, GameMode } from '@/types';

export interface MatchFilters {
  region?: Region | 'all';
  platform?: Platform | 'all';
  mode?: GameMode | 'all';
  size?: number | 'all';
  sortBy?: 'newest' | 'entry_fee_low' | 'entry_fee_high' | 'expiring';
  searchQuery?: string;
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

      return matches;
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

      // First get match IDs where user is a participant
      const { data: participantData, error: participantError } = await supabase
        .from('match_participants')
        .select('match_id')
        .eq('user_id', user.id);

      if (participantError) throw participantError;
      if (!participantData?.length) return [];

      const matchIds = participantData.map(p => p.match_id);

      // Fetch full match data
      const { data: matches, error: matchError } = await supabase
        .from('matches')
        .select(`
          *,
          creator:profiles_public!matches_creator_id_fkey(username, avatar_url, epic_username),
          participants:match_participants(
            id,
            user_id,
            team_side,
            team_id,
            ready,
            result_choice,
            profile:profiles_public!match_participants_user_id_fkey(username, avatar_url, epic_username)
          ),
          result:match_results(*)
        `)
        .in('id', matchIds)
        .neq('status', 'open');

      if (matchError) throw matchError;

      // Sort: active matches first, then by created_at
      const activeStatuses = ['ready', 'in_progress', 'pending_result', 'disputed'];
      return (matches || []).sort((a, b) => {
        const aActive = activeStatuses.includes(a.status || '');
        const bActive = activeStatuses.includes(b.status || '');
        if (aActive !== bActive) return bActive ? 1 : -1;
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });
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
      return data;
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
      const rpcName = isTeam ? 'submit_team_declaration' : 'submit_match_result';
      const { data, error } = await supabase.rpc(rpcName, {
        p_match_id: matchId,
        p_result: result,
      });
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

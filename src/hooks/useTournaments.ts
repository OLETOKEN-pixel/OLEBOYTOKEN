import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import type {
  ProfileSummary,
  Tournament,
  TournamentParticipant,
  TournamentStatus,
} from '@/types';

const TOURNAMENT_LIST_SELECT = `
  *,
  creator:profiles_public!tournaments_creator_id_fkey(user_id, username, avatar_url, discord_avatar_url, twitch_username),
  participants:tournament_participants(id),
  prize_positions:tournament_prize_positions(*)
`;

const TOURNAMENT_LIST_SELECT_LEGACY = `
  *,
  creator:profiles_public!tournaments_creator_id_fkey(user_id, username, avatar_url, discord_avatar_url),
  participants:tournament_participants(id),
  prize_positions:tournament_prize_positions(*)
`;

const TOURNAMENT_DETAIL_SELECT = `
  *,
  creator:profiles_public!tournaments_creator_id_fkey(user_id, username, avatar_url, discord_avatar_url, twitch_username),
  prize_positions:tournament_prize_positions(*),
  participants:tournament_participants(
    *,
    user:profiles_public!tournament_participants_user_id_fkey(user_id, username, avatar_url, discord_avatar_url),
    team:teams(*)
  )
`;

const TOURNAMENT_DETAIL_SELECT_LEGACY = `
  *,
  creator:profiles_public!tournaments_creator_id_fkey(user_id, username, avatar_url, discord_avatar_url),
  prize_positions:tournament_prize_positions(*),
  participants:tournament_participants(
    *,
    user:profiles_public!tournament_participants_user_id_fkey(user_id, username, avatar_url, discord_avatar_url),
    team:teams(*)
  )
`;

export type TournamentListFilter = 'live' | 'past' | 'all';

type QueryErrorLike = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

type CreatorWithOptionalTwitch = Tournament['creator'] & {
  twitch_username?: string | null;
};

type PlayerProfileViewRpcPayload = {
  success?: boolean;
  profile?: {
    user_id?: string | null;
    username?: string | null;
    avatar_url?: string | null;
    discord_avatar_url?: string | null;
    epic_username?: string | null;
    twitch_username?: string | null;
  } | null;
};

function shouldRetryWithoutTwitchUsername(error: QueryErrorLike | null | undefined): boolean {
  if (!error) return false;

  const haystack = [error.code, error.message, error.details, error.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes('twitch_username') && haystack.includes('profiles_public');
}

function warnLegacyTournamentCreatorFallback() {
  console.warn(
    '[tournaments] profiles_public.twitch_username is unavailable; falling back to legacy tournament creator select.',
  );
}

function warnCreatorTwitchHydrationFailure(error: QueryErrorLike | null | undefined) {
  const message = error?.message ?? 'Unknown error';
  console.warn(`[tournaments] Unable to hydrate creator twitch usernames from profiles: ${message}`);
}

async function runTournamentListQuery(filter: TournamentListFilter, select: string) {
  let query = supabase
    .from('tournaments')
    .select(select)
    .order('created_at', { ascending: false });

  if (filter === 'live') {
    query = query.in('status', ['registering', 'ready_up', 'running']);
  } else if (filter === 'past') {
    query = query.in('status', ['completed', 'cancelled']);
  }

  return await query;
}

async function runTournamentDetailQuery(id: string, select: string) {
  return await supabase
    .from('tournaments')
    .select(select)
    .eq('id', id)
    .maybeSingle();
}

function withCreatorTwitchUsername(tournament: Tournament, twitchUsernameByUserId: Map<string, string | null>): Tournament {
  const creatorId = tournament.creator?.user_id ?? tournament.creator_id;
  if (!creatorId || !tournament.creator) return tournament;

  if (!twitchUsernameByUserId.has(creatorId)) {
    return tournament;
  }

  const creator: CreatorWithOptionalTwitch = tournament.creator;
  return {
    ...tournament,
    creator: {
      ...creator,
      twitch_username: twitchUsernameByUserId.get(creatorId) ?? null,
    },
  };
}

function normalizeTournamentListParticipantCounts(tournaments: Tournament[]): Tournament[] {
  return tournaments.map((tournament) => ({
    ...tournament,
    participant_count: tournament.participants?.length ?? tournament.participant_count ?? 0,
  }));
}

function toProfileSummaryFromRpc(payload: PlayerProfileViewRpcPayload | null): ProfileSummary | null {
  if (!payload?.success || !payload.profile?.user_id) {
    return null;
  }

  return {
    user_id: String(payload.profile.user_id),
    username: String(payload.profile.username || 'Unknown Player'),
    avatar_url: payload.profile.avatar_url ?? payload.profile.discord_avatar_url ?? null,
    discord_avatar_url: payload.profile.discord_avatar_url ?? payload.profile.avatar_url ?? null,
    epic_username: payload.profile.epic_username ?? null,
    twitch_username: payload.profile.twitch_username ?? null,
  };
}

function mergeProfileSummary(
  current: ProfileSummary | null | undefined,
  fallback: ProfileSummary,
): ProfileSummary {
  return {
    user_id: current?.user_id ?? fallback.user_id,
    username: current?.username || fallback.username,
    avatar_url: current?.avatar_url ?? fallback.avatar_url ?? null,
    discord_avatar_url: current?.discord_avatar_url ?? fallback.discord_avatar_url ?? null,
    epic_username: current?.epic_username ?? fallback.epic_username ?? null,
    twitch_username: current?.twitch_username ?? fallback.twitch_username ?? null,
  };
}

async function hydrateCreatorTwitchUsernames(tournaments: Tournament[]): Promise<Tournament[]> {
  const creatorIds = [...new Set(
    tournaments
      .filter((tournament) => !tournament.creator?.twitch_username)
      .map((tournament) => tournament.creator?.user_id ?? tournament.creator_id)
      .filter((creatorId): creatorId is string => Boolean(creatorId)),
  )];

  if (creatorIds.length === 0) {
    return tournaments;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, twitch_username')
    .in('user_id', creatorIds);

  if (error) {
    warnCreatorTwitchHydrationFailure(error);
    return tournaments;
  }

  const twitchUsernameByUserId = new Map<string, string | null>(
    (data ?? []).map((profile) => [profile.user_id, profile.twitch_username ?? null]),
  );

  return normalizeTournamentListParticipantCounts(
    tournaments.map((tournament) => withCreatorTwitchUsername(tournament, twitchUsernameByUserId)),
  );
}

async function hydrateSingleCreatorTwitchUsername(tournament: Tournament | null): Promise<Tournament | null> {
  if (!tournament) return tournament;
  const [hydratedTournament] = await hydrateCreatorTwitchUsernames([tournament]);
  const creatorId = hydratedTournament?.creator?.user_id ?? hydratedTournament?.creator_id ?? null;

  if (!hydratedTournament) {
    return tournament;
  }

  const missingUserIds = [
    ...new Set(
      [
        !hydratedTournament.creator || !hydratedTournament.creator.twitch_username ? creatorId : null,
        ...(hydratedTournament.participants ?? [])
          .filter((participant) => participant.user_id && !participant.user)
          .map((participant) => participant.user_id),
      ].filter((userId): userId is string => Boolean(userId)),
    ),
  ];

  if (missingUserIds.length === 0) {
    return hydratedTournament;
  }

  const rpcProfiles = await Promise.all(
    missingUserIds.map(async (userId) => {
      const { data, error } = await supabase.rpc('get_player_profile_view', {
        p_user_id: userId,
      });

      if (error) {
        return null;
      }

      const summary = toProfileSummaryFromRpc((data ?? null) as PlayerProfileViewRpcPayload | null);
      return summary ? [userId, summary] as const : null;
    }),
  );

  const rpcProfileMap = new Map<string, ProfileSummary>(
    rpcProfiles.filter((entry): entry is readonly [string, ProfileSummary] => Boolean(entry)),
  );

  if (rpcProfileMap.size === 0) {
    return hydratedTournament;
  }

  return {
    ...hydratedTournament,
    creator: creatorId && rpcProfileMap.has(creatorId)
      ? mergeProfileSummary(hydratedTournament.creator, rpcProfileMap.get(creatorId)!)
      : hydratedTournament.creator,
    participants: (hydratedTournament.participants ?? []).map((participant) => {
      if (!participant.user_id) {
        return participant;
      }

      const fallbackProfile = rpcProfileMap.get(participant.user_id);
      if (!fallbackProfile) {
        return participant;
      }

      return {
        ...participant,
        user: mergeProfileSummary(participant.user, fallbackProfile),
      };
    }),
  };
}

export function useTournaments(filter: TournamentListFilter = 'live') {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.tournaments.list(filter),
    queryFn: async () => {
      let { data, error } = await runTournamentListQuery(filter, TOURNAMENT_LIST_SELECT);

      if (shouldRetryWithoutTwitchUsername(error)) {
        warnLegacyTournamentCreatorFallback();
        ({ data, error } = await runTournamentListQuery(filter, TOURNAMENT_LIST_SELECT_LEGACY));
      }

      if (error) throw error;
      return await hydrateCreatorTwitchUsernames((data ?? []) as unknown as Tournament[]);
    },
  });

  // Realtime: re-fetch when tournaments table changes
  useEffect(() => {
    const channel = supabase
      .channel('tournaments-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournaments' },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.all });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournament_participants' },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.all });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function useTournament(id: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: id ? queryKeys.tournaments.detail(id) : ['tournaments', 'detail', 'undefined'],
    enabled: !!id,
    queryFn: async () => {
      if (!id) return null;
      let { data, error } = await runTournamentDetailQuery(id, TOURNAMENT_DETAIL_SELECT);

      if (shouldRetryWithoutTwitchUsername(error)) {
        warnLegacyTournamentCreatorFallback();
        ({ data, error } = await runTournamentDetailQuery(id, TOURNAMENT_DETAIL_SELECT_LEGACY));
      }

      if (error) throw error;
      return await hydrateSingleCreatorTwitchUsername(data as unknown as Tournament | null);
    },
  });

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`tournament-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournaments', filter: `id=eq.${id}` },
        () => queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.detail(id) })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournament_participants', filter: `tournament_id=eq.${id}` },
        () => queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.detail(id) })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  return query;
}

export interface CreateTournamentParams {
  name: string;
  mode: string;
  team_size: number;
  max_participants: number;
  entry_fee: number;
  prize_pool: number;
  duration_seconds: number;
  scheduled_start_at?: string | null;
  first_to?: number;
  region?: string;
  platform?: string;
  rules?: string;
  prize_positions: Array<{ position: number; amount: number }>;
}

export function useCreateTournament() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateTournamentParams) => {
      const { data, error } = await supabase.rpc('create_tournament', {
        p_name: params.name,
        p_mode: params.mode,
        p_team_size: params.team_size,
        p_max_participants: params.max_participants,
        p_entry_fee: params.entry_fee,
        p_prize_pool: params.prize_pool,
        p_duration_seconds: params.duration_seconds,
        p_scheduled_start_at: params.scheduled_start_at ?? null,
        p_first_to: params.first_to ?? 3,
        p_region: params.region ?? 'EU',
        p_platform: params.platform ?? 'All',
        p_rules: params.rules ?? null,
        p_prize_positions: params.prize_positions,
      });
      if (error) throw error;
      const result = data as { success: boolean; tournament_id?: string; error?: string };
      if (!result?.success) throw new Error(result?.error ?? 'Failed to create tournament');
      return result.tournament_id!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.all });
    },
  });
}

export function useRegisterTournament() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { tournament_id: string; team_id?: string | null }) => {
      const { data, error } = await supabase.rpc('tournament_register', {
        p_tournament_id: params.tournament_id,
        p_team_id: params.team_id ?? null,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result?.success) throw new Error(result?.error ?? 'Failed to register');
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.detail(vars.tournament_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.all });
    },
  });
}

export function useStartTournament() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tournamentId: string) => {
      const { data, error } = await supabase.rpc('tournament_start', {
        p_tournament_id: tournamentId,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result?.success) throw new Error(result?.error ?? 'Failed to start');
    },
    onSuccess: (_data, tournamentId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.detail(tournamentId) });
    },
  });
}

export function useSetTournamentReady() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tournamentId: string) => {
      const { data, error } = await supabase.rpc('tournament_set_ready', {
        p_tournament_id: tournamentId,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result?.success) throw new Error(result?.error ?? 'Failed to ready up');
    },
    onSuccess: (_data, tournamentId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.detail(tournamentId) });
    },
  });
}

export function useCancelTournament() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tournamentId: string) => {
      const { data, error } = await supabase.rpc('tournament_cancel', {
        p_tournament_id: tournamentId,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result?.success) throw new Error(result?.error ?? 'Failed to cancel');
    },
    onSuccess: (_data, tournamentId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.detail(tournamentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.all });
    },
  });
}

export function tournamentStatusLabel(status: TournamentStatus): string {
  switch (status) {
    case 'registering':
      return 'REGISTRATION OPEN';
    case 'ready_up':
      return 'READY UP';
    case 'running':
      return 'LIVE';
    case 'completed':
      return 'COMPLETED';
    case 'cancelled':
      return 'CANCELLED';
  }
}

export function isParticipating(t: Tournament | null | undefined, userId: string | null | undefined): boolean {
  if (!t || !userId) return false;
  return (t.participants ?? []).some(
    (p: TournamentParticipant) =>
      p.user_id === userId || p.payer_user_id === userId
  );
}

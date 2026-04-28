import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';

export interface TournamentStreamStatus {
  twitchUsername: string;
  displayName: string;
  channelUrl: string;
  isLive: boolean;
  viewerCount: number | null;
  thumbnailUrl: string | null;
  offlineImageUrl: string | null;
  profileImageUrl: string | null;
}

interface TwitchStreamStatusResponse {
  success?: boolean;
  error?: string;
  twitchUsername?: string;
  displayName?: string;
  channelUrl?: string;
  isLive?: boolean;
  viewerCount?: number | null;
  thumbnailUrl?: string | null;
  offlineImageUrl?: string | null;
  profileImageUrl?: string | null;
}

export function useTournamentStreamStatus(twitchUsername: string | null | undefined) {
  const normalizedUsername = twitchUsername?.trim() || '';

  return useQuery({
    queryKey: normalizedUsername
      ? queryKeys.tournaments.streamStatus(normalizedUsername)
      : [...queryKeys.tournaments.all, 'stream-status', 'disabled'],
    enabled: Boolean(normalizedUsername),
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('twitch-stream-status', {
        body: {
          twitch_username: normalizedUsername,
        },
      });

      if (error) throw error;

      const payload = (data ?? {}) as TwitchStreamStatusResponse;
      if (!payload.success || !payload.twitchUsername || !payload.channelUrl || !payload.displayName) {
        throw new Error(payload.error ?? 'Failed to load Twitch stream status');
      }

      return {
        twitchUsername: payload.twitchUsername,
        displayName: payload.displayName,
        channelUrl: payload.channelUrl,
        isLive: Boolean(payload.isLive),
        viewerCount: payload.viewerCount ?? null,
        thumbnailUrl: payload.thumbnailUrl ?? null,
        offlineImageUrl: payload.offlineImageUrl ?? null,
        profileImageUrl: payload.profileImageUrl ?? null,
      } satisfies TournamentStreamStatus;
    },
  });
}

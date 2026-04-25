import { useCallback, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useShopLevelRewards } from '@/hooks/useShopLevelRewards';
import { getNextLevelReward } from '@/lib/levelRewards';
import { getLevel, getLevelXpRequired, getXpInLevel, getXpToNext } from '@/lib/xp';

export interface Challenge {
  id: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly';
  metric_type: string;
  target_value: number;
  reward_xp: number;
  reward_coin: number;
  progress_value: number;
  is_completed: boolean;
  is_claimed: boolean;
  period_key: string;
  sortOrder: number;
}

interface RawChallenge {
  id: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly';
  metric_type: string;
  target_value: number;
  reward_xp: number;
  reward_coin: number;
  progress_value: number;
  is_completed: boolean;
  is_claimed: boolean;
  period_key: string;
  sort_order?: number | null;
}

export interface ChallengeOverviewStats {
  newCount: number;
  startedCount: number;
  completedCount: number;
}

export interface ClaimResult {
  success: boolean;
  xp?: number;
  coin?: number;
  coin_capped?: boolean;
  already_claimed?: boolean;
  error?: string;
}

function mapChallenge(raw: RawChallenge): Challenge {
  return {
    ...raw,
    sortOrder: raw.sort_order ?? 0,
  };
}

function compareChallenges(a: Challenge, b: Challenge) {
  if (a.type !== b.type) return a.type === 'daily' ? -1 : 1;
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.title.localeCompare(b.title);
}

export function useChallenges() {
  const { user, refreshWallet } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const isOnChallengesPage = location.pathname === '/challenges';
  const { rewards: levelRewards } = useShopLevelRewards();

  const {
    data: challenges = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['challenges', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase.rpc('get_user_challenges');

      if (error) {
        console.error('Error fetching challenges:', error);
        return [];
      }

      return ((data as unknown as RawChallenge[]) || [])
        .map(mapChallenge)
        .sort(compareChallenges);
    },
    enabled: !!user,
    staleTime: 10_000,
  });

  const { data: userXp = 0 } = useQuery({
    queryKey: ['user-xp', user?.id],
    queryFn: async () => {
      if (!user) return 0;

      const { data, error } = await supabase.rpc('get_user_xp');

      if (error) {
        console.error('Error fetching XP:', error);
        return 0;
      }

      return (data as number) || 0;
    },
    enabled: !!user,
  });

  const claimMutation = useMutation({
    mutationFn: async ({ challengeId, periodKey }: { challengeId: string; periodKey: string }) => {
      const { data, error } = await supabase.rpc('claim_challenge_reward', {
        p_challenge_id: challengeId,
        p_period_key: periodKey,
      });

      if (error) throw error;
      return data as unknown as ClaimResult;
    },
    onSuccess: (result) => {
      if (!result.success) return;

      queryClient.invalidateQueries({ queryKey: ['challenges'] });
      queryClient.invalidateQueries({ queryKey: ['user-xp'] });

      if (result.coin && result.coin > 0) {
        refreshWallet();
      }

      if (!result.already_claimed) {
        const rewardParts: string[] = [];
        if (result.xp && result.xp > 0) rewardParts.push(`+${result.xp} XP`);
        if (result.coin && result.coin > 0) rewardParts.push(`+${result.coin} Coin`);

        if (result.coin_capped) {
          toast.success('Challenge claimed! Weekly coin limit reached.', {
            description: rewardParts.join(' | '),
          });
        } else {
          toast.success('Challenge claimed!', {
            description: rewardParts.join(' | '),
          });
        }
      }
    },
    onError: (error) => {
      console.error('Claim error:', error);
      toast.error('Failed to claim reward');
    },
  });

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('challenges-progress-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_challenge_progress',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['challenges', user.id] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_xp',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['user-xp', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user]);

  useEffect(() => {
    if (!user || !isOnChallengesPage) return;

    const interval = window.setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['challenges', user.id] });
    }, 25_000);

    return () => window.clearInterval(interval);
  }, [isOnChallengesPage, queryClient, user]);

  const dailyChallenges = useMemo(
    () => challenges.filter((challenge) => challenge.type === 'daily'),
    [challenges]
  );
  const weeklyChallenges = useMemo(
    () => challenges.filter((challenge) => challenge.type === 'weekly'),
    [challenges]
  );

  const overviewStats = useMemo<ChallengeOverviewStats>(() => {
    let newCount = 0;
    let startedCount = 0;
    let completedCount = 0;

    challenges.forEach((challenge) => {
      const completed = challenge.is_completed || challenge.is_claimed;
      const started = challenge.progress_value > 0 && challenge.progress_value < challenge.target_value;

      if (completed) completedCount += 1;
      else if (started) startedCount += 1;
      else newCount += 1;
    });

    return { newCount, startedCount, completedCount };
  }, [challenges]);

  const level = getLevel(userXp);
  const xpInLevel = getXpInLevel(userXp);
  const xpRequired = getLevelXpRequired(level);
  const xpToNext = getXpToNext(userXp);
  const nextReward = getNextLevelReward(level, levelRewards);

  const claimChallenge = useCallback(
    (challengeId: string, periodKey: string) => {
      return claimMutation.mutateAsync({ challengeId, periodKey });
    },
    [claimMutation]
  );

  const getResetTimes = useCallback(() => {
    const utcNow = new Date(new Date().toISOString());

    const dailyReset = new Date(utcNow);
    dailyReset.setUTCHours(24, 0, 0, 0);

    const weeklyReset = new Date(utcNow);
    const dayOfWeek = weeklyReset.getUTCDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    weeklyReset.setUTCDate(weeklyReset.getUTCDate() + daysUntilMonday);
    weeklyReset.setUTCHours(0, 0, 0, 0);

    return {
      dailyReset,
      weeklyReset,
      dailyMs: dailyReset.getTime() - utcNow.getTime(),
      weeklyMs: weeklyReset.getTime() - utcNow.getTime(),
    };
  }, []);

  return {
    challenges,
    dailyChallenges,
    weeklyChallenges,
    overviewStats,
    nextReward,
    allRewardsUnlocked: nextReward === null,
    userXp,
    level,
    xpInLevel,
    xpRequired,
    xpToNext,
    isLoading,
    claimChallenge,
    isClaiming: claimMutation.isPending,
    refetch,
    getResetTimes,
  };
}

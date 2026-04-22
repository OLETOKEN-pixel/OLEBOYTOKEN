import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface VoteCounts {
  [highlightId: string]: number;
}

export type VoteState = 'NOT_VOTED' | 'VOTED_THIS' | 'VOTED_OTHER';

export function useHighlightVotes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [userVotedIds, setUserVotedIds] = useState<Set<string>>(new Set());
  const [voteCounts, setVoteCounts] = useState<VoteCounts>({});
  const [isVoting, setIsVoting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Per-highlight lock — prevents rapid double-clicks on the SAME button,
  // but different highlights can be toggled in parallel.
  const inflightRef = useRef<Set<string>>(new Set());
  // Cooldown flag: suppress realtime refetches right after our own write
  const cooldownRef = useRef(false);

  const fetchVotes = useCallback(async () => {
    if (cooldownRef.current) return;

    try {
      const { data: allVotes, error } = await supabase
        .from('highlight_votes')
        .select('highlight_id, user_id');

      if (error) throw error;

      const counts: VoteCounts = {};
      const myVotes = new Set<string>();

      allVotes?.forEach((vote) => {
        counts[vote.highlight_id] = (counts[vote.highlight_id] || 0) + 1;
        if (user && vote.user_id === user.id) {
          myVotes.add(vote.highlight_id);
        }
      });

      setVoteCounts(counts);
      setUserVotedIds(myVotes);
    } catch (error) {
      console.error('Error fetching votes:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchVotes();

    const channel = supabase
      .channel('highlight-votes-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'highlight_votes' },
        () => {
          if (!cooldownRef.current) {
            fetchVotes();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchVotes]);

  const getVoteState = useCallback((highlightId: string): VoteState => {
    if (!user) return 'NOT_VOTED';
    return userVotedIds.has(highlightId) ? 'VOTED_THIS' : 'NOT_VOTED';
  }, [user, userVotedIds]);

  const toggleVote = useCallback(async (highlightId: string) => {
    if (!user) {
      toast({ title: 'Login required', description: 'Please login to vote', variant: 'destructive' });
      return;
    }
    if (inflightRef.current.has(highlightId)) return;
    inflightRef.current.add(highlightId);
    cooldownRef.current = true;
    setIsVoting(true);

    const wasVoted = userVotedIds.has(highlightId);
    const prevVotedIds = new Set(userVotedIds);
    const prevCounts = { ...voteCounts };

    // Optimistic update
    setUserVotedIds((prev) => {
      const next = new Set(prev);
      if (wasVoted) next.delete(highlightId);
      else next.add(highlightId);
      return next;
    });
    setVoteCounts((prev) => ({
      ...prev,
      [highlightId]: Math.max(0, (prev[highlightId] || 0) + (wasVoted ? -1 : 1)),
    }));

    try {
      const { data, error } = await supabase.rpc('vote_highlight', {
        p_highlight_id: highlightId,
      });

      if (error) throw error;

      const result = data as { success: boolean; action?: string; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Vote failed');
      }

      const expectedAction = wasVoted ? 'unvoted' : 'voted';
      if (result.action !== expectedAction) {
        // Server state diverged — refetch ground truth
        cooldownRef.current = false;
        await fetchVotes();
      }
    } catch (error: any) {
      console.error('Vote error:', error);
      // Rollback optimistic
      setUserVotedIds(prevVotedIds);
      setVoteCounts(prevCounts);
      toast({
        title: 'Error',
        description: error.message || 'Failed to process vote',
        variant: 'destructive',
      });
    } finally {
      setIsVoting(false);
      setTimeout(() => {
        cooldownRef.current = false;
        inflightRef.current.delete(highlightId);
        fetchVotes();
      }, 1000);
    }
  }, [user, userVotedIds, voteCounts, fetchVotes, toast]);

  // Backwards-compatible API: castVote / removeVote now just route to toggle.
  // switchVote is kept as an alias for castVote (no more switch semantics).
  const castVote = useCallback(async (highlightId: string) => {
    await toggleVote(highlightId);
  }, [toggleVote]);

  const removeVote = useCallback(async (highlightId?: string) => {
    if (!highlightId) return;
    await toggleVote(highlightId);
  }, [toggleVote]);

  const switchVote = useCallback(async (highlightId: string) => {
    await toggleVote(highlightId);
  }, [toggleVote]);

  const topVoted = Object.entries(voteCounts).reduce(
    (top, [id, count]) => (count > (top.count || 0) ? { id, count } : top),
    { id: null as string | null, count: 0 }
  );

  return {
    userVotedIds,
    voteCounts,
    isVoting,
    loading,
    getVoteState,
    toggleVote,
    castVote,
    removeVote,
    switchVote,
    topVotedId: topVoted.id,
    topVotedCount: topVoted.count,
  };
}

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

  // Serializes clicks per-highlight so rapid double-clicks on the same
  // button don't fire two RPCs out of order. Different highlights can
  // toggle in parallel.
  const pendingRef = useRef<Map<string, Promise<void>>>(new Map());

  const fetchVotes = useCallback(async () => {
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

      // Skip applying server state if a vote is mid-flight — we'd clobber
      // the optimistic update with a DB view that may not yet reflect the
      // user's in-progress toggle.
      if (pendingRef.current.size === 0) {
        setVoteCounts(counts);
        setUserVotedIds(myVotes);
      }
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
          fetchVotes();
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

  const runToggle = useCallback(async (highlightId: string) => {
    setIsVoting(true);

    // Capture state INSIDE the updater so the rollback values reflect the
    // state at the moment this toggle actually runs (queued toggles see
    // fresh state, not the state when they were scheduled).
    let wasVoted = false;
    let prevVotedIds: Set<string> = new Set();
    let prevCounts: VoteCounts = {};

    setUserVotedIds((prev) => {
      prevVotedIds = new Set(prev);
      wasVoted = prev.has(highlightId);
      const next = new Set(prev);
      if (wasVoted) next.delete(highlightId);
      else next.add(highlightId);
      return next;
    });
    setVoteCounts((prev) => {
      prevCounts = { ...prev };
      return {
        ...prev,
        [highlightId]: Math.max(0, (prev[highlightId] || 0) + (wasVoted ? -1 : 1)),
      };
    });

    try {
      const { data, error } = await supabase.rpc('vote_highlight', {
        p_highlight_id: highlightId,
      });
      if (error) throw error;
      const result = data as { success: boolean; action?: string; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Vote failed');
      }
    } catch (error: any) {
      console.error('Vote error:', error);
      setUserVotedIds(prevVotedIds);
      setVoteCounts(prevCounts);
      toast({
        title: 'Error',
        description: error.message || 'Failed to process vote',
        variant: 'destructive',
      });
    } finally {
      setIsVoting(false);
    }
  }, [toast]);

  const toggleVote = useCallback(async (highlightId: string) => {
    if (!user) {
      toast({ title: 'Login required', description: 'Please login to vote', variant: 'destructive' });
      return;
    }

    // Chain onto the previous in-flight toggle for this highlight so rapid
    // clicks are serialized (not dropped). Each click applies.
    const previous = pendingRef.current.get(highlightId) ?? Promise.resolve();
    const next = previous.then(() => runToggle(highlightId));
    pendingRef.current.set(highlightId, next);
    try {
      await next;
    } finally {
      if (pendingRef.current.get(highlightId) === next) {
        pendingRef.current.delete(highlightId);
      }
    }
  }, [user, toast, runToggle]);

  // Backwards-compatible aliases — callers don't have to care about the
  // toggle semantics; they just pass the id of the button that was clicked.
  const castVote = useCallback((id: string) => toggleVote(id), [toggleVote]);
  const removeVote = useCallback((id?: string) => (id ? toggleVote(id) : Promise.resolve()), [toggleVote]);
  const switchVote = useCallback((id: string) => toggleVote(id), [toggleVote]);

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

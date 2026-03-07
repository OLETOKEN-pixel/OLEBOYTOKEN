import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Crown, Star, Video, ArrowRightLeft, Play } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { HighlightCard } from '@/components/highlights/HighlightCard';
import { AddHighlightModal } from '@/components/highlights/AddHighlightModal';
import { VideoPlayerModal } from '@/components/highlights/VideoPlayerModal';
import { useHighlightVotes } from '@/hooks/useHighlightVotes';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Highlight {
  id: string;
  user_id: string;
  youtube_url: string;
  youtube_video_id: string;
  title: string;
  created_at: string;
  username?: string;
  avatar_url?: string | null;
  is_weekly_winner?: boolean;
  winner_week?: string | null;
}

type FilterType = 'all' | 'mine';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.2, 0.8, 0.2, 1] } },
};

export default function Highlights() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const isAdmin = profile?.role === 'admin';

  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHighlight, setEditingHighlight] = useState<Highlight | null>(null);
  const [playingHighlight, setPlayingHighlight] = useState<Highlight | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Highlight | null>(null);

  const [switchTarget, setSwitchTarget] = useState<Highlight | null>(null);

  const {
    userVotedHighlightId,
    voteCounts,
    isVoting,
    getVoteState,
    castVote,
    removeVote,
    switchVote,
    topVotedId,
    topVotedCount,
  } = useHighlightVotes();

  const currentVotedTitle = userVotedHighlightId
    ? highlights.find(h => h.id === userVotedHighlightId)?.title || 'another video'
    : '';

  const fetchHighlights = useCallback(async () => {
    try {
      let query = supabase
        .from('highlights')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter === 'mine' && user) {
        query = query.eq('user_id', user.id);
      }

      const { data: highlightsData, error } = await query;
      if (error) throw error;

      if (!highlightsData || highlightsData.length === 0) {
        setHighlights([]);
        return;
      }

      const userIds = [...new Set(highlightsData.map(h => h.user_id))];
      const { data: profilesData } = await supabase
        .from('profiles_public')
        .select('user_id, username, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);

      const enriched: Highlight[] = highlightsData.map(h => ({
        ...h,
        username: profileMap.get(h.user_id)?.username || 'Unknown',
        avatar_url: profileMap.get(h.user_id)?.avatar_url || null,
      }));

      setHighlights(enriched);
    } catch (error) {
      console.error('Error fetching highlights:', error);
      toast({ title: 'Error', description: 'Failed to load highlights', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [filter, user, toast]);

  useEffect(() => {
    fetchHighlights();

    const channel = supabase
      .channel('highlights-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'highlights' }, () => fetchHighlights())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchHighlights]);

  const handleAddHighlight = async (data: { youtubeUrl: string; title: string; youtubeVideoId: string }) => {
    if (!user) {
      toast({ title: 'Login required', description: 'Please login to add highlights', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('highlights').insert({
      user_id: user.id,
      youtube_url: data.youtubeUrl,
      youtube_video_id: data.youtubeVideoId,
      title: data.title,
    });

    if (error) throw new Error('Failed to add highlight');
    toast({ title: 'Highlight added', description: 'Your video has been added successfully' });
  };

  const handleEditHighlight = async (data: { youtubeUrl: string; title: string; youtubeVideoId: string }) => {
    if (!editingHighlight) return;

    const { error } = await supabase.from('highlights').update({
      youtube_url: data.youtubeUrl,
      youtube_video_id: data.youtubeVideoId,
      title: data.title,
    }).eq('id', editingHighlight.id);

    if (error) throw new Error('Failed to update highlight');
    setEditingHighlight(null);
    toast({ title: 'Highlight updated', description: 'Your video has been updated successfully' });
  };

  const handleDeleteHighlight = async () => {
    if (!deleteConfirm) return;

    const { error } = await supabase.from('highlights').delete().eq('id', deleteConfirm.id);
    if (error) {
      toast({ title: 'Error', description: 'Failed to delete highlight', variant: 'destructive' });
      return;
    }

    setDeleteConfirm(null);
    toast({ title: 'Highlight deleted', description: 'The video has been removed' });
  };

  const handleSwitchConfirm = async () => {
    if (!switchTarget) return;
    await switchVote(switchTarget.id);
    setSwitchTarget(null);
  };

  const topVotedHighlight = topVotedId ? highlights.find(h => h.id === topVotedId) : null;

  const filterButtons = [
    { key: 'all' as FilterType, label: 'All' },
    ...(user ? [{ key: 'mine' as FilterType, label: 'My Clips' }] : []),
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-[36px] font-bold uppercase tracking-tight text-foreground">
                HIGHLIGHTS
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Watch and vote for the best plays
              </p>
            </div>
            {user && (
              <Button onClick={() => setShowAddModal(true)} className="btn-premium px-5 py-2.5 text-sm font-semibold">
                <Plus className="w-4 h-4 mr-2" />
                Submit Highlight
              </Button>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <div className="bg-[#121212] border border-[#1f2937] rounded-[16px] p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#FFC805]/10 shrink-0">
                  <Video className="w-4 h-4 text-[#FFC805]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Share your best plays</p>
                  <p className="text-xs text-muted-foreground">Upload your YouTube highlights</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#FFC805]/10 shrink-0">
                  <Star className="w-4 h-4 text-[#FFC805]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">1 vote per week</p>
                  <p className="text-xs text-muted-foreground">Change your vote anytime</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#FFC805]/10 shrink-0">
                  <Crown className="w-4 h-4 text-[#FFC805]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Weekly prize</p>
                  <p className="text-xs text-muted-foreground">Awarded to top video</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {topVotedHighlight && topVotedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
          >
            <div className="bg-[#121212] border border-[#FFC805]/20 rounded-[16px] p-4 relative overflow-hidden">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 flex items-center justify-center rounded-xl shrink-0 bg-[#FFC805]/10">
                  <Crown className="w-5 h-5 text-[#FFC805]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="badge-gold text-xs">Weekly Spotlight</span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-0.5">
                    <span className="font-medium text-foreground">{topVotedHighlight.title}</span>
                    {' · '}<span className="font-mono">{topVotedCount}</span> vote{topVotedCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <Button
                  onClick={() => setPlayingHighlight(topVotedHighlight)}
                  className="btn-premium px-4 py-2 text-sm font-semibold"
                >
                  <Play className="w-4 h-4 mr-1.5" />
                  Watch
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#121212] border border-[#1f2937]">
            {filterButtons.map((btn) => (
              <button
                key={btn.key}
                onClick={() => setFilter(btn.key)}
                className={cn(
                  "px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200",
                  filter === btn.key
                    ? "bg-[#1e1e1e] text-[#FFC805] shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </motion.div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground text-sm mt-3">Loading highlights...</p>
          </div>
        ) : highlights.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="bg-[#121212] border border-[#1f2937] rounded-[16px]">
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="w-16 h-16 flex items-center justify-center rounded-2xl mb-4 bg-[#1e1e1e]">
                  <Video className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-bold text-lg mb-2 text-foreground">
                  {filter === 'mine' ? 'No highlights yet' : 'No highlights found'}
                </h3>
                <p className="text-muted-foreground mb-6 text-sm max-w-sm">
                  {filter === 'mine'
                    ? "You haven't added any highlights yet. Share your best plays!"
                    : 'Be the first to share your best plays with the community.'
                  }
                </p>
                {user && (
                  <Button onClick={() => setShowAddModal(true)} className="btn-premium px-6 py-2.5 text-sm font-semibold">
                    <Plus className="w-4 h-4 mr-2" />
                    Submit Highlight
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 gap-5"
          >
            {highlights.map((highlight) => {
              const state = getVoteState(highlight.id);
              return (
                <motion.div key={highlight.id} variants={itemVariants}>
                  <HighlightCard
                    id={highlight.id}
                    youtubeVideoId={highlight.youtube_video_id}
                    title={highlight.title}
                    createdAt={highlight.created_at}
                    author={{
                      userId: highlight.user_id,
                      username: highlight.username || 'Unknown',
                      avatarUrl: highlight.avatar_url,
                    }}
                    currentUserId={user?.id || null}
                    isAdmin={isAdmin}
                    onPlay={() => setPlayingHighlight(highlight)}
                    onEdit={() => setEditingHighlight(highlight)}
                    onDelete={() => setDeleteConfirm(highlight)}
                    voteCount={voteCounts[highlight.id] || 0}
                    voteState={state}
                    onCastVote={() => castVote(highlight.id)}
                    onRemoveVote={() => removeVote()}
                    onSwitchVote={() => setSwitchTarget(highlight)}
                    isVoting={isVoting}
                  />
                </motion.div>
              );
            })}
          </motion.div>
        )}

        <AddHighlightModal open={showAddModal} onOpenChange={setShowAddModal} onSubmit={handleAddHighlight} />

        {editingHighlight && (
          <AddHighlightModal
            open={true}
            onOpenChange={() => setEditingHighlight(null)}
            onSubmit={handleEditHighlight}
            editMode
            initialData={{ youtubeUrl: editingHighlight.youtube_url, title: editingHighlight.title }}
          />
        )}

        {playingHighlight && (
          <VideoPlayerModal
            open={true}
            onOpenChange={() => setPlayingHighlight(null)}
            videoId={playingHighlight.youtube_video_id}
            title={playingHighlight.title}
          />
        )}

        <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <AlertDialogContent className="bg-[#121212] border border-[#1f2937] rounded-[16px]">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground">Delete highlight?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. The video "{deleteConfirm?.title}" will be permanently removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="btn-premium-ghost">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteHighlight} className="btn-premium-danger">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!switchTarget} onOpenChange={() => setSwitchTarget(null)}>
          <AlertDialogContent className="bg-[#121212] border border-[#1f2937] rounded-[16px]">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-foreground">
                <ArrowRightLeft className="w-5 h-5 text-[#FFC805]" />
                Switch your vote?
              </AlertDialogTitle>
              <AlertDialogDescription>
                You already voted for <span className="font-semibold text-foreground">"{currentVotedTitle}"</span>.
                Do you want to move your vote to <span className="font-semibold text-foreground">"{switchTarget?.title}"</span>?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="btn-premium-ghost">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleSwitchConfirm} className="btn-premium">
                Switch Vote
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}

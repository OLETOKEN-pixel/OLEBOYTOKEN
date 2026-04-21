import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { HighlightUploadModal } from '@/components/highlights/HighlightUploadModal';
import { HighlightsAllView, HighlightsRankingView } from '@/components/highlights/HighlightsViews';
import { FIGMA_HIGHLIGHTS, FIGMA_RANKED_NOMINEES, FIGMA_WINNER } from '@/components/highlights/highlightFixtures';
import { extractYouTubeVideoId, getYouTubeThumbnailUrl } from '@/components/highlights/highlightHelpers';
import type { HighlightCardData, HighlightTab } from '@/components/highlights/types';
import { useHighlightVotes } from '@/hooks/useHighlightVotes';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type HighlightRow = Database['public']['Tables']['highlights']['Row'];
type ProfilePublicRow = Database['public']['Tables']['profiles_public']['Row'];

function getActiveTab(pathname: string): HighlightTab {
  if (pathname.endsWith('/week')) {
    return 'week';
  }

  if (pathname.endsWith('/month')) {
    return 'month';
  }

  return 'all';
}

function filterHighlights(items: HighlightCardData[], searchTerm: string) {
  const needle = searchTerm.trim().toLowerCase();

  if (!needle) {
    return items;
  }

  return items.filter((item) => {
    return item.title.toLowerCase().includes(needle) || item.author.toLowerCase().includes(needle);
  });
}

function getAuthor(profile: ProfilePublicRow | undefined, fallback: string) {
  return profile?.discord_display_name || profile?.username || profile?.epic_username || fallback;
}

export default function Highlights() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = getActiveTab(location.pathname);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [uploadedHighlights, setUploadedHighlights] = useState<HighlightCardData[]>([]);
  const {
    voteCounts,
    isVoting,
    getVoteState,
    castVote,
    removeVote,
    switchVote,
  } = useHighlightVotes();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setUploadOpen(params.get('upload') === '1');
  }, [location.search]);

  const closeUpload = useCallback(() => {
    setUploadOpen(false);
    const params = new URLSearchParams(location.search);
    params.delete('upload');
    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : '',
      },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate]);

  const openUpload = useCallback(() => {
    setUploadOpen(true);
    navigate(
      {
        pathname: location.pathname,
        search: '?upload=1',
      },
      { replace: true },
    );
  }, [location.pathname, navigate]);

  const fetchUploadedHighlights = useCallback(async () => {
    const { data, error } = await supabase
      .from('highlights')
      .select('id,title,youtube_url,youtube_video_id,user_id,created_at')
      .order('created_at', { ascending: false })
      .limit(12);

    if (error) {
      console.error('Error loading highlights:', error);
      return;
    }

    const rows = (data ?? []) as HighlightRow[];

    if (rows.length === 0) {
      setUploadedHighlights((current) => (current.length === 0 ? current : []));
      return;
    }

    const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)));
    let profilesByUserId = new Map<string, ProfilePublicRow>();

    if (userIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles_public')
        .select('user_id,username,epic_username,discord_display_name,avatar_url,discord_avatar_url')
        .in('user_id', userIds);

      if (!profilesError) {
        profilesByUserId = new Map(
          ((profilesData ?? []) as ProfilePublicRow[])
            .filter((profileRow) => Boolean(profileRow.user_id))
            .map((profileRow) => [profileRow.user_id as string, profileRow]),
        );
      }
    }

    setUploadedHighlights(
      rows.map((row) => {
        const profileRow = profilesByUserId.get(row.user_id);
        const author = getAuthor(profileRow, 'Player');
        const avatar = profileRow?.discord_avatar_url || profileRow?.avatar_url || '/highlights/avatar-dodoeu.png';
        const likeCount = voteCounts[row.id] ?? 0;
        const voteState = getVoteState(row.id);

        return {
          id: row.id,
          title: row.title,
          author,
          authorAvatarSrc: avatar,
          thumbnailSrc: getYouTubeThumbnailUrl(row.youtube_video_id),
          href: row.youtube_url,
          likeCount,
          isLiked: voteState === 'VOTED_THIS',
          source: 'uploaded',
        };
      }),
    );
  }, [getVoteState, voteCounts]);

  useEffect(() => {
    void fetchUploadedHighlights();
  }, [fetchUploadedHighlights]);

  const allHighlights = useMemo(() => {
    const uploadedWithVotes = uploadedHighlights.map((item) => {
      const voteState = getVoteState(item.id);

      return {
        ...item,
        likeCount: voteCounts[item.id] ?? item.likeCount,
        isLiked: voteState === 'VOTED_THIS',
      };
    });

    return [...uploadedWithVotes, ...FIGMA_HIGHLIGHTS];
  }, [getVoteState, uploadedHighlights, voteCounts]);

  const filteredAllHighlights = useMemo(
    () => filterHighlights(allHighlights, searchTerm),
    [allHighlights, searchTerm],
  );

  const filteredNominees = useMemo(
    () => filterHighlights(FIGMA_RANKED_NOMINEES, searchTerm),
    [searchTerm],
  );

  const handleVote = async (item: HighlightCardData) => {
    const state = getVoteState(item.id);

    if (state === 'VOTED_THIS') {
      await removeVote();
    } else if (state === 'VOTED_OTHER') {
      await switchVote(item.id);
    } else {
      await castVote(item.id);
    }
  };

  const handlePublish = async (youtubeUrl: string, videoId: string) => {
    if (!user) {
      toast({
        title: 'Login required',
        description: 'Please login to upload highlights',
        variant: 'destructive',
      });
      return;
    }

    if (!extractYouTubeVideoId(youtubeUrl)) {
      toast({
        title: 'Invalid URL',
        description: 'Paste a valid YouTube URL',
        variant: 'destructive',
      });
      return;
    }

    setIsPublishing(true);

    try {
      const { error } = await supabase.from('highlights').insert({
        user_id: user.id,
        title: `Highlight ${videoId}`,
        youtube_url: youtubeUrl,
        youtube_video_id: videoId,
      });

      if (error) {
        throw error;
      }

      toast({
        title: 'Highlight uploaded',
        description: 'Your video is now available in HLS.',
      });
      closeUpload();
      await fetchUploadedHighlights();
    } catch (error) {
      console.error('Error publishing highlight:', error);
      toast({
        title: 'Upload failed',
        description: 'Could not publish this highlight. Try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const content =
    activeTab === 'all' ? (
      <HighlightsAllView
        items={filteredAllHighlights}
        activeTab={activeTab}
        searchTerm={searchTerm}
        isVoting={isVoting}
        onSearchChange={setSearchTerm}
        onUploadClick={openUpload}
        onVote={(item) => void handleVote(item)}
      />
    ) : (
      <HighlightsRankingView
        mode={activeTab}
        winner={FIGMA_WINNER}
        nominees={filteredNominees}
        activeTab={activeTab}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onUploadClick={openUpload}
      />
    );

  return (
    <PublicLayout>
      {content}
      <HighlightUploadModal
        open={uploadOpen}
        isPublishing={isPublishing}
        onClose={closeUpload}
        onSubmit={handlePublish}
      />
    </PublicLayout>
  );
}

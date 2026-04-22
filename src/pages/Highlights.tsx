import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { ExternalLink, Info, Loader2, Plus, Search } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { FooterSection } from '@/components/home/sections/FooterSection';
import { PublicLayout } from '@/components/layout/PublicLayout';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getDiscordAvatarUrl, getProfileInitial } from '@/lib/avatar';
import {
  extractYouTubeVideoId,
  formatVoteCount,
  getYouTubeThumbnailUrl,
  truncateHighlightTitle,
} from '@/lib/youtube';
import { useHighlightVotes, type VoteState } from '@/hooks/useHighlightVotes';
import type { Database } from '@/integrations/supabase/types';

type HighlightRow = Database['public']['Tables']['highlights']['Row'];

type HighlightCard = {
  id: string;
  youtubeUrl: string;
  youtubeVideoId: string;
  title: string;
  authorName: string;
  authorAvatarUrl: string | null;
  thumbnailUrl: string;
  baseVoteCount: number;
  isCurated: boolean;
  sortOrder: number | null;
  createdAt: string | null;
};

type UploadPreview = {
  url: string;
  videoId: string;
  title: string;
  thumbnailUrl: string;
  authorName: string;
  authorAvatarUrl: string | null;
};

type OEmbedResponse = {
  title?: string;
  thumbnail_url?: string;
};

const F_REGULAR = "'Base_Neue_Trial:Regular', 'Base Neue Trial', sans-serif";
const F_BOLD = "'Base_Neue_Trial:Expanded_Bold', 'Base Neue Trial', sans-serif";
const F_HEAD = "'Base_Neue_Trial:Expanded_Black_Oblique', 'Base Neue Trial', sans-serif";
const HIGHLIGHTS_ASSETS = '/highlights';

const CURATED_AVATAR_BY_AUTHOR: Record<string, string> = {
  dodoeu: `${HIGHLIGHTS_ASSETS}/avatar-dodoeu.png`,
  piz: `${HIGHLIGHTS_ASSETS}/avatar-piz.png`,
  clix: `${HIGHLIGHTS_ASSETS}/avatar-clix.png`,
  peterbot: `${HIGHLIGHTS_ASSETS}/avatar-peterbot.png`,
  eomzo: `${HIGHLIGHTS_ASSETS}/avatar-eomzo.png`,
  malibuca: `${HIGHLIGHTS_ASSETS}/avatar-malibuca.png`,
};

const CURATED_THUMBNAIL_BY_AUTHOR: Record<string, string> = {
  dodoeu: `${HIGHLIGHTS_ASSETS}/thumb-godzilla.png`,
  piz: `${HIGHLIGHTS_ASSETS}/thumb-piz.png`,
  clix: `${HIGHLIGHTS_ASSETS}/thumb-clix.png`,
  peterbot: `${HIGHLIGHTS_ASSETS}/thumb-peterbot.png`,
  eomzo: `${HIGHLIGHTS_ASSETS}/thumb-eomzo.png`,
  malibuca: `${HIGHLIGHTS_ASSETS}/thumb-malibuca.png`,
};

function getCuratedAssetKey(authorName: string) {
  return authorName.trim().toLowerCase();
}

function getCuratedAvatarUrl(authorName: string) {
  return CURATED_AVATAR_BY_AUTHOR[getCuratedAssetKey(authorName)] ?? null;
}

function getCuratedThumbnailUrl(authorName: string) {
  return CURATED_THUMBNAIL_BY_AUTHOR[getCuratedAssetKey(authorName)] ?? null;
}

const CURATED_HIGHLIGHTS: HighlightCard[] = [
  {
    id: '00000000-0000-4000-8000-000000000101',
    youtubeUrl: 'https://youtu.be/JWlBCQIQags?si=-6gGHkedcxMRwoF-',
    youtubeVideoId: 'JWlBCQIQags',
    title: 'Godzilla',
    authorName: 'Dodoeu',
    authorAvatarUrl: `${HIGHLIGHTS_ASSETS}/avatar-dodoeu.png`,
    thumbnailUrl: `${HIGHLIGHTS_ASSETS}/thumb-godzilla.png`,
    baseVoteCount: 273,
    isCurated: true,
    sortOrder: 10,
    createdAt: null,
  },
  {
    id: '00000000-0000-4000-8000-000000000102',
    youtubeUrl: 'https://youtu.be/HxRTrHyWB0Y?si=VdsoQIswI9eOlHG5',
    youtubeVideoId: 'HxRTrHyWB0Y',
    title: 'IL MIGLIOR HIGHLIGHTS...',
    authorName: 'Piz',
    authorAvatarUrl: `${HIGHLIGHTS_ASSETS}/avatar-piz.png`,
    thumbnailUrl: `${HIGHLIGHTS_ASSETS}/thumb-piz.png`,
    baseVoteCount: 655,
    isCurated: true,
    sortOrder: 20,
    createdAt: null,
  },
  {
    id: '00000000-0000-4000-8000-000000000103',
    youtubeUrl: 'https://youtu.be/CtK-fV6TsBY?si=6zOsv5SjhmzvPEHJ',
    youtubeVideoId: 'CtK-fV6TsBY',
    title: 'Never Change | Clix',
    authorName: 'Clix',
    authorAvatarUrl: `${HIGHLIGHTS_ASSETS}/avatar-clix.png`,
    thumbnailUrl: `${HIGHLIGHTS_ASSETS}/thumb-clix.png`,
    baseVoteCount: 1200,
    isCurated: true,
    sortOrder: 30,
    createdAt: null,
  },
  {
    id: '00000000-0000-4000-8000-000000000104',
    youtubeUrl: 'https://youtu.be/K5MZeXFPsGc?si=axxBNUHOC5f-Ty1f',
    youtubeVideoId: 'K5MZeXFPsGc',
    title: '1st FNCS GRAND FINALS...',
    authorName: 'Peterbot',
    authorAvatarUrl: `${HIGHLIGHTS_ASSETS}/avatar-peterbot.png`,
    thumbnailUrl: `${HIGHLIGHTS_ASSETS}/thumb-peterbot.png`,
    baseVoteCount: 5300,
    isCurated: true,
    sortOrder: 40,
    createdAt: null,
  },
  {
    id: '00000000-0000-4000-8000-000000000105',
    youtubeUrl: 'https://youtu.be/4xv3O_VrW0M?si=KE0tHu7KU0qFt0ov',
    youtubeVideoId: '4xv3O_VrW0M',
    title: 'Pricey | Eomzo Highlig...',
    authorName: 'Eomzo',
    authorAvatarUrl: `${HIGHLIGHTS_ASSETS}/avatar-eomzo.png`,
    thumbnailUrl: `${HIGHLIGHTS_ASSETS}/thumb-eomzo.png`,
    baseVoteCount: 973,
    isCurated: true,
    sortOrder: 50,
    createdAt: null,
  },
  {
    id: '00000000-0000-4000-8000-000000000106',
    youtubeUrl: 'https://youtu.be/CtK-fV6TsBY?si=6zOsv5SjhmzvPEHJ',
    youtubeVideoId: 'CtK-fV6TsBY',
    title: 'Malibuca | Highlights #2',
    authorName: 'Malibuca',
    authorAvatarUrl: `${HIGHLIGHTS_ASSETS}/avatar-malibuca.png`,
    thumbnailUrl: `${HIGHLIGHTS_ASSETS}/thumb-malibuca.png`,
    baseVoteCount: 802,
    isCurated: true,
    sortOrder: 60,
    createdAt: null,
  },
];

function normalizeHighlight(row: HighlightRow): HighlightCard {
  const authorName = row.author_name || 'Player';
  const isCurated = Boolean(row.is_curated);
  const curatedAvatarUrl = isCurated ? getCuratedAvatarUrl(authorName) : null;
  const curatedThumbnailUrl = isCurated ? getCuratedThumbnailUrl(authorName) : null;

  return {
    id: row.id,
    youtubeUrl: row.youtube_url,
    youtubeVideoId: row.youtube_video_id,
    title: row.title,
    authorName,
    authorAvatarUrl: curatedAvatarUrl || row.author_avatar_url,
    thumbnailUrl: curatedThumbnailUrl || row.thumbnail_url || getYouTubeThumbnailUrl(row.youtube_video_id),
    baseVoteCount: row.base_vote_count ?? 0,
    isCurated,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function mergeCuratedHighlights(rows: HighlightCard[]) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  CURATED_HIGHLIGHTS.forEach((highlight) => {
    if (!byId.has(highlight.id)) {
      byId.set(highlight.id, highlight);
    }
  });
  return Array.from(byId.values()).sort(sortHighlights);
}

function sortHighlights(a: HighlightCard, b: HighlightCard) {
  if (a.isCurated !== b.isCurated) return a.isCurated ? -1 : 1;
  if (a.isCurated && b.isCurated) {
    return (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER);
  }
  const bTime = Date.parse(b.createdAt ?? '') || 0;
  const aTime = Date.parse(a.createdAt ?? '') || 0;
  return bTime - aTime;
}

function getTotalVotes(highlight: HighlightCard, voteCounts: Record<string, number>) {
  return highlight.baseVoteCount + (voteCounts[highlight.id] || 0);
}

export default function Highlights() {
  const location = useLocation();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [highlights, setHighlights] = useState<HighlightCard[]>(CURATED_HIGHLIGHTS);
  const [loadingHighlights, setLoadingHighlights] = useState(true);
  const [query, setQuery] = useState('');
  const [playerVideo, setPlayerVideo] = useState<HighlightCard | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [uploadPreview, setUploadPreview] = useState<UploadPreview | null>(null);
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'loading' | 'invalid' | 'error'>('idle');
  const [publishing, setPublishing] = useState(false);
  const {
    voteCounts,
    isVoting,
    getVoteState,
    castVote,
    removeVote,
  } = useHighlightVotes();

  const profileAvatar = getDiscordAvatarUrl(profile);
  const profileName = profile?.discord_display_name || profile?.username || 'Player';
  const profileInitial = getProfileInitial(profile);

  const loadHighlights = useCallback(async () => {
    setLoadingHighlights(true);
    const { data, error } = await supabase
      .from('highlights')
      .select('id,user_id,youtube_url,youtube_video_id,title,created_at,updated_at,is_weekly_winner,winner_week,is_curated,base_vote_count,author_name,author_avatar_url,thumbnail_url,sort_order');

    if (error) {
      console.error('Error fetching highlights:', error);
      setHighlights(CURATED_HIGHLIGHTS);
      setLoadingHighlights(false);
      return;
    }

    const rows = (data ?? []).map((row) => normalizeHighlight(row as HighlightRow));
    setHighlights(mergeCuratedHighlights(rows));
    setLoadingHighlights(false);
  }, []);

  useEffect(() => {
    void loadHighlights();
  }, [loadHighlights]);

  useEffect(() => {
    if (!uploadOpen) {
      setYoutubeUrl('');
      setUploadPreview(null);
      setPreviewStatus('idle');
    }
  }, [uploadOpen]);

  useEffect(() => {
    if (!uploadOpen) return;

    const trimmed = youtubeUrl.trim();
    if (!trimmed) {
      setUploadPreview(null);
      setPreviewStatus('idle');
      return;
    }

    const videoId = extractYouTubeVideoId(trimmed);
    if (!videoId) {
      setUploadPreview(null);
      setPreviewStatus('invalid');
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setPreviewStatus('loading');

      try {
        const response = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(trimmed)}&format=json`,
          { signal: controller.signal },
        );

        if (!response.ok) throw new Error('Preview unavailable');

        const meta = (await response.json()) as OEmbedResponse;
        setUploadPreview({
          url: trimmed,
          videoId,
          title: meta.title || 'YouTube highlight',
          thumbnailUrl: meta.thumbnail_url || getYouTubeThumbnailUrl(videoId),
          authorName: profileName,
          authorAvatarUrl: profileAvatar,
        });
        setPreviewStatus('idle');
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('YouTube preview error:', error);
        setUploadPreview({
          url: trimmed,
          videoId,
          title: 'YouTube highlight',
          thumbnailUrl: getYouTubeThumbnailUrl(videoId),
          authorName: profileName,
          authorAvatarUrl: profileAvatar,
        });
        setPreviewStatus('error');
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [profileAvatar, profileName, uploadOpen, youtubeUrl]);

  const filteredHighlights = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const sorted = [...highlights].sort(sortHighlights);
    if (!needle) return sorted;
    return sorted.filter((item) => {
      return (
        item.title.toLowerCase().includes(needle) ||
        item.authorName.toLowerCase().includes(needle)
      );
    });
  }, [highlights, query]);

  const activeTab = location.pathname.endsWith('/week')
    ? 'week'
    : location.pathname.endsWith('/month')
      ? 'month'
      : 'all';
  const isRankingPage = activeTab !== 'all';

  const rankedHighlights = useMemo(() => {
    return [...filteredHighlights].sort((a, b) => {
      const bTotal = getTotalVotes(b, voteCounts);
      const aTotal = getTotalVotes(a, voteCounts);
      if (bTotal !== aTotal) return bTotal - aTotal;
      return sortHighlights(a, b);
    }).slice(0, 4);
  }, [filteredHighlights, voteCounts]);
  const playerVideoVoteState = playerVideo ? getVoteState(playerVideo.id) : 'NOT_VOTED';
  const playerVideoVotedThis = playerVideoVoteState === 'VOTED_THIS';
  const playerVideoVotes = playerVideo ? getTotalVotes(playerVideo, voteCounts) : 0;

  const handleVote = async (highlightId: string) => {
    const state = getVoteState(highlightId);
    if (state === 'VOTED_THIS') {
      await removeVote(highlightId);
    } else {
      await castVote(highlightId);
    }
  };

  const handleUploadClick = () => {
    if (!user) {
      toast({
        title: 'Login required',
        description: 'Please login to upload an highlight',
        variant: 'destructive',
      });
      return;
    }
    setUploadOpen(true);
  };

  const handlePublish = async () => {
    if (!user || !uploadPreview) return;
    setPublishing(true);

    const displayTitle = truncateHighlightTitle(uploadPreview.title);
    const { data, error } = await supabase
      .from('highlights')
      .insert({
        user_id: user.id,
        youtube_url: uploadPreview.url,
        youtube_video_id: uploadPreview.videoId,
        title: displayTitle,
        is_curated: false,
        base_vote_count: 0,
        author_name: profileName,
        author_avatar_url: uploadPreview.authorAvatarUrl,
        thumbnail_url: uploadPreview.thumbnailUrl,
        sort_order: null,
      })
      .select('id,user_id,youtube_url,youtube_video_id,title,created_at,updated_at,is_weekly_winner,winner_week,is_curated,base_vote_count,author_name,author_avatar_url,thumbnail_url,sort_order')
      .single();

    setPublishing(false);

    if (error) {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    if (data) {
      setHighlights((prev) => [normalizeHighlight(data as HighlightRow), ...prev].sort(sortHighlights));
    }

    toast({
      title: 'Highlight published',
      description: 'Your video is now live for votes.',
    });
    setUploadOpen(false);
  };

  return (
    <PublicLayout>
      {isRankingPage ? (
        <HighlightsRankingPage
          mode={activeTab === 'week' ? 'week' : 'month'}
          highlights={rankedHighlights}
          loading={loadingHighlights}
          query={query}
          voteCounts={voteCounts}
          isVoting={isVoting}
          getVoteState={getVoteState}
          onQueryChange={setQuery}
          onUploadClick={handleUploadClick}
          onOpen={(highlight) => setPlayerVideo(highlight)}
          onVote={(highlightId) => void handleVote(highlightId)}
        />
      ) : (
        <section className="min-h-screen bg-[#0f0404] pt-[156px] text-white">
          <img
            aria-hidden="true"
            src="/figma-assets/figma-neon.png"
            alt=""
            className="pointer-events-none fixed left-0 top-0 z-[6] h-[146px] w-full object-cover opacity-90"
          />

          <div className="mx-auto w-full max-w-[1532px] px-8 pb-32">
            <header className="relative min-h-[205px]">
              <img
                aria-hidden="true"
                src="/highlights/title-triangles.svg"
                alt=""
                className="absolute left-[-71px] top-0 h-[185.808px] w-[123.872px]"
              />
              <h1
                className="absolute left-0 top-[77px] m-0 text-[80px] leading-none text-white"
                style={{ fontFamily: F_HEAD, letterSpacing: 0 }}
              >
                HIGHLIGHTS
              </h1>
              <div
                aria-hidden="true"
                className="absolute left-[-12px] top-[165.5px] flex h-[21.289px] w-[820.394px] max-w-[72vw] items-center justify-center overflow-visible"
              >
                <div className="h-[820.335px] w-[18.421px] flex-none rotate-[89.8deg] -scale-y-100">
                  <div className="relative h-full w-full">
                    <div className="absolute bottom-1/4 left-[6.7%] right-[6.7%] top-0">
                      <img
                        src="/highlights/title-underline-raw.svg"
                        alt=""
                        className="block h-full w-full max-w-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </header>

            <HighlightsToolbar
              activeTab={activeTab}
              query={query}
              onQueryChange={setQuery}
              onUploadClick={handleUploadClick}
            />

            {loadingHighlights ? (
              <div className="grid min-h-[360px] place-items-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#ff1654]" />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-x-[124px] gap-y-[50px] md:grid-cols-2 xl:grid-cols-3">
                {filteredHighlights.map((highlight) => (
                  <HighlightCardView
                    key={highlight.id}
                    highlight={highlight}
                    totalVotes={getTotalVotes(highlight, voteCounts)}
                    voteState={getVoteState(highlight.id)}
                    isVoting={isVoting}
                    onOpen={() => setPlayerVideo(highlight)}
                    onVote={() => void handleVote(highlight.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <Dialog open={Boolean(playerVideo)} onOpenChange={(open) => !open && setPlayerVideo(null)}>
        <DialogContent className="max-w-[1040px] border-[#ff1654]/70 bg-[#0f0404] p-0 text-white sm:rounded-[8px]">
          {playerVideo ? (
            <div className="p-5">
              <DialogTitle className="sr-only">{playerVideo.title}</DialogTitle>
              <DialogDescription className="sr-only">
                Watch the highlight video, vote for it, or open it on YouTube.
              </DialogDescription>
              <div className="aspect-video w-full overflow-hidden rounded-[8px] bg-black">
                <iframe
                  title={playerVideo.title}
                  src={`https://www.youtube.com/embed/${playerVideo.youtubeVideoId}?autoplay=1&rel=0`}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
              <div className="mt-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-[24px] leading-none" style={{ fontFamily: F_BOLD }}>{playerVideo.title}</p>
                  <p className="mt-1 text-[14px] text-white/50" style={{ fontFamily: F_REGULAR }}>{playerVideo.authorName}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void handleVote(playerVideo.id)}
                    aria-label={`${playerVideoVotedThis ? 'Remove vote from' : 'Vote for'} ${playerVideo.title}`}
                    aria-pressed={playerVideoVotedThis}
                    className={`inline-flex h-[42px] min-w-[118px] items-center justify-center gap-2 rounded-[8px] border px-4 text-[16px] text-white transition-transform duration-150 ease-out hover:scale-[1.03] active:scale-90 ${
                      playerVideoVotedThis ? 'border-[#ff1654] bg-[#ff1654]' : 'border-[#ff1654] bg-[#282828]'
                    }`}
                    style={{ fontFamily: F_BOLD, letterSpacing: 0 }}
                  >
                    <img
                      src={playerVideoVotedThis ? '/highlights/like-hot.svg' : '/highlights/like-muted.svg'}
                      alt=""
                      aria-hidden="true"
                      className="h-[17px] w-[19px]"
                      style={{ filter: playerVideoVotedThis ? undefined : 'brightness(0) invert(1)' }}
                    />
                    <span>{formatVoteCount(playerVideoVotes)}</span>
                  </button>
                  <a
                    href={playerVideo.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-[42px] shrink-0 items-center gap-2 rounded-[8px] border border-[#ff1654] px-4 text-[14px] text-white"
                    style={{ fontFamily: F_BOLD, letterSpacing: 0 }}
                  >
                    <ExternalLink className="h-4 w-4" />
                    OPEN ON YOUTUBE
                  </a>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="h-[800px] max-h-[calc(100vh-32px)] w-[903px] max-w-[calc(100vw-32px)] gap-0 overflow-y-auto border-[1.462px] border-[#ff1654] bg-[#282828] p-0 text-white sm:rounded-[18px]">
          <div className="flex min-h-full flex-col items-center px-[58px] pb-[42px] pt-[42px]">
            <DialogHeader className="space-y-0 text-center">
              <DialogTitle
                className="text-center text-[64px] leading-none text-white"
                style={{ fontFamily: F_HEAD, letterSpacing: 0 }}
              >
                UPLOAD VIDEO
              </DialogTitle>
              <DialogDescription className="sr-only">
                Paste a YouTube URL to preview and publish your highlight.
              </DialogDescription>
            </DialogHeader>

            <label className="mt-[50px] block w-[785px] max-w-full text-[24px] text-white" style={{ fontFamily: F_REGULAR, letterSpacing: 0 }}>
              YouTube URL:
              <input
                value={youtubeUrl}
                onChange={(event) => setYoutubeUrl(event.target.value)}
                placeholder="https://youtu.be/..."
                className="mt-2 h-[59px] w-full rounded-[18px] border-0 bg-black/50 px-5 text-[20px] text-white outline-none ring-0 placeholder:text-white/45 focus:border-transparent focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
                style={{ fontFamily: F_REGULAR, letterSpacing: 0, boxShadow: 'none' }}
              />
            </label>

            <div className="mt-[29px] flex min-h-[340px] w-full items-center justify-center">
              {previewStatus === 'loading' ? (
                <div className="grid h-[340px] place-items-center">
                  <Loader2 className="h-8 w-8 animate-spin text-[#ff1654]" />
                </div>
              ) : uploadPreview ? (
                <div className="mx-auto w-[453.702px] max-w-full">
                  <HighlightPreview
                    preview={uploadPreview}
                    title={truncateHighlightTitle(uploadPreview.title)}
                    profileInitial={profileInitial}
                  />
                </div>
              ) : (
                <div className="grid h-[255.207px] w-[453.702px] max-w-full place-items-center border-y border-white/30 text-center">
                  <p className="text-[18px] text-white/45" style={{ fontFamily: F_REGULAR, letterSpacing: 0 }}>
                    {previewStatus === 'invalid' ? 'Paste a valid YouTube link.' : 'Paste a YouTube link to create the preview.'}
                  </p>
                </div>
              )}
            </div>

            <div className="mx-auto mt-[20px] h-px w-[589px] max-w-full bg-white/80" />

            <button
              type="button"
              onClick={() => void handlePublish()}
              disabled={!uploadPreview || publishing}
              className="mx-auto mt-[15px] flex h-[69px] w-[361px] max-w-full items-center justify-center rounded-[23px] bg-[#ff1654] text-[36px] text-white disabled:cursor-not-allowed disabled:opacity-45"
              style={{ fontFamily: F_HEAD, letterSpacing: 0, boxShadow: 'inset 0 4px 4px rgba(255,255,255,0.18), inset 0 -4px 4px rgba(0,0,0,0.25)' }}
            >
              {publishing ? <Loader2 className="h-8 w-8 animate-spin" /> : 'PUBLISH'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </PublicLayout>
  );
}

function ToolbarButton({
  label,
  tone,
  icon,
  onClick,
  to,
  active = false,
}: {
  label: string;
  tone: 'gray' | 'lime' | 'purple' | 'pink';
  icon: ReactNode;
  onClick?: () => void;
  to?: string;
  active?: boolean;
}) {
  const toneStyles = {
    gray: {
      base: 'border-white/50 bg-[#282828]/80 text-white min-w-[211px]',
      active: 'border-white/50 bg-[#282828] text-white min-w-[211px]',
    },
    lime: {
      base: 'border-[#d8ff16] bg-[#d8ff16]/20 text-white min-w-[250px]',
      active: 'border-[#d8ff16] bg-[#d8ff16] text-[#0f0404] min-w-[250px]',
    },
    purple: {
      base: 'border-[#625afa] bg-[#625afa]/20 text-white min-w-[230px]',
      active: 'border-[#625afa] bg-[#625afa] text-white min-w-[230px]',
    },
    pink: {
      base: 'border-[#ff1654] bg-[#ff1654]/20 text-white min-w-[182px]',
      active: 'border-[#ff1654] bg-[#ff1654] text-white min-w-[182px]',
    },
  } as const;
  const styles = toneStyles[tone];
  const className = `flex h-[47px] shrink-0 flex-nowrap items-center justify-center gap-3 rounded-[16px] border px-4 text-[24px] leading-none no-underline ${active ? styles.active : styles.base}`;
  const content = (
    <>
      {icon}
      <span className={`whitespace-nowrap ${label === 'UPLOAD' ? '-translate-y-[2px]' : ''}`}>{label}</span>
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className={className}
        style={{ fontFamily: F_BOLD, letterSpacing: 0, whiteSpace: 'nowrap' }}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      style={{ fontFamily: F_BOLD, letterSpacing: 0, whiteSpace: 'nowrap' }}
    >
      {content}
    </button>
  );
}

function HighlightsToolbar({
  activeTab,
  query,
  onQueryChange,
  onUploadClick,
  withBottomMargin = true,
}: {
  activeTab: 'all' | 'week' | 'month';
  query: string;
  onQueryChange: (value: string) => void;
  onUploadClick: () => void;
  withBottomMargin?: boolean;
}) {
  return (
    <div className={`${withBottomMargin ? 'mb-[54px]' : ''} flex flex-wrap items-center gap-6 xl:gap-[17px]`}>
      <label className="relative block h-[47px] w-[400px] max-w-full">
        <span className="sr-only">Search by title or author</span>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search by title or author"
          className="h-full w-full rounded-[12px] border border-white/[0.15] bg-[#282828] pl-4 pr-12 text-[20px] text-white outline-none placeholder:text-white/50"
          style={{ fontFamily: F_REGULAR, letterSpacing: 0 }}
        />
        <Search aria-hidden="true" className="absolute right-4 top-1/2 h-[22px] w-[22px] -translate-y-1/2 text-white/50" />
      </label>

      <ToolbarButton label="REWARDS" tone="gray" icon={<Info aria-hidden="true" className="h-4 w-4" />} />
      <ToolbarButton
        label="TOP MONTH"
        tone="lime"
        icon={<img src="/highlights/icon-top-month.svg" alt="" aria-hidden="true" className="h-[19px] w-[23px]" />}
        to="/highlights/month"
        active={activeTab === 'month'}
      />
      <ToolbarButton
        label="TOP WEEK"
        tone="purple"
        icon={<img src="/highlights/icon-top-week.svg" alt="" aria-hidden="true" className="h-[19px] w-[23px]" />}
        to="/highlights/week"
        active={activeTab === 'week'}
      />
      <ToolbarButton
        label="UPLOAD"
        tone="pink"
        icon={<Plus aria-hidden="true" className="h-5 w-5" />}
        onClick={onUploadClick}
      />
    </div>
  );
}

type RankingMode = 'week' | 'month';

type RankingTitleConfig = {
  text: string;
  outlineTop: number;
  outlineWidth: number;
  outlineHeight: number;
  outlineInnerHeight: number;
};

type RankingCardLayout = {
  imageLeft: string;
  imageTop: number;
  avatarLeft: string;
  avatarTop: number;
  titleLeft: string;
  titleTop: number;
  authorLeft: string;
  authorTop: number;
  likeLeft: string;
  likeTop: number;
  likeIconLeft: string;
  likeIconTop: number;
  likeTextLeft: string;
  likeTextTop: number;
  hotByDefault?: boolean;
};

type RankingBadgeLayout = {
  starLeft: string;
  starTop: number;
  textLeft: string;
  textTop: number;
};

const RANKING_TITLE: Record<RankingMode, RankingTitleConfig> = {
  week: {
    text: 'HIGHLIGHTS - TOP WEEK',
    outlineTop: 318.56,
    outlineWidth: 1662.208,
    outlineHeight: 24.232,
    outlineInnerHeight: 1662.154,
  },
  month: {
    text: 'HIGHLIGHTS - TOP MONTH',
    outlineTop: 318.18,
    outlineWidth: 1770.982,
    outlineHeight: 24.612,
    outlineInnerHeight: 1770.929,
  },
};

const RANKING_NOMINEES_TITLE: Record<RankingMode, RankingTitleConfig> = {
  week: {
    text: 'THIS WEEK NOMINEES',
    outlineTop: 1273.97,
    outlineWidth: 1545.249,
    outlineHeight: 23.823,
    outlineInnerHeight: 1545.194,
  },
  month: {
    text: 'THIS MONTH NOMINEES',
    outlineTop: 1273.67,
    outlineWidth: 1630.798,
    outlineHeight: 24.122,
    outlineInnerHeight: 1630.744,
  },
};

const HERO_CARD_LAYOUT: RankingCardLayout = {
  imageLeft: 'calc(60% + 1px)',
  imageTop: 496,
  avatarLeft: 'calc(60% + 1px)',
  avatarTop: 815.93,
  titleLeft: 'calc(64% + 9.16px)',
  titleTop: 815.93,
  authorLeft: 'calc(64% + 9.16px)',
  authorTop: 874.42,
  likeLeft: 'calc(80% + 30px)',
  likeTop: 834,
  likeIconLeft: 'calc(80% + 48.28px)',
  likeIconTop: 841.31,
  likeTextLeft: 'calc(84% + 31.61px)',
  likeTextTop: 842.53,
  hotByDefault: true,
};

const NOMINEE_CARD_LAYOUTS: RankingCardLayout[] = [
  {
    imageLeft: 'calc(16% + 41.8px)',
    imageTop: 1407,
    avatarLeft: 'calc(16% + 41.8px)',
    avatarTop: 1726.93,
    titleLeft: 'calc(20% + 49.96px)',
    titleTop: 1726.93,
    authorLeft: 'calc(20% + 49.96px)',
    authorTop: 1785.42,
    likeLeft: 'calc(40% - 5.99px)',
    likeTop: 1746,
    likeIconLeft: 'calc(40% + 12.29px)',
    likeIconTop: 1753.31,
    likeTextLeft: 'calc(40% + 72.41px)',
    likeTextTop: 1754.53,
    hotByDefault: true,
  },
  {
    imageLeft: 'calc(56% + 1.8px)',
    imageTop: 1407,
    avatarLeft: 'calc(56% + 1.8px)',
    avatarTop: 1726.93,
    titleLeft: 'calc(60% + 9.96px)',
    titleTop: 1726.93,
    authorLeft: 'calc(60% + 9.96px)',
    authorTop: 1785.42,
    likeLeft: 'calc(76% + 30.81px)',
    likeTop: 1746,
    likeIconLeft: 'calc(76% + 49.09px)',
    likeIconTop: 1753.31,
    likeTextLeft: 'calc(80% + 32.91px)',
    likeTextTop: 1754.53,
  },
  {
    imageLeft: 'calc(16% + 47.8px)',
    imageTop: 1917,
    avatarLeft: 'calc(16% + 47.8px)',
    avatarTop: 2236.93,
    titleLeft: 'calc(20% + 55.96px)',
    titleTop: 2236.93,
    authorLeft: 'calc(20% + 55.96px)',
    authorTop: 2295.42,
    likeLeft: 'calc(40% + 0.01px)',
    likeTop: 2256,
    likeIconLeft: 'calc(40% + 18.29px)',
    likeIconTop: 2263.31,
    likeTextLeft: 'calc(40% + 78.91px)',
    likeTextTop: 2264.53,
  },
  {
    imageLeft: 'calc(56% + 7.8px)',
    imageTop: 1917,
    avatarLeft: 'calc(56% + 7.8px)',
    avatarTop: 2236.93,
    titleLeft: 'calc(60% + 15.96px)',
    titleTop: 2236.93,
    authorLeft: 'calc(60% + 15.96px)',
    authorTop: 2295.42,
    likeLeft: 'calc(76% + 36.81px)',
    likeTop: 2256,
    likeIconLeft: 'calc(76% + 55.09px)',
    likeIconTop: 2263.31,
    likeTextLeft: 'calc(80% + 38.41px)',
    likeTextTop: 2264.53,
  },
];

const RANK_BADGE_LAYOUTS: RankingBadgeLayout[] = [
  { starLeft: 'calc(12% + 28.6px)', starTop: 1317, textLeft: 'calc(16% + 72.8px)', textTop: 1378 },
  { starLeft: 'calc(48% + 65.4px)', starTop: 1317, textLeft: 'calc(52% + 109.6px)', textTop: 1378 },
  { starLeft: 'calc(12% + 34.6px)', starTop: 1827, textLeft: 'calc(16% + 78.8px)', textTop: 1888 },
  { starLeft: 'calc(52% - 5.4px)', starTop: 1827, textLeft: 'calc(52% + 115.6px)', textTop: 1888 },
];

const RANKING_TITLE_BY_AUTHOR: Record<string, string> = {
  peterbot: '1st FNCS GRAND FINALS...',
  clix: 'Never Change \u{1F494} | Clix',
  eomzo: 'Pricey \u{1F4B8} | Eomzo Highligh...',
  malibuca: 'Malibuca | Highlights #2',
};

const RANKING_VISUAL_AUTHOR: Record<string, string> = {
  peterbot: 'peterbot',
  clix: 'clix',
  eomzo: 'eomzo',
  malibuca: 'malibuca',
};

function rankingAsset(mode: RankingMode, name: string) {
  return `${HIGHLIGHTS_ASSETS}/rank-${mode}-${name}`;
}

function getRankingVisualAuthor(authorName: string) {
  return RANKING_VISUAL_AUTHOR[getCuratedAssetKey(authorName)];
}

function getRankingDisplayTitle(highlight: HighlightCard) {
  return RANKING_TITLE_BY_AUTHOR[getCuratedAssetKey(highlight.authorName)] ?? highlight.title;
}

function getRankingThumbnail(mode: RankingMode, highlight: HighlightCard) {
  const author = getRankingVisualAuthor(highlight.authorName);
  return author ? rankingAsset(mode, `thumb-${author}.jpg`) : highlight.thumbnailUrl;
}

function getRankingAvatar(mode: RankingMode, highlight: HighlightCard) {
  const author = getRankingVisualAuthor(highlight.authorName);
  return author ? rankingAsset(mode, `avatar-${author}.png`) : highlight.authorAvatarUrl;
}

function HighlightsRankingPage({
  mode,
  highlights,
  loading,
  query,
  voteCounts,
  isVoting,
  getVoteState,
  onQueryChange,
  onUploadClick,
  onOpen,
  onVote,
}: {
  mode: 'week' | 'month';
  highlights: HighlightCard[];
  loading: boolean;
  query: string;
  voteCounts: Record<string, number>;
  isVoting: boolean;
  getVoteState: (highlightId: string) => VoteState;
  onQueryChange: (value: string) => void;
  onUploadClick: () => void;
  onOpen: (highlight: HighlightCard) => void;
  onVote: (highlightId: string) => void;
}) {
  const isWeek = mode === 'week';
  const heroCopy = isWeek ? 'Winner of the week\nearns EXTRA coins!*' : 'Winner of the month\ngets a FREE montage!*';
  const note = isWeek
    ? '*The winner of the week will receive 5 coins for free!'
    : '*The winner will choose the editor he likes the most.\nOLEBOY will pay for the video. No extra-fees.';
  const bottomCta = isWeek ? 'BEST OF THE MONTH' : 'FOR YOU';
  const winner = highlights[0] ?? null;
  const nominees = highlights.slice(0, 4);

  return (
    <div className="w-full overflow-x-auto bg-[#0f0404] text-white">
      <section className="relative h-[2547px] w-[1920px] overflow-hidden bg-[#0f0404] text-white">
        <img
          src={rankingAsset(mode, 'top-neon.png')}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 h-[146px] w-[1920px] object-cover"
        />

        <ExactRankingTitle mode={mode} config={RANKING_TITLE[mode]} top={156} textTop={233} />
        <ExactRankingToolbar
          mode={mode}
          query={query}
          onQueryChange={onQueryChange}
          onUploadClick={onUploadClick}
        />

        <ExactHeroFeature mode={mode} copy={heroCopy} note={note} />

        {loading ? (
          <ExactLoadingCard left="calc(60% + 1px)" top={496} />
        ) : winner ? (
          <ExactRankingCard
            mode={mode}
            highlight={winner}
            totalVotes={getTotalVotes(winner, voteCounts)}
            voteState={getVoteState(winner.id)}
            isVoting={isVoting}
            layout={HERO_CARD_LAYOUT}
            onOpen={() => onOpen(winner)}
            onVote={() => onVote(winner.id)}
          />
        ) : null}

        <div id="highlight-nominees" className="absolute left-0 top-[955px] h-[955px] w-[1920px] bg-[#0f0404]" />
        <ExactRankingTitle mode={mode} config={RANKING_NOMINEES_TITLE[mode]} top={1111} textTop={1188} />

        {loading ? (
          <div className="absolute left-[348px] top-[1407px] grid h-[360px] w-[1258px] place-items-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#ff1654]" />
          </div>
        ) : nominees.length > 0 ? (
          nominees.map((highlight, index) => (
            <ExactNominee
              key={highlight.id}
              mode={mode}
              rank={index + 1}
              highlight={highlight}
              totalVotes={getTotalVotes(highlight, voteCounts)}
              voteState={getVoteState(highlight.id)}
              isVoting={isVoting}
              onOpen={() => onOpen(highlight)}
              onVote={() => onVote(highlight.id)}
            />
          ))
        ) : (
          <p
            className="absolute left-[348px] top-[1407px] text-[24px] text-white/60"
            style={{ fontFamily: F_BOLD, letterSpacing: 0 }}
          >
            No highlights found.
          </p>
        )}

        <ExactBottomCta mode={mode} label={bottomCta} />
      </section>
      <div className="w-[1920px]">
        <FooterSection />
      </div>
    </div>
  );
}

function ExactRankingTitle({
  mode,
  config,
  top,
  textTop,
}: {
  mode: RankingMode;
  config: RankingTitleConfig;
  top: number;
  textTop: number;
}) {
  const monthOffset = mode === 'month' ? -10 : 0;
  const titleTextLift = 14;

  return (
    <>
      <p
        className="absolute z-[2] m-0 whitespace-nowrap text-[80px] leading-normal text-white"
        style={{
          left: 'calc(12% + 5.6px)',
          top: textTop + monthOffset - titleTextLift,
          fontFamily: F_HEAD,
          letterSpacing: 0,
        }}
      >
        {config.text}
      </p>
      <ExactOutline
        src={rankingAsset(mode, `${textTop === 233 ? 'outline-title' : 'outline-nominees'}.svg`)}
        left="calc(12% - 6.09px)"
        top={config.outlineTop + monthOffset}
        width={config.outlineWidth}
        height={config.outlineHeight}
        innerHeight={config.outlineInnerHeight}
      />
      <img
        src={rankingAsset(mode, 'triangles.svg')}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute z-[2] h-[185.808px] w-[123.872px]"
        style={{ left: 'calc(8% + 11.4px)', top: top + monthOffset }}
      />
    </>
  );
}

function ExactOutline({
  src,
  left,
  top,
  width,
  height,
  innerHeight,
}: {
  src: string;
  left: string;
  top: number;
  width: number;
  height: number;
  innerHeight: number;
}) {
  return (
    <div
      aria-hidden="true"
      className="absolute z-[1] flex items-center justify-center"
      style={{ left, top, width, height }}
    >
      <div style={{ transform: 'rotate(89.8deg) scaleY(-1)', flex: 'none' }}>
        <div className="relative w-[18.421px]" style={{ height: innerHeight }}>
          <div className="absolute bottom-1/4 left-[6.7%] right-[6.7%] top-0">
            <img alt="" className="block h-full w-full max-w-none" src={src} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ExactRankingToolbar({
  mode,
  query,
  onQueryChange,
  onUploadClick,
}: {
  mode: RankingMode;
  query: string;
  onQueryChange: (value: string) => void;
  onUploadClick: () => void;
}) {
  return (
    <div className="absolute left-0 top-0 z-[5] h-[500px] w-[1920px]">
      <label
        className="absolute block h-[47px] w-[400px]"
        style={{ left: 'calc(12% + 5.6px)', top: 396 }}
      >
        <span className="sr-only">Search by title or author</span>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search by title or author"
          className="h-full w-full rounded-[12px] border border-white/[0.15] bg-[#282828] pl-[15px] pr-[52px] text-[20px] text-white outline-none placeholder:text-white/50"
          style={{ fontFamily: F_REGULAR, letterSpacing: 0 }}
        />
      </label>
      <ExactSearchIcon mode={mode} />
      <ExactToolbarButton
        as="button"
        label="REWARDS"
        left="calc(40% - 8px)"
        top={396}
        width={211}
        border="rgba(255,255,255,0.5)"
        background="rgba(40,40,40,0.8)"
      >
        <img
          src={rankingAsset(mode, 'info.svg')}
          alt=""
          aria-hidden="true"
          className="absolute h-4 w-4"
          style={{ left: 16, top: 16 }}
        />
        <span
          aria-hidden="true"
          className="absolute flex h-[10px] w-1 -translate-x-1/2 -translate-y-1/2 items-center justify-center text-center text-[13px] leading-none text-[#282828]/80"
          style={{ left: 24, top: 24, fontFamily: F_BOLD, letterSpacing: 0 }}
        >
          i
        </span>
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap text-[24px] leading-normal text-white"
          style={{ left: 113, top: 10, fontFamily: F_BOLD, letterSpacing: 0 }}
        >
          REWARDS
        </span>
      </ExactToolbarButton>
      <ExactToolbarButton
        as="link"
        to="/highlights/month"
        label="TOP MONTH"
        left="calc(48% + 66.4px)"
        top={395}
        width={250}
        border="#d8ff16"
        background={mode === 'month' ? '#d8ff16' : 'rgba(216,255,22,0.2)'}
      >
        <ExactCrownIcon color={mode === 'month' ? '#0f0404' : '#d8ff16'} left={17} top={17} />
        <span
          className="absolute whitespace-nowrap text-[24px] leading-normal"
          style={{
            left: 55,
            top: 10,
            color: mode === 'month' ? '#0f0404' : '#ffffff',
            fontFamily: F_BOLD,
            letterSpacing: 0,
          }}
        >
          TOP MONTH
        </span>
      </ExactToolbarButton>
      <ExactToolbarButton
        as="link"
        to="/highlights/week"
        label="TOP WEEK"
        left="calc(64% + 26.2px)"
        top={395}
        width={230}
        border="#625afa"
        background={mode === 'week' ? '#625afa' : 'rgba(98,90,250,0.2)'}
      >
        <ExactCrownIcon color={mode === 'week' ? '#ffffff' : '#625afa'} left={18} top={17} />
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap text-[24px] leading-normal text-white"
          style={{ left: 135, top: 10, fontFamily: F_BOLD, letterSpacing: 0 }}
        >
          TOP WEEK
        </span>
      </ExactToolbarButton>
      <ExactToolbarButton
        as="button"
        label="UPLOAD"
        left="calc(76% + 42.8px)"
        top={395}
        width={182}
        border="#ff1654"
        background="rgba(255,22,84,0.2)"
        onClick={onUploadClick}
      >
        <img
          src={rankingAsset(mode, 'plus.svg')}
          alt=""
          aria-hidden="true"
          className="absolute h-[18px] w-[18px]"
          style={{ left: 20, top: 14 }}
        />
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap text-[24px] leading-normal text-white"
          style={{ left: 103, top: 7, fontFamily: F_BOLD, letterSpacing: 0 }}
        >
          UPLOAD
        </span>
      </ExactToolbarButton>
    </div>
  );
}

function ExactSearchIcon({ mode }: { mode: RankingMode }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute flex h-[31.113px] w-[31.113px] items-center justify-center"
      style={{ left: 'calc(28% + 55.4px)', top: 404 }}
    >
      <div style={{ transform: 'rotate(-45deg)', flex: 'none' }}>
        <div className="relative h-[26px] w-[18px]">
          <div className="absolute inset-[0_0_-7.69%_0]">
            <img alt="" className="block h-full w-full max-w-none" src={rankingAsset(mode, 'search.svg')} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ExactCrownIcon({ color, left, top }: { color: string; left: number; top: number }) {
  return (
    <svg
      aria-hidden="true"
      className="absolute h-[19px] w-[23px]"
      style={{ left, top }}
      viewBox="0 0 23 19"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M23 19H0V0L4.79167 9.5L3.83333 14.725L11.8966 0L17.25 9.5L16.7708 14.725L23 0V19Z"
        fill={color}
      />
    </svg>
  );
}

function ExactToolbarButton({
  as,
  to,
  label,
  left,
  top,
  width,
  border,
  background,
  onClick,
  children,
}: {
  as: 'button' | 'link';
  to?: string;
  label: string;
  left: string;
  top: number;
  width: number;
  border: string;
  background: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const style = {
    position: 'absolute' as const,
    left,
    top,
    width,
    height: 47,
    borderRadius: 16,
    border: `1px solid ${border}`,
    background,
    color: '#ffffff',
    textDecoration: 'none',
  };

  if (as === 'link' && to) {
    return (
      <Link to={to} aria-label={label} style={style}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" aria-label={label} onClick={onClick} style={{ ...style, padding: 0 }}>
      {children}
    </button>
  );
}

function ExactHeroFeature({ mode, copy, note }: { mode: RankingMode; copy: string; note: string }) {
  const isWeek = mode === 'week';

  return (
    <>
      <div
        aria-hidden="true"
        className="absolute z-0 flex items-center justify-center"
        style={{ left: 'calc(8% + 14.4px)', top: 383, width: 866.424, height: 596.408 }}
      >
        <div style={{ transform: 'rotate(-15.44deg)', flex: 'none' }}>
          <div className="relative h-[401.031px] w-[788.09px]">
            <div className="absolute bottom-[-0.22%] left-0 right-0 top-[-0.26%]">
              <img
                src={rankingAsset(mode, 'hero-star.svg')}
                alt=""
                className="block h-full w-full max-w-none"
              />
            </div>
          </div>
        </div>
      </div>
      <p
        className="absolute z-[2] m-0 whitespace-pre-line text-[48px] leading-normal text-white"
        style={{
          left: isWeek ? 'calc(16% - 17.2px)' : 'calc(12% + 11.6px)',
          top: 598,
          fontFamily: F_BOLD,
          letterSpacing: 0,
        }}
      >
        {copy}
      </p>
      <button
        type="button"
        onClick={() => document.getElementById('highlight-nominees')?.scrollIntoView({ behavior: 'smooth' })}
        className="absolute z-[3] h-[65px] w-[292px] rounded-[50px] border border-[#ff1654] bg-[#ff1654]/[0.23] text-white shadow-[inset_0_4px_4px_rgba(255,255,255,0.14),inset_0_-4px_4px_rgba(0,0,0,0.25)]"
        style={{
          left: isWeek ? 'calc(24% + 7.2px)' : 'calc(24% + 11.2px)',
          top: 741,
          fontFamily: "'Base_Neue_Trial:Wide_Black', 'Base Neue Trial', sans-serif",
          letterSpacing: 0,
        }}
      >
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap text-[32px] leading-normal"
          style={{ left: isWeek ? 126.5 : 126.5, top: 14 }}
        >
          NOMINEES
        </span>
        <img
          src={rankingAsset(mode, 'arrow-down.svg')}
          alt=""
          aria-hidden="true"
          className="absolute h-[27px] w-[19px]"
          style={{ left: 241.6, top: 19 }}
        />
      </button>
      <p
        className="absolute z-[2] m-0 whitespace-pre-line text-[13px] leading-normal text-white"
        style={{
          left: 'calc(4% + 1.2px)',
          top: isWeek ? 870 : 855,
          fontFamily: "'Base_Neue_Trial:Expanded', 'Base Neue Trial', sans-serif",
          letterSpacing: 0,
        }}
      >
        {note}
      </p>
    </>
  );
}

function ExactLoadingCard({ left, top }: { left: string; top: number }) {
  return (
    <div
      className="absolute grid h-[298.688px] w-[531px] place-items-center rounded-[11px] bg-[#181818]"
      style={{ left, top }}
    >
      <Loader2 className="h-8 w-8 animate-spin text-[#ff1654]" />
    </div>
  );
}

function ExactNominee({
  mode,
  rank,
  highlight,
  totalVotes,
  voteState,
  isVoting,
  onOpen,
  onVote,
}: {
  mode: RankingMode;
  rank: number;
  highlight: HighlightCard;
  totalVotes: number;
  voteState: VoteState;
  isVoting: boolean;
  onOpen: () => void;
  onVote: () => void;
}) {
  const cardLayout = NOMINEE_CARD_LAYOUTS[rank - 1];
  const badgeLayout = RANK_BADGE_LAYOUTS[rank - 1];

  if (!cardLayout || !badgeLayout) return null;

  return (
    <>
      <ExactRankBadge mode={mode} rank={rank} layout={badgeLayout} />
      <ExactRankingCard
        mode={mode}
        highlight={highlight}
        totalVotes={totalVotes}
        voteState={voteState}
        isVoting={isVoting}
        layout={cardLayout}
        onOpen={onOpen}
        onVote={onVote}
      />
    </>
  );
}

function ExactRankingCard({
  mode,
  highlight,
  totalVotes,
  voteState,
  isVoting,
  layout,
  onOpen,
  onVote,
}: {
  mode: RankingMode;
  highlight: HighlightCard;
  totalVotes: number;
  voteState: VoteState;
  isVoting: boolean;
  layout: RankingCardLayout;
  onOpen: () => void;
  onVote: () => void;
}) {
  const votedThis = voteState === 'VOTED_THIS';
  const title = getRankingDisplayTitle(highlight);

  return (
    <>
      <div
        aria-hidden="true"
        className="absolute h-[298.688px] w-[531px] rounded-[11px] opacity-50 blur-[110.65px]"
        style={{ left: layout.imageLeft, top: layout.imageTop }}
      >
        <img
          src={getRankingThumbnail(mode, highlight)}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full max-w-none rounded-[11px] object-cover"
        />
      </div>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Play ${highlight.title}`}
        className="absolute h-[298.688px] w-[531px] overflow-hidden rounded-[11px] border-0 bg-transparent p-0 text-left"
        style={{ left: layout.imageLeft, top: layout.imageTop }}
      >
        <img
          src={getRankingThumbnail(mode, highlight)}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full max-w-none rounded-[11px] object-cover"
        />
      </button>
      <AvatarCircle
        src={getRankingAvatar(mode, highlight)}
        label={highlight.authorName}
        size={63.72}
        className="absolute"
        style={{ left: layout.avatarLeft, top: layout.avatarTop }}
      />
      <p
        className="absolute m-0 h-[70px] w-[317.272px] overflow-hidden text-[24px] text-white"
        style={{
          left: layout.titleLeft,
          top: layout.titleTop,
          fontFamily: F_BOLD,
          letterSpacing: 0,
          lineHeight: '31px',
          paddingBottom: 8,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {title}
      </p>
      <p
        className="absolute m-0 h-[22.567px] w-[71.685px] overflow-hidden whitespace-nowrap text-[14px] leading-normal text-white/50"
        style={{
          left: layout.authorLeft,
          top: layout.authorTop + 8,
          fontFamily: "'Base_Neue_Trial:Bold', 'Base Neue Trial', sans-serif",
          letterSpacing: 0,
        }}
      >
        {highlight.authorName}
      </p>
      <button
        type="button"
        onClick={onVote}
        aria-label={`${votedThis ? 'Remove vote from' : 'Vote for'} ${highlight.title}`}
        aria-pressed={votedThis}
        className="absolute h-[39px] w-[118.219px] rounded-[60.938px] transition-transform duration-150 ease-out active:scale-90 hover:scale-[1.03]"
        style={{
          left: layout.likeLeft,
          top: layout.likeTop,
          backgroundColor: votedThis ? '#ff1654' : '#282828',
          border: votedThis ? '0 solid transparent' : '1px solid #ff1654',
        }}
      />
      <img
        src={rankingAsset(mode, votedThis ? 'like-hot.svg' : 'like-muted.svg')}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute h-[19.449px] w-[21.938px]"
        style={{
          left: layout.likeIconLeft,
          top: layout.likeIconTop,
          filter: votedThis ? undefined : 'brightness(0) invert(1)',
        }}
      />
      <p
        className="pointer-events-none absolute m-0 -translate-x-1/2 whitespace-nowrap text-center text-[19.5px] leading-normal text-white"
        style={{
          left: layout.likeTextLeft,
          top: layout.likeTextTop,
          fontFamily: F_BOLD,
          letterSpacing: 0,
        }}
      >
        {formatVoteCount(totalVotes)}
      </p>
    </>
  );
}

function ExactRankBadge({
  mode,
  rank,
  layout,
}: {
  mode: RankingMode;
  rank: number;
  layout: RankingBadgeLayout;
}) {
  const starName = rank === 4 ? 'star-4' : `star-${rank}`;

  return (
    <>
      <div
        data-testid={`highlight-rank-badge-${rank}`}
        aria-hidden="true"
        className="absolute z-[4] flex h-[179.799px] w-[179.799px] items-center justify-center"
        style={{ left: layout.starLeft, top: layout.starTop }}
      >
        <div style={{ transform: 'rotate(9.9deg)', flex: 'none' }}>
          <div className="relative h-[155.401px] w-[155.401px]">
            {rank === 4 ? (
              <div className="absolute inset-[-46.07%]">
                <img
                  src={rankingAsset(mode, 'star-4-shadow.svg')}
                  alt=""
                  className="block h-full w-full max-w-none"
                />
              </div>
            ) : null}
            <img
              src={rankingAsset(mode, `${starName}.svg`)}
              alt=""
              className="absolute inset-0 block h-full w-full max-w-none"
            />
          </div>
        </div>
      </div>
      <p
        data-testid={`highlight-rank-label-${rank}`}
        aria-hidden="true"
        className="absolute z-[5] m-0 -translate-x-full whitespace-nowrap text-right text-[0px] leading-[0] text-white"
        style={{ left: layout.textLeft, top: layout.textTop, fontFamily: F_HEAD, letterSpacing: 0 }}
      >
        <span
          className="text-[44px] leading-normal"
          style={{ fontFamily: "'Atkinson_Hyperlegible_Mono:ExtraBold_Italic', monospace" }}
        >
          #
        </span>
        <span className="text-[44px] leading-normal">{rank}</span>
      </p>
    </>
  );
}

function ExactBottomCta({ mode, label }: { mode: RankingMode; label: string }) {
  const isWeek = mode === 'week';

  return (
    <Link
      to={isWeek ? '/highlights/month' : '/highlights'}
      className="absolute flex h-[65px] -translate-x-1/2 items-center justify-center gap-[14px] rounded-[50px] border border-[#ff1654] bg-[#ff1654]/[0.23] text-[24px] leading-normal text-white no-underline shadow-[inset_0_4px_4px_rgba(255,255,255,0.14),inset_0_-4px_4px_rgba(0,0,0,0.25)]"
      style={{
        left: 'calc(50% + 0.5px)',
        top: 2416,
        width: isWeek ? 337 : 201,
        fontFamily: "'Base_Neue_Trial:Bold', 'Base Neue Trial', sans-serif",
        letterSpacing: 0,
      }}
    >
      <span className="whitespace-nowrap">{label}</span>
      <img
        src={rankingAsset(mode, 'arrow-right.svg')}
        alt=""
        aria-hidden="true"
        className="h-[15.653px] w-[21.071px]"
        style={{ transform: 'rotate(90deg) scaleY(-1)' }}
      />
    </Link>
  );
}

function HighlightCardView({
  highlight,
  totalVotes,
  voteState,
  isVoting,
  onOpen,
  onVote,
  size = 'grid',
  rank,
}: {
  highlight: HighlightCard;
  totalVotes: number;
  voteState: VoteState;
  isVoting: boolean;
  onOpen: () => void;
  onVote: () => void;
  size?: 'grid' | 'large';
  rank?: number;
}) {
  const votedThis = voteState === 'VOTED_THIS';
  const isLarge = size === 'large';

  return (
    <article className={`relative ${isLarge ? 'w-[min(100%,531px)] xl:w-[531px]' : 'w-full max-w-[400px] xl:w-[400px]'}`}>
      {rank ? <RankBadge rank={rank} /> : null}
      <button
        type="button"
        onClick={onOpen}
        className={`group relative block w-full overflow-hidden rounded-[11px] bg-[#181818] text-left ${isLarge ? 'h-[298.688px]' : 'h-[225px]'}`}
        aria-label={`Play ${highlight.title}`}
      >
        <img
          src={highlight.thumbnailUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 rounded-[11px] bg-black/0 transition group-hover:bg-black/15" />
      </button>

      <div className={`grid gap-4 ${isLarge ? 'mt-5 grid-cols-[64px_minmax(0,1fr)_118px]' : 'mt-4 grid-cols-[48px_minmax(0,1fr)_97px]'}`}>
        <AvatarCircle
          src={highlight.authorAvatarUrl}
          label={highlight.authorName}
          size={isLarge ? 64 : 48}
        />
        <div className="min-w-0">
          <p
            className={`line-clamp-2 text-[24px] text-white ${isLarge ? 'leading-[27px]' : 'leading-[26px]'}`}
            style={{ fontFamily: F_BOLD, letterSpacing: 0 }}
          >
            {highlight.title}
          </p>
          <p
            className="mt-1 truncate text-[14px] leading-none text-white/50"
            style={{ fontFamily: "'Base_Neue_Trial:Bold', 'Base Neue Trial', sans-serif", letterSpacing: 0 }}
          >
            {highlight.authorName}
          </p>
        </div>
        <button
          type="button"
          onClick={onVote}
          aria-label={`${votedThis ? 'Remove vote from' : 'Vote for'} ${highlight.title}`}
          aria-pressed={votedThis}
          className={`mt-2 flex shrink-0 items-center justify-center gap-2 rounded-full border text-white transition-transform duration-150 ease-out hover:scale-[1.03] active:scale-90 ${isLarge ? 'h-[39px] w-[118px] text-[19.5px]' : 'h-[32px] w-[97px] text-[16px]'} ${
            votedThis ? 'border-[#ff1654] bg-[#ff1654]' : 'border-[#ff1654] bg-[#282828]'
          }`}
          style={{ fontFamily: F_BOLD, letterSpacing: 0 }}
        >
          <img
            src={votedThis ? '/highlights/like-hot.svg' : '/highlights/like-muted.svg'}
            alt=""
            aria-hidden="true"
            className={isLarge ? 'h-[19px] w-[22px]' : 'h-4 w-[18px]'}
            style={{ filter: votedThis ? undefined : 'brightness(0) invert(1)' }}
          />
          <span>{formatVoteCount(totalVotes)}</span>
        </button>
      </div>
    </article>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const fill = rank === 1 ? '#d7a437' : rank === 2 ? '#d6d6d6' : rank === 3 ? '#8d2044' : '#5b1630';
  const opacity = rank === 4 ? 0.34 : 0.88;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -left-[20px] -top-[20px] z-[3] grid h-[78px] w-[78px] place-items-center xl:-left-[36px] xl:-top-[36px] xl:h-[108px] xl:w-[108px]"
    >
      <div
        className="absolute inset-0"
        style={{
          background: fill,
          clipPath: 'polygon(50% 0%,61% 27%,90% 14%,73% 42%,100% 50%,73% 58%,90% 86%,61% 73%,50% 100%,39% 73%,10% 86%,27% 58%,0% 50%,27% 42%,10% 14%,39% 27%)',
          opacity,
        }}
      />
      <span
        className="relative -translate-y-1 text-[24px] leading-none text-white xl:text-[32px]"
        style={{ fontFamily: F_HEAD, letterSpacing: 0 }}
      >
        #{rank}
      </span>
    </div>
  );
}

function HighlightPreview({
  preview,
  title,
  profileInitial,
}: {
  preview: UploadPreview;
  title: string;
  profileInitial: string;
}) {
  return (
    <div>
      <div data-testid="highlight-upload-preview-media" className="relative h-[255.207px] w-[453.702px] max-w-full overflow-hidden rounded-[11px] bg-[#181818]">
        <img src={preview.thumbnailUrl} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="mt-[10px] grid grid-cols-[56px_minmax(0,1fr)_104px] gap-[18px]">
        <AvatarCircle src={preview.authorAvatarUrl} label={preview.authorName} size={56} fallback={profileInitial} />
        <div className="min-w-0">
          <p className="line-clamp-2 min-h-[32px] text-[24px] leading-[26px] text-white" style={{ fontFamily: F_BOLD, letterSpacing: 0 }}>
            {title}
          </p>
          <p className="mt-1 truncate text-[14px] text-white/50" style={{ fontFamily: F_REGULAR, letterSpacing: 0 }}>
            {preview.authorName}
          </p>
        </div>
        <div
          className="mt-[15px] flex h-[32.387px] w-[103.927px] shrink-0 items-center justify-center gap-2 rounded-[60.938px] bg-[#282828] text-[19.5px] text-white"
          style={{ fontFamily: F_BOLD, letterSpacing: 0 }}
        >
          <img src="/highlights/like-muted.svg" alt="" aria-hidden="true" className="h-[16.152px] w-[19.287px]" />
          <span>0</span>
        </div>
      </div>
    </div>
  );
}

function AvatarCircle({
  src,
  label,
  size,
  fallback,
  className,
  style,
}: {
  src: string | null;
  label: string;
  size: number;
  fallback?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const initial = fallback || label.trim().charAt(0).toUpperCase() || 'P';

  return (
    <div
      className={`overflow-hidden rounded-full border border-white/10 bg-[#ff1654]/25 ${className ?? ''}`}
      style={{ width: size, height: size, ...style }}
      aria-hidden="true"
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div
          className="grid h-full w-full place-items-center text-white"
          style={{ fontFamily: F_BOLD, fontSize: size * 0.42, letterSpacing: 0 }}
        >
          {initial}
        </div>
      )}
    </div>
  );
}

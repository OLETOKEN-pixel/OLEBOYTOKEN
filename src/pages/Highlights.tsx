import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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
    switchVote,
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

  const handleVote = async (highlightId: string) => {
    const state = getVoteState(highlightId);
    if (state === 'VOTED_THIS') {
      await removeVote();
    } else if (state === 'VOTED_OTHER') {
      await switchVote(highlightId);
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
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-[904px] border-[#ff1654] bg-[#282828] p-0 text-white sm:rounded-[8px]">
          <div className="px-[52px] pb-8 pt-7">
            <DialogHeader>
              <DialogTitle
                className="text-center text-[60px] leading-none text-white"
                style={{ fontFamily: F_HEAD, letterSpacing: 0 }}
              >
                UPLOAD VIDEO
              </DialogTitle>
              <DialogDescription className="sr-only">
                Paste a YouTube URL to preview and publish your highlight.
              </DialogDescription>
            </DialogHeader>

            <label className="mt-8 block text-[22px] text-white" style={{ fontFamily: F_BOLD, letterSpacing: 0 }}>
              YouTube URL:
              <input
                value={youtubeUrl}
                onChange={(event) => setYoutubeUrl(event.target.value)}
                placeholder="https://youtu.be/..."
                className="mt-2 h-[64px] w-full rounded-[10px] border border-[#ff1654] bg-[#141414] px-5 text-[24px] text-white outline-none placeholder:text-white/45"
                style={{ fontFamily: F_REGULAR, letterSpacing: 0, boxShadow: '0 0 0 1px rgba(216,255,22,0.7)' }}
              />
            </label>

            <div className="mt-7 min-h-[242px]">
              {previewStatus === 'loading' ? (
                <div className="grid h-[220px] place-items-center">
                  <Loader2 className="h-8 w-8 animate-spin text-[#ff1654]" />
                </div>
              ) : uploadPreview ? (
                <div className="mx-auto w-[420px] max-w-full">
                  <HighlightPreview
                    preview={uploadPreview}
                    title={truncateHighlightTitle(uploadPreview.title)}
                    profileInitial={profileInitial}
                  />
                </div>
              ) : (
                <div className="grid h-[220px] place-items-center border-y border-white/30 text-center">
                  <p className="text-[18px] text-white/45" style={{ fontFamily: F_REGULAR, letterSpacing: 0 }}>
                    {previewStatus === 'invalid' ? 'Paste a valid YouTube link.' : 'Paste a YouTube link to create the preview.'}
                  </p>
                </div>
              )}
            </div>

            <div className="mx-auto mt-4 h-px w-[590px] max-w-full bg-white/80" />

            <button
              type="button"
              onClick={() => void handlePublish()}
              disabled={!uploadPreview || publishing}
              className="mx-auto mt-4 flex h-[68px] w-[360px] max-w-full items-center justify-center rounded-[12px] bg-[#ff1654] text-[40px] text-white disabled:cursor-not-allowed disabled:opacity-45"
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
      <span className="whitespace-nowrap">{label}</span>
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

function RankingTitle({ children, wide = false }: { children: string; wide?: boolean }) {
  const [titlePrefix, titleSuffix] = children.split(' - ');

  return (
    <div className="relative z-[2] max-w-full">
      <img
        src="/highlights/title-triangles.svg"
        alt=""
        aria-hidden="true"
        className="absolute -left-[49px] -top-[58px] h-[136px] w-[91px] xl:-left-[71px] xl:-top-[77px] xl:h-[186px] xl:w-[124px]"
      />
      <h1
        className="relative m-0 max-w-full text-[36px] leading-[43px] text-white sm:text-[56px] sm:leading-[66px] xl:whitespace-nowrap xl:text-[80px] xl:leading-[95px]"
        style={{ fontFamily: F_HEAD, letterSpacing: 0 }}
      >
        {titleSuffix ? (
          <>
            <span className="block xl:inline">{titlePrefix} -</span>{' '}
            <span className="block xl:inline">{titleSuffix}</span>
          </>
        ) : (
          children
        )}
      </h1>
      <img
        src="/highlights/title-underline.svg"
        alt=""
        aria-hidden="true"
        className={`mt-[-7px] h-[12px] max-w-full xl:mt-[-10px] xl:h-[16px] ${wide ? 'w-full xl:w-[1188px]' : 'w-[min(100%,620px)] xl:w-[620px]'}`}
      />
    </div>
  );
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
  const title = isWeek ? 'HIGHLIGHTS - TOP WEEK' : 'HIGHLIGHTS - TOP MONTH';
  const nomineesTitle = isWeek ? 'THIS WEEK NOMINEES' : 'THIS MONTH NOMINEES';
  const heroCopy = isWeek ? 'Winner of the week\nearns EXTRA coins!*' : 'Winner of the month\ngets a FREE montage!*';
  const note = isWeek
    ? '*The winner of the week will receive 5 coins for free!'
    : '*The winner will choose the editor he likes the most.\nOLEBOY will pay for the video. No extra-fees.';
  const bottomCta = isWeek ? 'BEST OF THE MONTH' : 'FOR YOU';
  const winner = highlights[0] ?? null;
  const nominees = highlights.slice(0, 4);

  return (
    <div className="w-full bg-[#0f0404] text-white">
      <section className="relative overflow-hidden px-5 pb-20 pt-[172px] xl:min-h-[2529px] xl:px-0 xl:pb-0 xl:pt-0">
        <img
          src="/figma-assets/figma-neon.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 h-[146px] w-full object-cover"
        />

        <div className="relative xl:absolute xl:left-[calc(12%_+_5.6px)] xl:top-[233px]">
          <RankingTitle wide>{title}</RankingTitle>
        </div>
        <div className="relative mt-9 xl:absolute xl:left-[calc(12%_+_5.6px)] xl:top-[396px] xl:mt-0 xl:w-[calc(88%_-_11.2px)]">
          <HighlightsToolbar
            activeTab={mode}
            query={query}
            onQueryChange={onQueryChange}
            onUploadClick={onUploadClick}
            withBottomMargin={false}
          />
        </div>

        <img
          src="/highlights/star-shape.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -left-[98px] top-[560px] h-[430px] w-[625px] -rotate-[15deg] object-contain opacity-90 xl:left-[calc(8%_+_14.4px)] xl:top-[383px] xl:h-[596px] xl:w-[866px]"
        />
        <p
          className="relative z-[2] mt-20 max-w-[350px] whitespace-pre-line text-[34px] leading-[36px] text-white sm:max-w-[520px] sm:text-[42px] sm:leading-[43px] xl:absolute xl:left-[calc(12%_+_11.6px)] xl:top-[598px] xl:mt-0 xl:max-w-none xl:text-[48px] xl:leading-[47px]"
          style={{ fontFamily: F_BOLD, letterSpacing: 0 }}
        >
          {heroCopy}
        </p>
        <button
          type="button"
          onClick={() => document.getElementById('highlight-nominees')?.scrollIntoView({ behavior: 'smooth' })}
          className="relative z-[2] mt-8 flex h-[58px] w-full max-w-[292px] items-center justify-center gap-[14px] rounded-full border border-[#ff1654] bg-[#ff1654]/25 text-[28px] text-white shadow-[inset_0_4px_4px_rgba(255,255,255,0.14),inset_0_-4px_4px_rgba(0,0,0,0.25)] xl:absolute xl:left-[calc(24%_+_7.2px)] xl:top-[727px] xl:mt-0 xl:h-[65px] xl:w-[292px] xl:max-w-none xl:text-[32px]"
          style={{ fontFamily: "'Base_Neue_Trial:Wide_Black', 'Base Neue Trial', sans-serif", letterSpacing: 0 }}
        >
          NOMINEES
          <img src="/highlights/arrow-down.svg" alt="" aria-hidden="true" className="h-[27px] w-[19px]" />
        </button>
        <p
          className="relative z-[2] mt-10 max-w-[330px] whitespace-pre-line text-[12px] leading-[15px] text-white sm:max-w-[470px] sm:text-[13px] sm:leading-[16px] xl:absolute xl:left-[calc(4%_+_1.2px)] xl:top-[855px] xl:mt-0 xl:max-w-none"
          style={{ fontFamily: "'Base_Neue_Trial:Expanded', 'Base Neue Trial', sans-serif", letterSpacing: 0 }}
        >
          {note}
        </p>

        <div className="relative z-[2] mt-12 xl:absolute xl:right-[calc(12%_-_6px)] xl:top-[496px] xl:mt-0">
          {loading ? (
            <div className="grid h-[299px] w-[min(100%,531px)] place-items-center rounded-[11px] bg-[#181818] xl:w-[531px]">
              <Loader2 className="h-8 w-8 animate-spin text-[#ff1654]" />
            </div>
          ) : winner ? (
            <HighlightCardView
              highlight={winner}
              totalVotes={getTotalVotes(winner, voteCounts)}
              voteState={getVoteState(winner.id)}
              isVoting={isVoting}
              onOpen={() => onOpen(winner)}
              onVote={() => onVote(winner.id)}
              size="large"
            />
          ) : null}
        </div>

        <div id="highlight-nominees" className="relative mt-24 w-full bg-[#0f0404] xl:absolute xl:left-0 xl:top-[955px] xl:mt-0 xl:h-[955px]">
          <div className="relative xl:absolute xl:left-[calc(12%_+_5.6px)] xl:top-[233px]">
            <RankingTitle wide>{nomineesTitle}</RankingTitle>
          </div>

          {loading ? (
            <div className="grid h-[360px] place-items-center xl:absolute xl:left-[348px] xl:top-[452px] xl:w-[1258px]">
              <Loader2 className="h-8 w-8 animate-spin text-[#ff1654]" />
            </div>
          ) : nominees.length > 0 ? (
            <div className="relative mt-12 grid grid-cols-1 justify-items-center gap-y-14 lg:grid-cols-2 lg:gap-x-10 xl:absolute xl:left-1/2 xl:top-[452px] xl:mt-0 xl:grid-cols-2 xl:justify-items-start xl:gap-x-[196px] xl:gap-y-[92px] xl:-translate-x-1/2">
              {nominees.map((highlight, index) => (
                <HighlightCardView
                  key={highlight.id}
                  highlight={highlight}
                  totalVotes={getTotalVotes(highlight, voteCounts)}
                  voteState={getVoteState(highlight.id)}
                  isVoting={isVoting}
                  onOpen={() => onOpen(highlight)}
                  onVote={() => onVote(highlight.id)}
                  size="large"
                  rank={index + 1}
                />
              ))}
            </div>
          ) : (
            <p
              className="relative mt-12 text-[22px] text-white/60 xl:absolute xl:left-[348px] xl:top-[452px] xl:mt-0 xl:text-[24px]"
              style={{ fontFamily: F_BOLD, letterSpacing: 0 }}
            >
              No highlights found.
            </p>
          )}
        </div>

        <Link
          to={isWeek ? '/highlights/month' : '/highlights'}
          className="relative z-[2] mx-auto mt-16 flex h-[58px] items-center justify-center gap-[14px] rounded-full border border-[#ff1654] bg-[#ff1654]/25 px-[28px] text-[22px] text-white no-underline shadow-[inset_0_4px_4px_rgba(255,255,255,0.14),inset_0_-4px_4px_rgba(0,0,0,0.25)] xl:absolute xl:left-1/2 xl:top-[2416px] xl:mt-0 xl:h-[65px] xl:-translate-x-1/2 xl:px-[33px] xl:text-[24px]"
          style={{ minWidth: isWeek ? 337 : 201, fontFamily: "'Base_Neue_Trial:Bold', 'Base Neue Trial', sans-serif", letterSpacing: 0 }}
        >
          {bottomCta}
          <img src="/highlights/arrow-right.svg" alt="" aria-hidden="true" className="h-[16px] w-[21px]" />
        </Link>
      </section>
      <FooterSection />
    </div>
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
    <article className={`relative w-full ${isLarge ? 'max-w-[531px]' : 'max-w-[400px]'}`}>
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
          disabled={isVoting}
          aria-label={`${votedThis ? 'Remove vote from' : 'Vote for'} ${highlight.title}`}
          className={`mt-2 flex shrink-0 items-center justify-center gap-2 rounded-full border text-white disabled:opacity-65 ${isLarge ? 'h-[39px] w-[118px] text-[19.5px]' : 'h-[32px] w-[97px] text-[16px]'} ${
            votedThis ? 'border-[#ff1654] bg-[#ff1654]/50' : 'border-[#ff1654] bg-[#282828]'
          }`}
          style={{ fontFamily: F_BOLD, letterSpacing: 0 }}
        >
          <img
            src={votedThis ? '/highlights/like-hot.svg' : '/highlights/like-muted.svg'}
            alt=""
            aria-hidden="true"
            className={isLarge ? 'h-[19px] w-[22px]' : 'h-4 w-[18px]'}
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
      <div className="relative h-[170px] overflow-hidden rounded-[11px] bg-[#181818]">
        <img src={preview.thumbnailUrl} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="mt-3 grid grid-cols-[48px_minmax(0,1fr)_97px] gap-3">
        <AvatarCircle src={preview.authorAvatarUrl} label={preview.authorName} size={48} fallback={profileInitial} />
        <div className="min-w-0">
          <p className="truncate text-[24px] leading-[24px] text-white" style={{ fontFamily: F_BOLD, letterSpacing: 0 }}>
            {title}
          </p>
          <p className="mt-1 truncate text-[14px] text-white/50" style={{ fontFamily: F_REGULAR, letterSpacing: 0 }}>
            {preview.authorName}
          </p>
        </div>
        <div
          className="mt-2 flex h-[32px] w-[97px] shrink-0 items-center justify-center gap-2 rounded-full border border-[#ff1654] bg-[#282828] text-[16px] text-white"
          style={{ fontFamily: F_BOLD, letterSpacing: 0 }}
        >
          <img src="/highlights/like-muted.svg" alt="" aria-hidden="true" className="h-4 w-[18px]" />
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
}: {
  src: string | null;
  label: string;
  size: number;
  fallback?: string;
}) {
  const initial = fallback || label.trim().charAt(0).toUpperCase() || 'P';

  return (
    <div
      className="overflow-hidden rounded-full border border-white/10 bg-[#ff1654]/25"
      style={{ width: size, height: size }}
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

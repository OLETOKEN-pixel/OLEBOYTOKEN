import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ExternalLink, Info, Loader2, Plus, Search, ThumbsUp, Trophy } from 'lucide-react';
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

const CURATED_HIGHLIGHTS: HighlightCard[] = [
  {
    id: '00000000-0000-4000-8000-000000000102',
    youtubeUrl: 'https://youtu.be/HxRTrHyWB0Y?si=VdsoQIswI9eOlHG5',
    youtubeVideoId: 'HxRTrHyWB0Y',
    title: 'IL MIGLIOR HIGHLIGHTS...',
    authorName: 'Piz',
    authorAvatarUrl: null,
    thumbnailUrl: '/showreel/highlight-video-1.png',
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
    authorAvatarUrl: null,
    thumbnailUrl: getYouTubeThumbnailUrl('CtK-fV6TsBY'),
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
    authorAvatarUrl: null,
    thumbnailUrl: getYouTubeThumbnailUrl('K5MZeXFPsGc'),
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
    authorAvatarUrl: null,
    thumbnailUrl: getYouTubeThumbnailUrl('4xv3O_VrW0M'),
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
    authorAvatarUrl: null,
    thumbnailUrl: getYouTubeThumbnailUrl('CtK-fV6TsBY'),
    baseVoteCount: 802,
    isCurated: true,
    sortOrder: 60,
    createdAt: null,
  },
];

function normalizeHighlight(row: HighlightRow): HighlightCard {
  return {
    id: row.id,
    youtubeUrl: row.youtube_url,
    youtubeVideoId: row.youtube_video_id,
    title: row.title,
    authorName: row.author_name || 'Player',
    authorAvatarUrl: row.author_avatar_url,
    thumbnailUrl: row.thumbnail_url || getYouTubeThumbnailUrl(row.youtube_video_id),
    baseVoteCount: row.base_vote_count ?? 0,
    isCurated: Boolean(row.is_curated),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
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

export default function Highlights() {
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
    setHighlights(rows.length > 0 ? rows.sort(sortHighlights) : CURATED_HIGHLIGHTS);
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

          <div className="mb-[54px] flex flex-wrap items-center gap-6">
            <label className="relative block h-[47px] w-[400px] max-w-full">
              <span className="sr-only">Search by title or author</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by title or author"
                className="h-full w-full rounded-[12px] border border-white/[0.15] bg-[#282828] pl-4 pr-12 text-[20px] text-white outline-none placeholder:text-white/50"
                style={{ fontFamily: F_REGULAR, letterSpacing: 0 }}
              />
              <Search aria-hidden="true" className="absolute right-4 top-1/2 h-[22px] w-[22px] -translate-y-1/2 text-white/50" />
            </label>

            <ToolbarButton label="REWARDS" tone="gray" icon={<Info aria-hidden="true" className="h-4 w-4" />} />
            <ToolbarButton label="TOP MONTH" tone="lime" icon={<Trophy aria-hidden="true" className="h-[19px] w-[23px]" />} />
            <ToolbarButton label="TOP WEEK" tone="purple" icon={<Trophy aria-hidden="true" className="h-[19px] w-[23px]" />} />
            <ToolbarButton label="UPLOAD" tone="pink" icon={<Plus aria-hidden="true" className="h-5 w-5" />} onClick={handleUploadClick} />
          </div>

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
                  totalVotes={highlight.baseVoteCount + (voteCounts[highlight.id] || 0)}
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
}: {
  label: string;
  tone: 'gray' | 'lime' | 'purple' | 'pink';
  icon: ReactNode;
  onClick?: () => void;
}) {
  const styles = {
    gray: 'border-white/50 bg-[#282828]/80 text-white min-w-[211px]',
    lime: 'border-[#d8ff16] bg-[#d8ff16]/20 text-white min-w-[250px]',
    purple: 'border-[#625afa] bg-[#625afa]/20 text-white min-w-[230px]',
    pink: 'border-[#ff1654] bg-[#ff1654]/20 text-white min-w-[182px]',
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-[47px] shrink-0 flex-nowrap items-center justify-center gap-3 rounded-[16px] border px-4 text-[24px] leading-none ${styles}`}
      style={{ fontFamily: F_BOLD, letterSpacing: 0, whiteSpace: 'nowrap' }}
    >
      {icon}
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

function HighlightCardView({
  highlight,
  totalVotes,
  voteState,
  isVoting,
  onOpen,
  onVote,
}: {
  highlight: HighlightCard;
  totalVotes: number;
  voteState: VoteState;
  isVoting: boolean;
  onOpen: () => void;
  onVote: () => void;
}) {
  const votedThis = voteState === 'VOTED_THIS';

  return (
    <article className="relative w-full max-w-[400px]">
      <button
        type="button"
        onClick={onOpen}
        className="group relative block h-[225px] w-full overflow-hidden rounded-[11px] bg-[#181818] text-left"
        aria-label={`Play ${highlight.title}`}
      >
        <img
          src={highlight.thumbnailUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 rounded-[11px] bg-black/0 transition group-hover:bg-black/15" />
      </button>

      <div className="mt-4 grid grid-cols-[48px_minmax(0,1fr)_97px] gap-4">
        <AvatarCircle
          src={highlight.authorAvatarUrl}
          label={highlight.authorName}
          size={48}
        />
        <div className="min-w-0">
          <p
            className="line-clamp-2 text-[24px] leading-[26px] text-white"
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
          className={`mt-2 flex h-[32px] w-[97px] shrink-0 items-center justify-center gap-2 rounded-full border text-[16px] text-white disabled:opacity-65 ${
            votedThis ? 'border-[#ff1654] bg-[#ff1654]/50' : 'border-[#ff1654] bg-[#282828]'
          }`}
          style={{ fontFamily: F_BOLD, letterSpacing: 0 }}
        >
          <ThumbsUp className="h-4 w-4" />
          <span>{formatVoteCount(totalVotes)}</span>
        </button>
      </div>
    </article>
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
          <ThumbsUp className="h-4 w-4" />
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

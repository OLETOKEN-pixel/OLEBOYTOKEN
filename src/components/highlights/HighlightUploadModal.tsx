import { FormEvent, useEffect, useMemo, useState } from 'react';
import { extractYouTubeVideoId, getYouTubeThumbnailUrl } from './highlightHelpers';
import { FIGMA_WINNER } from './highlightFixtures';
import { HighlightCard } from './HighlightCard';
import type { HighlightCardData } from './types';

const FONT_EXPANDED_BOLD =
  "'Base_Neue_Trial:Expanded_Bold', 'Base Neue Trial-ExpandedBold', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED_BLACK =
  "'Base_Neue_Trial:Expanded_Black_Oblique', 'Base Neue Trial-ExpandedBlack Oblique', 'Base Neue Trial', sans-serif";
const FONT_REGULAR = "'Base_Neue_Trial:Regular', 'Base Neue Trial-Regular', 'Base Neue Trial', sans-serif";

interface HighlightUploadModalProps {
  open: boolean;
  isPublishing: boolean;
  onClose: () => void;
  onSubmit: (youtubeUrl: string, videoId: string) => Promise<void>;
}

export function HighlightUploadModal({ open, isPublishing, onClose, onSubmit }: HighlightUploadModalProps) {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const videoId = extractYouTubeVideoId(youtubeUrl);

  useEffect(() => {
    if (!open) {
      setYoutubeUrl('');
      setError(null);
    }
  }, [open]);

  const previewItem = useMemo<HighlightCardData>(() => {
    if (!videoId) {
      return FIGMA_WINNER;
    }

    return {
      id: `preview-${videoId}`,
      title: `Highlight ${videoId}`,
      author: 'You',
      authorAvatarSrc: FIGMA_WINNER.authorAvatarSrc,
      thumbnailSrc: getYouTubeThumbnailUrl(videoId),
      href: youtubeUrl,
      likeCount: 0,
    };
  }, [videoId, youtubeUrl]);

  if (!open) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!videoId) {
      setError('Paste a valid YouTube URL.');
      return;
    }

    setError(null);
    await onSubmit(youtubeUrl.trim(), videoId);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/70 px-4 pt-[54px] backdrop-blur-[2px]">
      <button type="button" aria-label="Close upload video" className="absolute inset-0 cursor-default" onClick={onClose} />

      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="highlight-upload-title"
        onSubmit={handleSubmit}
        className="relative z-[1] min-h-[390px] w-full max-w-[903px] rounded-[8px] border border-[#ff1654]/80 bg-[linear-gradient(180deg,rgba(44,44,44,0.98)_0%,rgba(30,30,30,0.98)_100%)] px-[53px] pb-8 pt-6 shadow-[0_30px_120px_rgba(0,0,0,0.75)]"
      >
        <h1
          id="highlight-upload-title"
          className="text-center text-[56px] leading-[67px] text-white"
          style={{ fontFamily: FONT_EXPANDED_BLACK }}
        >
          UPLOAD VIDEO
        </h1>

        <label
          htmlFor="highlight-youtube-url"
          className="mt-8 block text-[20px] leading-[24px] text-white"
          style={{ fontFamily: FONT_REGULAR }}
        >
          YouTube URL:
        </label>
        <input
          id="highlight-youtube-url"
          value={youtubeUrl}
          onChange={(event) => setYoutubeUrl(event.target.value)}
          className="mt-2 h-[59px] w-full rounded-[12px] border border-white/10 bg-[#181818] px-5 text-[20px] text-white outline-none transition focus:border-[#ff1654]"
          style={{ fontFamily: FONT_REGULAR }}
          placeholder="https://youtu.be/..."
          autoFocus
        />

        <div className="mx-auto mt-8 flex w-fit justify-center">
          <HighlightCard item={previewItem} size="modal" />
        </div>

        <div className="mx-auto mt-4 h-px w-[589px] max-w-full bg-white" />

        {error ? (
          <p className="mt-3 text-center text-[14px] text-[#ff8ead]" style={{ fontFamily: FONT_REGULAR }}>
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isPublishing}
          className="mx-auto mt-4 block h-[69px] w-[361px] max-w-full rounded-[14px] bg-[#ff1654] text-center text-[36px] leading-[43px] text-white shadow-[inset_0_4px_4px_rgba(255,255,255,0.14),inset_0_-4px_4px_rgba(0,0,0,0.25)] transition hover:bg-[#ff2d67] disabled:opacity-65"
          style={{ fontFamily: FONT_EXPANDED_BOLD }}
        >
          {isPublishing ? 'PUBLISHING' : 'PUBLISH'}
        </button>
      </form>
    </div>
  );
}

export const YOUTUBE_VIDEO_ID_LENGTH = 11;

export function extractYouTubeVideoId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) {
    return value;
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^www\./, '').toLowerCase();

    if (hostname === 'youtu.be') {
      return normalizeYouTubeId(url.pathname.split('/').filter(Boolean)[0]);
    }

    if (hostname === 'youtube.com' || hostname.endsWith('.youtube.com')) {
      const watchId = url.searchParams.get('v');
      if (watchId) return normalizeYouTubeId(watchId);

      const [kind, id] = url.pathname.split('/').filter(Boolean);
      if (kind === 'shorts' || kind === 'embed' || kind === 'live') {
        return normalizeYouTubeId(id);
      }
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeYouTubeId(value?: string | null): string | null {
  if (!value) return null;
  const clean = value.match(/[a-zA-Z0-9_-]{11}/)?.[0] ?? '';
  return clean.length === YOUTUBE_VIDEO_ID_LENGTH ? clean : null;
}

export function truncateHighlightTitle(title: string, maxLength = 28): string {
  const clean = title.trim().replace(/\s+/g, ' ');
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength).trimEnd()}...`;
}

export function formatVoteCount(count: number): string {
  const safeCount = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));
  if (safeCount < 1000) return String(safeCount);

  const value = safeCount / 1000;
  if (Number.isInteger(value)) return `${value}k`;

  return `${value.toFixed(1).replace('.', ',')}k`;
}

export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

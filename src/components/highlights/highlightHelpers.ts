const YOUTUBE_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

export function extractYouTubeVideoId(value: string): string | null {
  const input = value.trim();

  if (YOUTUBE_ID_PATTERN.test(input)) {
    return input;
  }

  try {
    const url = new URL(input);
    const hostname = url.hostname.replace(/^www\./, '');

    if (hostname === 'youtu.be') {
      const videoId = url.pathname.split('/').filter(Boolean)[0];
      return videoId && YOUTUBE_ID_PATTERN.test(videoId) ? videoId : null;
    }

    if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
      const directVideoId = url.searchParams.get('v');
      if (directVideoId && YOUTUBE_ID_PATTERN.test(directVideoId)) {
        return directVideoId;
      }

      const [, videoId] = url.pathname.match(/^\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{11})/) ?? [];
      return videoId ?? null;
    }
  } catch {
    return null;
  }

  return null;
}

export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

export function formatCompactLikeCount(count: number): string {
  if (count >= 1000) {
    const compact = count / 1000;
    const rounded = Number.isInteger(compact) ? compact.toFixed(0) : compact.toFixed(1);
    return `${rounded.replace('.', ',')}k`;
  }

  return String(count);
}

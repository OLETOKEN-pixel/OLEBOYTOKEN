const DEFAULT_TWITCH_PARENTS = [
  'localhost',
  '127.0.0.1',
  'oleboytoken.com',
  'www.oleboytoken.com',
] as const;

function normalizeHostname(hostname: string | null | undefined) {
  return String(hostname ?? '').trim().toLowerCase();
}

export function getTwitchEmbedParents() {
  const hostname =
    typeof window !== 'undefined' ? normalizeHostname(window.location.hostname) : '';

  const parents = new Set<string>(DEFAULT_TWITCH_PARENTS);

  if (hostname) {
    parents.add(hostname);
    if (hostname === '0.0.0.0') {
      parents.add('localhost');
    }
  }

  return Array.from(parents);
}

function appendParents(params: URLSearchParams) {
  for (const parent of getTwitchEmbedParents()) {
    params.append('parent', parent);
  }
}

export function buildTwitchPlayerUrl(channel: string) {
  const params = new URLSearchParams({
    channel,
    autoplay: 'false',
    muted: 'true',
  });
  appendParents(params);
  return `https://player.twitch.tv/?${params.toString()}`;
}

export function buildTwitchChatUrl(channel: string) {
  const params = new URLSearchParams({
    darkpopout: 'true',
  });
  appendParents(params);
  return `https://www.twitch.tv/embed/${encodeURIComponent(channel)}/chat?${params.toString()}`;
}

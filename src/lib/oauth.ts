import { supabase } from '@/integrations/supabase/client';

export const CANONICAL_APP_ORIGIN = 'https://www.oleboytoken.com';

const CANONICAL_HOSTNAME = new URL(CANONICAL_APP_ORIGIN).hostname;
const LEGACY_HOSTNAMES = new Set([
  'oleboytoken.com',
  'oleboystoken.vercel.app',
]);

type LocationLike = Pick<Location, 'hostname' | 'pathname' | 'search' | 'hash'>;

function readStoredRedirect() {
  try {
    return localStorage.getItem('auth_redirect');
  } catch {
    return null;
  }
}

function writeStoredRedirect(value: string | null) {
  try {
    if (value === null) {
      localStorage.removeItem('auth_redirect');
      return;
    }

    localStorage.setItem('auth_redirect', value);
  } catch {
    // Ignore storage failures and continue with the auth flow.
  }
}

export function getCurrentPathWithQueryAndHash(locationLike: LocationLike = window.location) {
  const nextPath = `${locationLike.pathname}${locationLike.search}${locationLike.hash}`;
  return nextPath || '/';
}

export function getCanonicalRedirectUrl(locationLike: LocationLike = window.location) {
  const { hostname, pathname, search, hash } = locationLike;

  if (
    !hostname ||
    hostname === CANONICAL_HOSTNAME ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.local')
  ) {
    return null;
  }

  if (!LEGACY_HOSTNAMES.has(hostname) && !hostname.endsWith('.vercel.app')) {
    return null;
  }

  return `${CANONICAL_APP_ORIGIN}${pathname}${search}${hash}`;
}

export async function startDiscordAuth(redirectAfter = '/') {
  const previousRedirect = readStoredRedirect();
  writeStoredRedirect(redirectAfter);

  try {
    const { data, error } = await supabase.functions.invoke('discord-auth-start', {
      body: { redirectAfter },
    });

    if (error || !data?.authUrl) {
      throw new Error(error?.message || 'Failed to start Discord auth');
    }

    window.location.assign(data.authUrl);
  } catch (error) {
    writeStoredRedirect(previousRedirect);
    throw error;
  }
}

export async function startEpicAuth() {
  const { data, error } = await supabase.functions.invoke('epic-auth-start');

  if (error || !data?.authUrl) {
    throw new Error(error?.message || 'Failed to start Epic auth');
  }

  window.location.assign(data.authUrl);
}

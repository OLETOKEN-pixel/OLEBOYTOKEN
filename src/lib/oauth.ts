import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export const CANONICAL_APP_ORIGIN = 'https://www.oleboytoken.com';

const CANONICAL_HOSTNAME = new URL(CANONICAL_APP_ORIGIN).hostname;
const LEGACY_HOSTNAMES = new Set([
  'oleboytoken.com',
  'oleboystoken.vercel.app',
]);

type LocationLike = Pick<Location, 'hostname' | 'pathname' | 'search' | 'hash'>;

export interface FunctionErrorInfo {
  message: string;
  details: string | null;
  code: string | null;
  requestId: string | null;
}

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

export async function extractFunctionErrorInfo(error: unknown, fallbackMessage: string): Promise<FunctionErrorInfo> {
  if (error instanceof FunctionsHttpError) {
    try {
      const errorPayload = await error.context.json();
      const message =
        (typeof errorPayload?.error === 'string' && errorPayload.error.trim()) ||
        (typeof errorPayload?.message === 'string' && errorPayload.message.trim()) ||
        fallbackMessage;

      return {
        message,
        details: typeof errorPayload?.details === 'string' && errorPayload.details.trim() ? errorPayload.details : null,
        code: typeof errorPayload?.code === 'string' && errorPayload.code.trim() ? errorPayload.code : null,
        requestId:
          (typeof errorPayload?.stripeRequestId === 'string' && errorPayload.stripeRequestId.trim()) ||
          (typeof errorPayload?.paypalDebugId === 'string' && errorPayload.paypalDebugId.trim()) ||
          (typeof errorPayload?.debugId === 'string' && errorPayload.debugId.trim()) ||
          (typeof errorPayload?.requestId === 'string' && errorPayload.requestId.trim()) ||
          null,
      };
    } catch {
      return {
        message: fallbackMessage,
        details: null,
        code: null,
        requestId: null,
      };
    }
  }

  if (error instanceof FunctionsRelayError || error instanceof FunctionsFetchError) {
    return {
      message: error.message || fallbackMessage,
      details: null,
      code: null,
      requestId: null,
    };
  }

  if (error instanceof Error && error.message) {
    return {
      message: error.message,
      details: null,
      code: null,
      requestId: null,
    };
  }

  return {
    message: fallbackMessage,
    details: null,
    code: null,
    requestId: null,
  };
}

export async function extractFunctionErrorMessage(error: unknown, fallbackMessage: string) {
  const info = await extractFunctionErrorInfo(error, fallbackMessage);
  return info.message;
}

export async function startDiscordAuth(redirectAfter = '/') {
  const previousRedirect = readStoredRedirect();
  writeStoredRedirect(redirectAfter);

  try {
    const { data, error } = await supabase.functions.invoke('discord-auth-start', {
      body: { redirectAfter },
    });

    if (error) {
      throw error;
    }

    if (!data?.authUrl) {
      throw new Error('Failed to start Discord auth');
    }

    window.location.assign(data.authUrl);
  } catch (error) {
    writeStoredRedirect(previousRedirect);
    throw new Error(await extractFunctionErrorMessage(error, 'Failed to start Discord auth'));
  }
}

export async function startEpicAuth() {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.access_token) {
      throw new Error('You must be logged in to connect Epic Games');
    }

    const { data, error } = await supabase.functions.invoke('epic-auth-start', {
      body: {},
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
    });

    if (error) {
      throw error;
    }

    if (!data?.authUrl) {
      throw new Error('Failed to start Epic auth');
    }

    window.location.assign(data.authUrl);
  } catch (error) {
    throw new Error(await extractFunctionErrorMessage(error, 'Failed to start Epic auth'));
  }
}

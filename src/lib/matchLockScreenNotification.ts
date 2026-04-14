import { getOleboyServiceWorkerRegistration } from '@/lib/pwa';

export type MatchLockScreenNotificationStatus = 'shown' | 'denied' | 'unsupported' | 'requires_pwa';

type MatchNotificationReadiness = 'ready' | Exclude<MatchLockScreenNotificationStatus, 'shown'>;

export interface MatchLockScreenNotificationInput {
  matchId: string;
  mode: string;
  teamSize: number;
  entryFeeCoins: number;
  winCoins: number;
}

export interface BuiltMatchLockScreenNotification {
  title: string;
  options: NotificationOptions;
}

function formatCoins(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00';
}

function getTeamSizeTag(teamSize: number) {
  const normalizedSize = Number.isFinite(teamSize) ? Math.max(1, Math.floor(teamSize)) : 1;
  return `${normalizedSize}V${normalizedSize}`;
}

function getModeTag(mode: string) {
  const normalizedMode = mode.trim().toUpperCase();
  return normalizedMode || 'MATCH';
}

function getNotificationApi(): typeof Notification | null {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }

  return window.Notification;
}

function isIosDevice() {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const platform = navigator.platform || '';
  const userAgent = navigator.userAgent || '';
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  return /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
}

function isRunningAsStandalonePwa() {
  if (typeof window === 'undefined') {
    return false;
  }

  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };

  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    navigatorWithStandalone.standalone === true
  );
}

function requiresInstalledPwaForNotifications() {
  return isIosDevice() && !isRunningAsStandalonePwa();
}

function isNotificationEnvironmentSupported() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  if (!getNotificationApi() || !('serviceWorker' in navigator)) {
    return false;
  }

  if ('isSecureContext' in window && !window.isSecureContext) {
    return false;
  }

  return true;
}

function requestPermission(notificationApi: typeof Notification): Promise<NotificationPermission> {
  return new Promise((resolve) => {
    const maybePromise = notificationApi.requestPermission(resolve);

    if (maybePromise && typeof maybePromise.then === 'function') {
      maybePromise.then(resolve).catch(() => resolve('denied'));
    }
  });
}

export async function prepareMatchLockScreenNotificationPermission(): Promise<MatchNotificationReadiness> {
  if (!isNotificationEnvironmentSupported()) {
    return 'unsupported';
  }

  if (requiresInstalledPwaForNotifications()) {
    return 'requires_pwa';
  }

  const notificationApi = getNotificationApi();

  if (!notificationApi) {
    return 'unsupported';
  }

  if (notificationApi.permission === 'granted') {
    return 'ready';
  }

  if (notificationApi.permission === 'denied') {
    return 'denied';
  }

  const permission = await requestPermission(notificationApi);
  return permission === 'granted' ? 'ready' : 'denied';
}

export function buildMatchLockScreenNotification(
  input: MatchLockScreenNotificationInput,
): BuiltMatchLockScreenNotification {
  const title = `${getTeamSizeTag(input.teamSize)} ${getModeTag(input.mode)}`;
  const body = `ENTRY ${formatCoins(input.entryFeeCoins)} COINS · WIN ${formatCoins(input.winCoins)} COINS`;
  const url = `/matches/${input.matchId}`;

  return {
    title,
    options: {
      body,
      icon: '/favicon-oleboy.png',
      badge: '/favicon-oleboy.png',
      tag: `oleboy-match-${input.matchId}`,
      data: {
        matchId: input.matchId,
        url,
      },
      requireInteraction: true,
    },
  };
}

export async function showMatchLockScreenNotification(
  input: MatchLockScreenNotificationInput,
  readinessPromise?: Promise<MatchNotificationReadiness>,
): Promise<MatchLockScreenNotificationStatus> {
  try {
    const readiness = await (readinessPromise ?? prepareMatchLockScreenNotificationPermission());

    if (readiness !== 'ready') {
      return readiness;
    }

    const registration = await getOleboyServiceWorkerRegistration();

    if (!registration || typeof registration.showNotification !== 'function') {
      return 'unsupported';
    }

    const notification = buildMatchLockScreenNotification(input);
    await registration.showNotification(notification.title, notification.options);

    return 'shown';
  } catch (error) {
    console.warn('Unable to show match lock screen notification:', error);
    return 'unsupported';
  }
}

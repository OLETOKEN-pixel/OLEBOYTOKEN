const SERVICE_WORKER_PATH = '/sw.js';
const SERVICE_WORKER_SCOPE = '/';

function canUseServiceWorker() {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof navigator.serviceWorker.register === 'function'
  );
}

export async function getOleboyServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!canUseServiceWorker()) {
    return null;
  }

  const existingRegistration =
    typeof navigator.serviceWorker.getRegistration === 'function'
      ? await navigator.serviceWorker.getRegistration(SERVICE_WORKER_SCOPE)
      : null;

  if (existingRegistration) {
    return existingRegistration;
  }

  return navigator.serviceWorker.register(SERVICE_WORKER_PATH, {
    scope: SERVICE_WORKER_SCOPE,
  });
}

export function registerOleboyServiceWorker() {
  if (!canUseServiceWorker()) {
    return;
  }

  const register = () => {
    void getOleboyServiceWorkerRegistration().catch((error) => {
      console.warn('OleBoy service worker registration failed:', error);
    });
  };

  if (document.readyState === 'complete') {
    register();
    return;
  }

  window.addEventListener('load', register, { once: true });
}

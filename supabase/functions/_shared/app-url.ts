const DEFAULT_CANONICAL_APP_URL = "https://www.oleboytoken.com";
const LEGACY_APP_HOSTS = new Set([
  "oleboytoken.com",
  "oleboystoken.vercel.app",
]);

function getConfiguredCanonicalOrigin() {
  const configuredUrl = Deno.env.get("APP_CANONICAL_URL") || DEFAULT_CANONICAL_APP_URL;

  try {
    return new URL(configuredUrl).origin;
  } catch {
    return DEFAULT_CANONICAL_APP_URL;
  }
}

export function getCanonicalAuthRedirect(pathname: string, envKey?: string) {
  const canonicalRedirect = new URL(pathname, getConfiguredCanonicalOrigin());
  const configuredRedirect = envKey ? Deno.env.get(envKey) : null;

  if (!configuredRedirect) {
    return canonicalRedirect.toString();
  }

  try {
    const parsedConfigured = new URL(configuredRedirect);

    if (
      parsedConfigured.origin === canonicalRedirect.origin &&
      parsedConfigured.pathname === canonicalRedirect.pathname
    ) {
      return parsedConfigured.toString();
    }
  } catch {
    // Fall back to the canonical redirect below.
  }

  return canonicalRedirect.toString();
}

export function resolveRequestOrigin(requestOrigin: string | null) {
  const canonicalOrigin = getConfiguredCanonicalOrigin();

  if (!requestOrigin) {
    return canonicalOrigin;
  }

  try {
    const parsedOrigin = new URL(requestOrigin);
    const parsedCanonical = new URL(canonicalOrigin);

    if (parsedOrigin.origin === parsedCanonical.origin) {
      return parsedCanonical.origin;
    }

    if (
      parsedOrigin.hostname === "localhost" ||
      parsedOrigin.hostname === "127.0.0.1" ||
      parsedOrigin.hostname.endsWith(".local")
    ) {
      return parsedOrigin.origin;
    }

    if (
      LEGACY_APP_HOSTS.has(parsedOrigin.hostname) ||
      parsedOrigin.hostname.endsWith(".vercel.app")
    ) {
      return parsedCanonical.origin;
    }
  } catch {
    // Fall back to the canonical origin below.
  }

  return canonicalOrigin;
}

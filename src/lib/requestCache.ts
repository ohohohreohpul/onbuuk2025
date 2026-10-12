/**
 * Shares one in-flight/recent request between components that need the same
 * data (e.g. ten components reading the booking customization). Entries live
 * for a short time so admin edits still show up on the next visit.
 */
const CACHE_TTL_MS = 60_000;

const entries = new Map<string, { promise: Promise<unknown>; expiresAt: number }>();

export function cachedRequest<T>(key: string, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = entries.get(key);
  if (hit && hit.expiresAt > now) return hit.promise as Promise<T>;

  const promise = load().catch((error: unknown) => {
    entries.delete(key); // never cache failures
    throw error;
  });
  entries.set(key, { promise, expiresAt: now + CACHE_TTL_MS });
  return promise;
}

export function clearRequestCache(): void {
  entries.clear();
}

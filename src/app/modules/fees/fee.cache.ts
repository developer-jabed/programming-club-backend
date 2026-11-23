/**
 * Tiny in-memory TTL cache with:
 *  - in-flight de-duplication (10 identical requests -> 1 DB query)
 *  - prefix invalidation
 *  - generation guard (a query that started before an invalidation never
 *    writes its stale result back)
 *  - size cap (oldest entries evicted first)
 *
 * Single-instance only. If you run several backend instances, swap this
 * file for a Redis-backed version with the same `cached` / `invalidate` API.
 */

type Entry = { value: unknown; expiresAt: number };

const MAX_ENTRIES = 500;
const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
let generation = 0;

export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;

  const running = inflight.get(key);
  if (running) return running as Promise<T>;

  const startedAt = generation;
  const promise = loader()
    .then((value) => {
      if (startedAt === generation) {
        if (store.size >= MAX_ENTRIES) {
          const oldest = store.keys().next().value;
          if (oldest !== undefined) store.delete(oldest);
        }
        store.set(key, { value, expiresAt: Date.now() + ttlMs });
      }
      return value;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, promise);
  return promise;
}

/** Drop every cached key that starts with one of the given prefixes. */
export function invalidate(...prefixes: string[]) {
  generation++;
  for (const key of store.keys()) {
    if (prefixes.some((p) => key.startsWith(p))) store.delete(key);
  }
  for (const key of inflight.keys()) {
    if (prefixes.some((p) => key.startsWith(p))) inflight.delete(key);
  }
}
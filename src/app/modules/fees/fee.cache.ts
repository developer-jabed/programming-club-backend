/**
 * Tiny in-memory TTL cache with:
 *  - in-flight de-duplication
 *  - prefix invalidation
 *  - generation guard
 *  - size cap
 *
 * Single-instance only. Swap for Redis if you scale horizontally.
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
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value as T;
  }

  const running = inflight.get(key);
  if (running) {
    return running as Promise<T>;
  }

  const startedAt = generation;

  const promise = loader()
    .then((value) => {
      // Only write if no invalidation happened while we were loading
      if (startedAt === generation) {
        if (store.size >= MAX_ENTRIES) {
          const oldest = store.keys().next().value;
          if (oldest !== undefined) store.delete(oldest);
        }
        store.set(key, { value, expiresAt: Date.now() + ttlMs });
      }
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

/** Drop every cached key that starts with one of the given prefixes. */
export function invalidate(...prefixes: string[]) {
  generation++;
  for (const key of store.keys()) {
    if (prefixes.some((p) => key.startsWith(p))) {
      store.delete(key);
    }
  }
  for (const key of inflight.keys()) {
    if (prefixes.some((p) => key.startsWith(p))) {
      inflight.delete(key);
    }
  }
}
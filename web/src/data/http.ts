import { cacheGet, cachePut } from './cache';

export const HOUR = 3600 * 1000;
export const DAY = 24 * HOUR;

export class HttpError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
  ) {
    super(`HTTP ${status} for ${url}`);
  }
}

const inflight = new Map<string, Promise<unknown>>();

/** GET JSON with an IndexedDB cache; concurrent calls for the same URL share one request. */
export async function fetchJson<T>(url: string, ttlMs: number, timeoutMs = 45_000): Promise<T> {
  const cached = await cacheGet<T>(url, ttlMs);
  if (cached !== undefined) return cached;
  const pending = inflight.get(url);
  if (pending) return pending as Promise<T>;

  const request = (async () => {
    try {
      // Hub'Eau occasionally answers 503 under load: retry once after a short pause.
      for (let attempt = 0; ; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetch(url, { signal: controller.signal });
          // Hub'Eau answers 206 when a result is paginated; it is still a valid page.
          if (res.status >= 500 && attempt === 0) {
            await new Promise((r) => setTimeout(r, 1500));
            continue;
          }
          if (!res.ok) throw new HttpError(url, res.status);
          const data = (await res.json()) as T;
          await cachePut(url, data);
          return data;
        } finally {
          clearTimeout(timer);
        }
      }
    } finally {
      inflight.delete(url);
    }
  })();
  inflight.set(url, request);
  return request;
}

export function query(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) q.set(k, String(v));
  return q.toString();
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function daysAgo(n: number, from = new Date()): Date {
  return new Date(from.getTime() - n * DAY);
}

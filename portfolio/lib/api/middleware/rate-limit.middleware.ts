import { RateLimitError } from '../errors/api.errors';
import { RATE_LIMIT } from '../api.constants';
import type { Middleware } from '../api.types';

type RateLimitOptions = {
  maxRequests?: number;
  windowMs?: number;
};

const hits = new Map<string, number[]>();

// Periodic cleanup to prevent memory leaks from stale entries
if (typeof globalThis !== 'undefined') {
  const key = '__rate_limit_cleanup__';
  if (!(globalThis as Record<string, unknown>)[key]) {
    (globalThis as Record<string, unknown>)[key] = setInterval(() => {
      const now = Date.now();
      for (const [ip, timestamps] of hits) {
        const valid = timestamps.filter((t) => now - t < RATE_LIMIT.WINDOW_MS);
        if (valid.length === 0) hits.delete(ip);
        else hits.set(ip, valid);
      }
    }, RATE_LIMIT.CLEANUP_INTERVAL_MS);
  }
}

export function rateLimit(options?: RateLimitOptions): Middleware {
  const maxRequests = options?.maxRequests ?? RATE_LIMIT.MAX_REQUESTS;
  const windowMs = options?.windowMs ?? RATE_LIMIT.WINDOW_MS;

  return async (_req, ctx) => {
    const now = Date.now();
    const timestamps = (hits.get(ctx.ip) ?? []).filter((t) => now - t < windowMs);

    if (timestamps.length >= maxRequests) {
      const oldest = timestamps[0];
      const retryAfterSeconds = Math.ceil((oldest + windowMs - now) / 1000);
      throw new RateLimitError(retryAfterSeconds);
    }

    timestamps.push(now);
    hits.set(ctx.ip, timestamps);
  };
}

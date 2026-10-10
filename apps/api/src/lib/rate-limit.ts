import { env } from "../env";

export interface RateLimiter {
  /** Counts a request; false once the key went past the maximum in its window. */
  hit(key: string, now?: number): boolean;
}

/** The public invite preview (planner's decision 13): 30 a minute per connection. */
export const INVITE_PREVIEW_LIMIT = { max: 30, windowMs: 60_000 } as const;

/** And 600 a minute for everyone: what actually bounds the load on the database. */
export const INVITE_PREVIEW_GLOBAL = { max: 600, windowMs: 60_000 } as const;

/** Live windows a limiter keeps; past this, a new key is refused, never stored. */
export const MAX_KEYS = 10_000;

/** A fixed window per key, in memory (one API process; a restart starts over). */
export function createRateLimiter(options: {
  max: number;
  windowMs: number;
}): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();
  return {
    hit(key, now = Date.now()) {
      const current = windows.get(key);
      if (current && current.resetAt > now) {
        current.count += 1;
        return current.count <= options.max;
      }
      if (windows.size >= MAX_KEYS) {
        for (const [each, window] of windows) {
          if (window.resetAt <= now) {
            windows.delete(each);
          }
        }
        if (windows.size >= MAX_KEYS) {
          return false;
        }
      }
      windows.set(key, { count: 1, resetAt: now + options.windowMs });
      return true;
    },
  };
}

/**
 * Same switch as Better Auth's (auth.ts): on in production or with
 * RATE_LIMIT_ENABLED=true, off locally, where the e2e and the screenshots
 * all come from 127.0.0.1. Read on every request, so a test can flip it.
 */
export function rateLimitOn(): boolean {
  return env.NODE_ENV === "production" || env.RATE_LIMIT_ENABLED === "true";
}

/**
 * The connection the request came from, as no header can fake it: Fly's
 * edge writes Fly-Client-IP from the connection; locally, the socket. Never
 * X-Forwarded-For: on a direct call to fly it is whatever the client sent.
 * Through the Vercel rewrite the key is Vercel's egress (coarse), which the
 * global cap backs up (planner's decision 13).
 */
export function clientIp(request: Request, socketIp?: string | null): string {
  return request.headers.get("fly-client-ip")?.trim() || socketIp || "unknown";
}

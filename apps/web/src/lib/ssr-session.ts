import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import {
  resolveSessionSSR,
  SESSION_SSR_TIMEOUT_MS,
  type SessionIdentity,
} from "@/lib/session-resolver";

// SSR talks to the Fly API directly (the /api/* rewrite is browser-only).
const API_URL = process.env.API_URL ?? "http://localhost:3000";

/**
 * Server-side session check. Reads the request via getRequest (avoids the
 * incomplete-headers gotcha in beforeLoad). The signed cookie cache gives the
 * identity without calling the API; the API is only hit when it is missing or
 * expired.
 */
export const getSessionSSR = createServerFn({ method: "GET" }).handler(
  async () => {
    const headers = getRequest().headers;
    // Server-only module, loaded lazily so it never reaches the client bundle.
    const { getCookieCache, getSessionCookie } = await import(
      "better-auth/cookies"
    );
    const secret = process.env.BETTER_AUTH_SECRET;
    return resolveSessionSSR({
      hasSessionCookie: getSessionCookie(headers) !== null,
      readCachedIdentity: async (): Promise<SessionIdentity | null> => {
        if (!secret) {
          return null;
        }
        const cache = await getCookieCache(headers, { secret });
        if (!cache) {
          return null;
        }
        const { id, name, email, image } = cache.user;
        return { id, name, email, image: image ?? null };
      },
      fetchMe: () =>
        fetch(`${API_URL}/api/me`, {
          headers: { cookie: headers.get("cookie") ?? "" },
        }),
      timeoutMs: SESSION_SSR_TIMEOUT_MS,
    });
  }
);

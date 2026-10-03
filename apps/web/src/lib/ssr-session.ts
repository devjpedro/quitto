import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { parseIdentityCookie } from "@/lib/identity-cookie";
import {
  resolveSessionSSR,
  SESSION_SSR_TIMEOUT_MS,
} from "@/lib/session-resolver";

// SSR talks to the Fly API directly (the /api/* rewrite is browser-only).
const API_URL = process.env.API_URL ?? "http://localhost:3000";

/**
 * Server-side session check. Reads the request via getRequest (avoids the
 * incomplete-headers gotcha in beforeLoad). The layout decision depends only
 * on whether the better-auth session cookie is present. The name comes from
 * the identity cookie, a cosmetic identity hint the client wrote; never
 * authorization. The API is only hit when that hint is missing.
 */
export const getSessionSSR = createServerFn({ method: "GET" }).handler(
  async () => {
    const headers = getRequest().headers;
    // Server-only module, loaded lazily so it never reaches the client bundle.
    const { getSessionCookie } = await import("better-auth/cookies");
    return resolveSessionSSR({
      hasSessionCookie: getSessionCookie(headers) !== null,
      readIdentityHint: async () => parseIdentityCookie(headers.get("cookie")),
      fetchMe: (signal) =>
        fetch(`${API_URL}/api/me`, {
          headers: { cookie: headers.get("cookie") ?? "" },
          signal,
        }),
      timeoutMs: SESSION_SSR_TIMEOUT_MS,
    });
  }
);

import { treaty } from "@elysiajs/eden";
import type { App } from "@quitto/api";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import {
  REQUEST_TIMEOUT_MS,
  SSR_REQUEST_TIMEOUT_MS,
  withRequestTimeout,
} from "@/lib/request-timeout";

/**
 * Browser: same origin (Vite proxy in dev, the Vercel rewrite in prod).
 * SSR: the API directly, since the /api rewrite only exists for the browser.
 * The Start compiler drops the server branch, and its imports, from the
 * client bundle.
 */
const apiOrigin = createIsomorphicFn()
  .server(() => process.env.API_URL ?? "http://localhost:3000")
  .client(() => window.location.origin);

/** SSR calls run as the signed-in user: forward the incoming request's cookie. */
const forwardedHeaders = createIsomorphicFn()
  .server((): Record<string, string> => {
    const cookie = getRequestHeader("cookie");
    return cookie ? { cookie } : {};
  })
  .client((): Record<string, string> => ({}));

/** A read gives up sooner in the SSR, so the function is never cut mid-stream. */
const readTimeoutMs = createIsomorphicFn()
  .server(() => SSR_REQUEST_TIMEOUT_MS)
  .client(() => REQUEST_TIMEOUT_MS);

// parseDate:false: Eden would otherwise revive every "YYYY-MM-DD"-ish string
// into a Date (and drift the day through UTC parsing). The API speaks ISO
// date strings and the date helpers expect strings.
export const api = treaty<App>(apiOrigin(), {
  fetch: { credentials: "include" },
  fetcher: withRequestTimeout(
    (input, init) => fetch(input, init),
    readTimeoutMs()
  ) as typeof fetch,
  headers: () => forwardedHeaders(),
  parseDate: false,
});

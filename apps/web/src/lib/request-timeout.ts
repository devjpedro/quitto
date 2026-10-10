import { TimeoutError } from "@/lib/with-timeout";

/**
 * How long one read may take in the browser before the section offers "Try
 * again". It covers a Fly cold start, which usually answers within seconds.
 */
export const REQUEST_TIMEOUT_MS = 15_000;

/**
 * The same limit in the SSR, shorter so a cold API gives up before the
 * serverless function is cut: the browser then shows "Try again".
 */
export const SSR_REQUEST_TIMEOUT_MS = 8000;

export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

/**
 * Wraps fetch so a hung read is aborted and rejects with TimeoutError. An
 * abort coming from the caller still goes through untouched. The limit
 * covers the wait for the response headers: fetch resolves there, so a body
 * that stalls afterwards is not cut.
 */
export function withRequestTimeout(
  fetchImpl: FetchLike,
  timeoutMs: number
): FetchLike {
  return (input, init) => {
    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    // Only reads time out: an aborted write may still land on the server, and
    // "Try again" would then send it twice.
    if (method !== "GET" && method !== "HEAD") {
      return fetchImpl(input, init);
    }
    const controller = new AbortController();
    const outer = init?.signal ?? null;
    const forwardAbort = () => controller.abort(outer?.reason);
    if (outer?.aborted) {
      forwardAbort();
    } else {
      outer?.addEventListener("abort", forwardAbort, { once: true });
    }
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    return fetchImpl(input, { ...init, signal: controller.signal })
      .catch((error: unknown) => {
        throw timedOut ? new TimeoutError() : error;
      })
      .finally(() => {
        clearTimeout(timer);
        outer?.removeEventListener("abort", forwardAbort);
      });
  };
}

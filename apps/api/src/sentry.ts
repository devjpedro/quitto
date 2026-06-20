import type { ErrorEvent } from "@sentry/bun";
import { init } from "@sentry/bun";
import { env } from "./env";

interface ScrubbableEvent {
  request?: {
    headers?: Record<string, string>;
    cookies?: unknown;
    query_string?: unknown;
    url?: string;
  };
}

/**
 * Strips request headers, cookies and the query string so we never ship session
 * tokens (Authorization/cookie) or auth params (?token=, ?code=) to Sentry.
 */
export function scrubEvent<T extends ScrubbableEvent>(
  event: T
): ScrubbableEvent {
  const request = event.request;
  if (!request) {
    return event;
  }
  if (request.headers) {
    request.headers = {};
  }
  request.cookies = undefined;
  request.query_string = undefined;
  if (typeof request.url === "string") {
    const [path] = request.url.split("?");
    request.url = path;
  }
  return event;
}

/** Initializes Sentry only when a DSN is configured and not under test. No-op otherwise. */
export function initSentry(): void {
  if (!env.SENTRY_DSN || env.NODE_ENV === "test") {
    return;
  }
  init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: (event: ErrorEvent): ErrorEvent =>
      scrubEvent(event) as ErrorEvent,
  });
}

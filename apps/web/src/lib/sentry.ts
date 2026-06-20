// biome-ignore lint/performance/noNamespaceImport: Sentry SDK is designed as a namespace
import * as Sentry from "@sentry/react";

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
export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
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

/** Initializes Sentry only when a DSN is configured (production). No-op otherwise. */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    return;
  }
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: (event) => scrubEvent(event),
  });
}

// biome-ignore lint/performance/noNamespaceImport: Sentry SDK is designed as a namespace
import * as Sentry from "@sentry/react";

interface ScrubbableEvent {
  request?: { headers?: Record<string, string>; cookies?: unknown };
}

/** Removes request headers/cookies so we never ship session tokens to Sentry. */
export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  if (event.request?.headers) {
    event.request.headers = {};
  }
  if (event.request) {
    event.request.cookies = undefined;
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

import type { ErrorEvent } from "@sentry/bun";
import { init } from "@sentry/bun";
import { env } from "./env";

interface ScrubbableEvent {
  request?: { headers?: Record<string, string>; cookies?: unknown };
}

/** Removes request headers/cookies so we never ship session tokens to Sentry. */
export function scrubEvent<T extends ScrubbableEvent>(
  event: T
): ScrubbableEvent {
  if (event.request?.headers) {
    event.request.headers = {};
  }
  if (event.request) {
    event.request.cookies = undefined;
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

// biome-ignore lint/performance/noNamespaceImport: needed to spy on all Sentry exports in tests
import * as Sentry from "@sentry/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initSentry, scrubEvent } from "@/lib/sentry";

vi.mock("@sentry/react", () => ({ init: vi.fn() }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("initSentry", () => {
  it("é no-op quando não há DSN (dev/test)", () => {
    expect(() => initSentry()).not.toThrow();
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it("inicializa quando há DSN", () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://pub@o1.ingest.sentry.io/1");
    initSentry();
    expect(Sentry.init).toHaveBeenCalledTimes(1);
  });
});

describe("scrubEvent", () => {
  it("remove headers e cookies da request (não vaza token/sessão)", () => {
    const cleaned = scrubEvent({
      request: {
        headers: { authorization: "Bearer x", cookie: "session=y" },
        cookies: { session: "y" },
      },
    });
    expect(cleaned.request?.headers).toEqual({});
    expect(cleaned.request?.cookies).toBeUndefined();
  });
});

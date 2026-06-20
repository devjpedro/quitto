import { describe, expect, it } from "bun:test";
import { initSentry, scrubEvent } from "../src/sentry";

describe("initSentry", () => {
  it("é no-op sem DSN (não lança)", () => {
    expect(() => initSentry()).not.toThrow();
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

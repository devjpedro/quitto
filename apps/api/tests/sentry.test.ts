import { describe, expect, it } from "bun:test";
import { initSentry, scrubEvent } from "../src/sentry";

describe("initSentry", () => {
  it("é no-op sem DSN (não lança)", () => {
    expect(() => initSentry()).not.toThrow();
  });
});

describe("scrubEvent", () => {
  it("remove headers, cookies e query string (não vaza token/sessão/params de auth)", () => {
    const cleaned = scrubEvent({
      request: {
        headers: { authorization: "Bearer x", cookie: "session=y" },
        cookies: { session: "y" },
        query_string: "token=secret",
        url: "https://api/auth/reset?token=secret",
      },
    });
    expect(cleaned.request?.headers).toEqual({});
    expect(cleaned.request?.cookies).toBeUndefined();
    expect(cleaned.request?.query_string).toBeUndefined();
    expect(cleaned.request?.url).toBe("https://api/auth/reset");
  });
});

import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-client";
import { makeQueryClient, shouldRetryQuery } from "@/lib/query";
import { TimeoutError } from "@/lib/with-timeout";

describe("shouldRetryQuery", () => {
  it("never retries a timeout: the section offers 'Try again'", () => {
    expect(shouldRetryQuery(0, new TimeoutError())).toBe(false);
  });

  it("recognizes a timeout that crossed the SSR stream (same name, new class)", () => {
    const streamed = Object.assign(new Error("x"), { name: "TimeoutError" });
    expect(shouldRetryQuery(0, streamed)).toBe(false);
  });

  it("lets a timeout cross the SSR stream unredacted, and only a timeout", () => {
    const redact =
      makeQueryClient().getDefaultOptions().dehydrate?.shouldRedactErrors;
    expect(redact?.(new TimeoutError())).toBe(false);
    expect(redact?.(new Error("boom"))).toBe(true);
  });

  it("never retries a 401: the session gate redirects", () => {
    const unauthorized = new ApiError({
      code: "UNAUTHORIZED",
      httpStatus: 401,
      message: "x",
    });
    expect(shouldRetryQuery(0, unauthorized)).toBe(false);
  });

  it("retries any other failure once", () => {
    expect(shouldRetryQuery(0, new Error("boom"))).toBe(true);
    expect(shouldRetryQuery(1, new Error("boom"))).toBe(false);
  });
});

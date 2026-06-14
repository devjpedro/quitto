import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/lib/api-client";
import { requireSession } from "../src/lib/require-session";

function fakeQc(behavior: "ok" | "401" | "500") {
  return {
    ensureQueryData: vi.fn(() => {
      if (behavior === "ok") {
        return Promise.resolve({ id: "u1" });
      }
      const status = behavior === "401" ? 401 : 500;
      return Promise.reject(
        new ApiError({ code: "X", httpStatus: status, message: "x" })
      );
    }),
  } as never;
}

describe("requireSession", () => {
  it("resolves when a session exists", async () => {
    await expect(
      requireSession(fakeQc("ok"), "/contracts")
    ).resolves.toBeUndefined();
  });

  it("throws a redirect to /login on 401, carrying the target", async () => {
    let thrown: unknown;
    try {
      await requireSession(fakeQc("401"), "/contracts/123");
    } catch (e) {
      thrown = e;
    }
    // redirect() returns an object carrying the details under `options`
    const options = (
      thrown as { options?: { to?: string; search?: { redirect?: string } } }
    ).options;
    expect(options?.to).toBe("/login");
    expect(options?.search?.redirect).toBe("/contracts/123");
  });

  it("rethrows non-401 errors", async () => {
    await expect(requireSession(fakeQc("500"), "/x")).rejects.toBeInstanceOf(
      ApiError
    );
  });
});

import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-client";
import { isSessionLost } from "@/lib/session-gate";

describe("isSessionLost", () => {
  it("is true only for a 401 from the API", () => {
    expect(
      isSessionLost(
        new ApiError({ code: "UNAUTHORIZED", httpStatus: 401, message: "x" })
      )
    ).toBe(true);
    expect(
      isSessionLost(
        new ApiError({ code: "INTERNAL", httpStatus: 503, message: "x" })
      )
    ).toBe(false);
    expect(isSessionLost(new Error("network"))).toBe(false);
    expect(isSessionLost(null)).toBe(false);
  });
});

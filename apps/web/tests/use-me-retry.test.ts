import { describe, expect, it } from "vitest";
import { SESSION_RETRY_MAX, shouldRetrySession } from "@/hooks/use-me";
import { ApiError } from "@/lib/api-client";
import { TimeoutError } from "@/lib/with-timeout";

function unauthorized(): ApiError {
  return new ApiError({ code: "UNAUTHORIZED", httpStatus: 401, message: "no" });
}

describe("shouldRetrySession", () => {
  it("nunca re-tenta um 401 (sessão realmente ausente → redireciona rápido)", () => {
    expect(shouldRetrySession(0, unauthorized())).toBe(false);
  });

  it("re-tenta timeout/erro transitório até o limite", () => {
    expect(shouldRetrySession(0, new TimeoutError())).toBe(true);
    expect(shouldRetrySession(SESSION_RETRY_MAX - 1, new TimeoutError())).toBe(
      true
    );
  });

  it("para de re-tentar ao atingir o limite", () => {
    expect(shouldRetrySession(SESSION_RETRY_MAX, new TimeoutError())).toBe(
      false
    );
  });

  it("re-tenta erro 5xx do servidor (boot incompleto)", () => {
    const err = new ApiError({
      code: "UNKNOWN",
      httpStatus: 503,
      message: "x",
    });
    expect(shouldRetrySession(0, err)).toBe(true);
  });
});

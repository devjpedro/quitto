import { describe, expect, it } from "vitest";
import { ApiError } from "../src/lib/api-client";
import { errorMessage } from "../src/lib/error-message";

describe("errorMessage", () => {
  it("uses the ApiError message when present", () => {
    expect(
      errorMessage(
        new ApiError({
          code: "FORBIDDEN",
          httpStatus: 403,
          message: "Sem permissão",
        })
      )
    ).toBe("Sem permissão");
  });

  it("maps a 5xx ApiError to a generic message", () => {
    expect(
      errorMessage(
        new ApiError({ code: "UNKNOWN", httpStatus: 500, message: "x" })
      )
    ).toBe("Algo deu errado. Tente novamente.");
  });

  it("handles non-ApiError values", () => {
    expect(errorMessage(new Error("nope"))).toBe(
      "Algo deu errado. Tente novamente."
    );
    expect(errorMessage("weird")).toBe("Algo deu errado. Tente novamente.");
  });
});

import { describe, expect, it } from "vitest";
import { ApiError, unwrap } from "../src/lib/api-client";

describe("unwrap", () => {
  it("returns data when there is no error", async () => {
    const result = await unwrap(
      Promise.resolve({ data: { id: "abc" }, error: null })
    );
    expect(result).toEqual({ id: "abc" });
  });

  it("throws ApiError carrying code/status from the envelope", async () => {
    const eden = Promise.resolve({
      data: null,
      error: {
        status: 404,
        value: {
          error: { code: "NOT_FOUND", message: "Contrato não encontrado" },
        },
      },
    });
    await expect(unwrap(eden)).rejects.toBeInstanceOf(ApiError);
    await expect(unwrap(eden)).rejects.toMatchObject({
      code: "NOT_FOUND",
      httpStatus: 404,
      message: "Contrato não encontrado",
    });
  });

  it("falls back to a generic ApiError when the envelope is missing", async () => {
    const eden = Promise.resolve({
      data: null,
      error: { status: 500, value: "boom" },
    });
    const err = await unwrap(eden).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.httpStatus).toBe(500);
    expect(err.code).toBe("UNKNOWN");
  });
});

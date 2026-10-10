import { describe, expect, it } from "vitest";
import { ApiError, unwrap, unwrapOrNull } from "../src/lib/api-client";
import { TimeoutError } from "../src/lib/with-timeout";

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

  it("rethrows the TimeoutError that Eden wraps as a 503", async () => {
    const timeout = new TimeoutError();
    await expect(
      unwrap(
        Promise.resolve({ data: null, error: { status: 503, value: timeout } })
      )
    ).rejects.toBe(timeout);
  });
});

describe("unwrapOrNull", () => {
  const notFound = () =>
    Promise.resolve({
      data: null,
      error: {
        status: 404,
        value: {
          error: { code: "NOT_FOUND", message: "Contrato não encontrado" },
        },
      },
    });

  it("answers null for a 404: the resource is gone, which is an answer, not a failure", async () => {
    await expect(unwrapOrNull(notFound())).resolves.toBeNull();
  });

  it("returns data, and still throws every other error", async () => {
    await expect(
      unwrapOrNull(Promise.resolve({ data: { id: "abc" }, error: null }))
    ).resolves.toEqual({ id: "abc" });
    await expect(
      unwrapOrNull(
        Promise.resolve({ data: null, error: { status: 500, value: "boom" } })
      )
    ).rejects.toMatchObject({ httpStatus: 500 });
  });
});

import { describe, expect, it, vi } from "vitest";

const { success, error } = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success, error } }));

import { ApiError } from "../src/lib/api-client";
import { makeQueryClient, toastSuccessFromMeta } from "../src/lib/query";

describe("toastSuccessFromMeta", () => {
  it("toasts the meta.successMessage on success", () => {
    success.mockClear();
    toastSuccessFromMeta(null, null, null, {
      meta: { successMessage: "Feito" },
    } as never);
    expect(success).toHaveBeenCalledWith("Feito");
  });

  it("does nothing when there is no successMessage", () => {
    success.mockClear();
    toastSuccessFromMeta(null, null, null, { meta: undefined } as never);
    expect(success).not.toHaveBeenCalled();
  });
});

describe("query error toasts", () => {
  const failing = () =>
    Promise.reject(
      new ApiError({ code: "BOOM", httpStatus: 400, message: "x" })
    );

  it("does not toast an initial-load failure (shown inline instead)", async () => {
    error.mockClear();
    const qc = makeQueryClient();
    await qc
      .fetchQuery({ queryKey: ["first-load"], queryFn: failing, retry: false })
      .catch(() => undefined);
    expect(error).not.toHaveBeenCalled();
  });

  it("toasts a background refetch failure when there is data on screen", async () => {
    error.mockClear();
    const qc = makeQueryClient();
    qc.setQueryData(["refetch"], { id: 1 });
    await qc
      .fetchQuery({
        queryKey: ["refetch"],
        queryFn: failing,
        retry: false,
        staleTime: 0,
      })
      .catch(() => undefined);
    expect(error).toHaveBeenCalledWith("x");
  });

  it("does not toast a background refetch failure of a query that opts out", async () => {
    error.mockClear();
    const qc = makeQueryClient();
    qc.setQueryData(["silent-refetch"], { id: 1 });
    await qc
      .fetchQuery({
        queryKey: ["silent-refetch"],
        queryFn: failing,
        retry: false,
        staleTime: 0,
        meta: { silentRefetchError: true },
      })
      .catch(() => undefined);
    expect(error).not.toHaveBeenCalled();
  });

  it("never toasts a 401, even with data", async () => {
    error.mockClear();
    const qc = makeQueryClient();
    qc.setQueryData(["refetch-401"], { id: 1 });
    await qc
      .fetchQuery({
        queryKey: ["refetch-401"],
        queryFn: () =>
          Promise.reject(
            new ApiError({
              code: "UNAUTHORIZED",
              httpStatus: 401,
              message: "no",
            })
          ),
        retry: false,
        staleTime: 0,
      })
      .catch(() => undefined);
    expect(error).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ApiError } from "../src/lib/api-client";
import { makeQueryClient } from "../src/lib/query";
import { queryKeys } from "../src/lib/query-keys";

const unauthorized = () =>
  new ApiError({ code: "UNAUTHORIZED", httpStatus: 401, message: "no" });

describe("401 numa query de dados", () => {
  it("revalida a sessão (me) para o gate mandar ao login", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.me, { id: "u1" });

    await qc
      .fetchQuery({
        queryKey: queryKeys.contracts,
        queryFn: () => Promise.reject(unauthorized()),
        retry: false,
      })
      .catch(() => undefined);

    expect(qc.getQueryState(queryKeys.me)?.isInvalidated).toBe(true);
  });

  it("não mexe na sessão em erros que não são 401", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.me, { id: "u1" });

    await qc
      .fetchQuery({
        queryKey: queryKeys.contracts,
        queryFn: () =>
          Promise.reject(
            new ApiError({ code: "BOOM", httpStatus: 500, message: "x" })
          ),
        retry: false,
      })
      .catch(() => undefined);

    expect(qc.getQueryState(queryKeys.me)?.isInvalidated).toBe(false);
  });
});

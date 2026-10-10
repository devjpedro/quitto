import { describe, expect, it } from "vitest";
import { createFailure } from "@/features/contract-wizard/lib/request-errors";
import { ApiError } from "@/lib/api-client";

const api422 = (code: string, details?: Record<string, unknown>) =>
  new ApiError({ code, httpStatus: 422, message: code, details });

describe("createFailure", () => {
  it("um código com caminho conhecido vai para o campo, com os parâmetros", () => {
    expect(
      createFailure(
        api422("installments.sum.over", { path: "installments", diff: 110_000 })
      )
    ).toEqual({
      kind: "field",
      issue: {
        field: "installments",
        code: "installments.sum.over",
        params: { diff: 110_000 },
      },
    });
    expect(
      createFailure(
        api422("counterparty.email.self", { path: "counterparty.email" })
      )
    ).toEqual({
      kind: "field",
      issue: {
        field: "counterpartyEmail",
        code: "counterparty.email.self",
        params: {},
      },
    });
  });

  it("um código sem campo, ou desconhecido, ou outro erro: toast", () => {
    expect(createFailure(api422("contract.create.failed"))).toEqual({
      kind: "toast",
      code: "contract.create.failed",
    });
    expect(createFailure(api422("UNKNOWN"))).toEqual({
      kind: "toast",
      code: "contract.create.failed",
    });
    expect(createFailure(new Error("rede"))).toEqual({
      kind: "toast",
      code: "contract.create.failed",
    });
  });

  it("401: a sessão caiu (o gate leva ao login), nunca o toast genérico", () => {
    expect(
      createFailure(
        new ApiError({ code: "UNAUTHORIZED", httpStatus: 401, message: "x" })
      )
    ).toEqual({ kind: "session" });
  });
});

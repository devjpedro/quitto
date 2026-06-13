import { describe, expect, it } from "vitest";
import { buildInstallmentPatch } from "../src/lib/installment-form";

describe("buildInstallmentPatch", () => {
  it("envia só os campos preenchidos", () => {
    expect(buildInstallmentPatch({ amountCents: 100 })).toEqual({
      amountCents: 100,
    });
    expect(
      buildInstallmentPatch({ amountCents: Number.NaN, dueDate: "2026-01-01" })
    ).toEqual({ dueDate: "2026-01-01" });
  });

  it("não envia nada quando nenhum campo foi preenchido", () => {
    expect(buildInstallmentPatch({})).toEqual({});
  });
});

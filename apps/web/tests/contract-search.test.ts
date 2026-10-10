import { describe, expect, it } from "vitest";
import { contractSearch } from "@/lib/contract-search";

describe("contractSearch", () => {
  it("guarda a parcela aberta e a aba; o resto cai", () => {
    expect(
      contractSearch({
        installment: "i-4",
        tab: "people",
        status: "overdue",
        x: 1,
      })
    ).toEqual({ installment: "i-4", tab: "people" });
  });

  it("aba desconhecida ou 'installments' (o padrão) some da URL", () => {
    expect(contractSearch({ tab: "pessoas" })).toEqual({
      installment: undefined,
      tab: undefined,
    });
    expect(contractSearch({ tab: "installments" })).toEqual({
      installment: undefined,
      tab: undefined,
    });
  });
});

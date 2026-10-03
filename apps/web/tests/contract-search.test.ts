import { describe, expect, it } from "vitest";
import { contractSearch } from "@/lib/contract-search";
import { isInstallmentFilter } from "@/lib/installments-filter";

describe("contractSearch", () => {
  it("aceita a parcela e o filtro conhecido; ignora o resto", () => {
    expect(contractSearch({ installment: "i1", status: "overdue" })).toEqual({
      installment: "i1",
      status: "overdue",
    });
    expect(contractSearch({ status: "atrasadas", installment: 3 })).toEqual({
      installment: undefined,
      status: undefined,
    });
  });

  it("os filtros da lista de parcelas", () => {
    expect(["all", "due", "overdue", "paid"].every(isInstallmentFilter)).toBe(
      true
    );
    expect(isInstallmentFilter("late")).toBe(false);
    expect(isInstallmentFilter(undefined)).toBe(false);
  });
});

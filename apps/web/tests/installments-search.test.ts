import { describe, expect, it } from "vitest";
import { installmentsSearch } from "@/features/installments/lib/installments-search";

describe("installmentsSearch", () => {
  it("mês inválido some; day fora do mês some; installment sem contract some", () => {
    expect(installmentsSearch({ month: "2026-13" }).month).toBeUndefined();
    expect(installmentsSearch({ month: "2026-10" }).month).toBe("2026-10");
    expect(
      installmentsSearch({ month: "2026-10", day: "2026-11-02" }).day
    ).toBeUndefined();
    expect(
      installmentsSearch({ month: "2026-10", day: "2026-10-02" }).day
    ).toBe("2026-10-02");
    expect(installmentsSearch({ day: "2026-02-31x" }).day).toBeUndefined();
    const lone = installmentsSearch({ installment: "i1" });
    expect(lone.installment).toBeUndefined();
    expect(lone.contract).toBeUndefined();
    expect(installmentsSearch({ contract: "c1" }).contract).toBeUndefined();
    expect(
      installmentsSearch({ installment: "i1", contract: "c1" })
    ).toMatchObject({
      installment: "i1",
      contract: "c1",
    });
  });

  it("view e filter só aceitam os valores conhecidos", () => {
    expect(
      installmentsSearch({ view: "calendar", filter: "overdue" })
    ).toMatchObject({
      view: "calendar",
      filter: "overdue",
    });
    expect(installmentsSearch({ view: "grid", filter: "x" })).toMatchObject({
      view: undefined,
      filter: undefined,
    });
  });
});

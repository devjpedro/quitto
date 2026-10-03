import { describe, expect, it } from "vitest";
import { onboardingView, stepTarget } from "@/features/home/lib/onboarding";
import { homeFixture } from "./home-fixtures";

const fresh = {
  hasContract: false,
  hasPixKey: false,
  hasCounterparty: false,
  remindersOn: false,
  remindersAvailable: true,
  counterpartyContractId: null,
  dismissedAt: null,
};

describe("onboardingView", () => {
  it("conta nova: 1 de 4 (a outra parte é opcional e não conta) e o próximo é o contrato", () => {
    const view = onboardingView(fresh);
    expect(view).toMatchObject({
      doneCount: 1,
      total: 4,
      next: "contract",
      visible: true,
    });
    expect(view.steps.map((s) => [s.id, s.done, s.optional])).toEqual([
      ["account", true, false],
      ["contract", false, false],
      ["pix", false, false],
      ["counterparty", false, true],
      ["reminders", false, false],
    ]);
  });

  it("sem lembrete por e-mail no servidor, o passo some e o total vira 3", () => {
    const view = onboardingView({ ...fresh, remindersAvailable: false });
    expect(view.total).toBe(3);
    expect(view.steps.map((s) => s.id)).not.toContain("reminders");
  });

  it("concluído (sem a parte opcional) ou dispensado: some", () => {
    expect(
      onboardingView({
        ...fresh,
        hasContract: true,
        hasPixKey: true,
        remindersOn: true,
      }).visible
    ).toBe(false);
    expect(
      onboardingView({ ...fresh, dismissedAt: "2026-10-02T10:00:00.000Z" })
        .visible
    ).toBe(false);
  });
});

describe("stepTarget", () => {
  it("cada passo leva ao lugar certo", () => {
    const o = homeFixture().onboarding;
    expect(stepTarget("contract", o)).toEqual({ kind: "new_contract" });
    expect(stepTarget("pix", o)).toEqual({ kind: "settings" });
    expect(stepTarget("reminders", o)).toEqual({ kind: "settings" });
    expect(stepTarget("counterparty", o)).toEqual({
      kind: "contract",
      contractId: "c1",
    });
    expect(
      stepTarget("counterparty", { ...o, counterpartyContractId: null })
    ).toEqual({
      kind: "new_contract",
    });
    expect(stepTarget("account", o)).toBeNull();
  });
});

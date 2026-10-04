import { describe, expect, it } from "vitest";
import {
  guideContext,
  onboardingView,
  stepTarget,
} from "@/features/home/lib/onboarding";
import { homeFixture } from "./home-fixtures";

const FRESH = { activeContracts: 0, today: "2026-10-02" };

const fresh = {
  accountCreatedOn: "2026-10-02",
  activePartyContracts: 0,
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
    const view = onboardingView(fresh, FRESH);
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
    const view = onboardingView({ ...fresh, remindersAvailable: false }, FRESH);
    expect(view.total).toBe(3);
    expect(view.steps.map((s) => s.id)).not.toContain("reminders");
  });

  it("concluído (sem a parte opcional) ou dispensado: some", () => {
    expect(
      onboardingView(
        {
          ...fresh,
          hasContract: true,
          hasPixKey: true,
          remindersOn: true,
        },
        FRESH
      ).visible
    ).toBe(false);
    expect(
      onboardingView(
        { ...fresh, dismissedAt: "2026-10-02T10:00:00.000Z" },
        FRESH
      ).visible
    ).toBe(false);
  });
});

describe("o guia some sozinho (decisão 9 do dono)", () => {
  const pending = { ...fresh, accountCreatedOn: "2026-09-10" };

  it("com 3 contratos ativos some; com 2, fica", () => {
    expect(
      onboardingView(pending, { activeContracts: 2, today: "2026-10-02" })
        .visible
    ).toBe(true);
    expect(
      onboardingView(pending, { activeContracts: 3, today: "2026-10-02" })
        .visible
    ).toBe(false);
  });

  it("com 30 dias de conta some; com 29, fica", () => {
    expect(
      onboardingView(pending, { activeContracts: 0, today: "2026-10-09" })
        .visible
    ).toBe(true);
    expect(
      onboardingView(pending, { activeContracts: 0, today: "2026-10-10" })
        .visible
    ).toBe(false);
  });

  it("concluído ou dispensado some já no 1º dia, sem contratos (não é a idade que esconde)", () => {
    const firstDay = { activeContracts: 0, today: "2026-09-10" };
    expect(onboardingView(pending, firstDay).visible).toBe(true);
    expect(
      onboardingView(
        { ...pending, hasContract: true, hasPixKey: true, remindersOn: true },
        firstDay
      ).visible
    ).toBe(false);
    expect(
      onboardingView(
        { ...pending, dismissedAt: "2026-09-10T10:00:00.000Z" },
        firstDay
      ).visible
    ).toBe(false);
  });

  it("o contexto vem do home e conta só os contratos em que você é parte", () => {
    // Coordinator's rule: following 3 contracts does not hide the guide before
    // you create your first. The API already left followed ones out.
    const home = {
      onboarding: { ...pending, activePartyContracts: 1 },
      today: "2026-10-02",
    };
    expect(guideContext(home)).toEqual({
      activeContracts: 1,
      today: "2026-10-02",
    });
    expect(onboardingView(home.onboarding, guideContext(home)).visible).toBe(
      true
    );
    expect(
      guideContext({
        onboarding: { ...pending, activePartyContracts: 3 },
        today: "2026-10-02",
      })
    ).toEqual({ activeContracts: 3, today: "2026-10-02" });
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

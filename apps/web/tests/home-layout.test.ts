import { describe, expect, it } from "vitest";
import { homeLayout, homeSubtitle } from "@/features/home/lib/home-layout";
import { homeFixture, installmentAction, inviteAction } from "./home-fixtures";

const notStarted = {
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

describe("homeLayout", () => {
  it("com contrato e sem ação: Tudo em dia, com os próximos 30 dias e os marcos", () => {
    const home = homeFixture();
    const layout = homeLayout(home);
    expect(layout).toMatchObject({
      allClear: true,
      heroGuide: false,
      compactGuide: false,
      empty: false,
      showChips: true,
    });
    expect(homeSubtitle(home, layout, "pt-BR")).toBe(
      "Nada pede sua atenção agora."
    );
  });

  it("primeiro acesso: o guia verde lidera e não há estado vazio", () => {
    const home = homeFixture({ onboarding: notStarted });
    const layout = homeLayout(home);
    expect(layout).toMatchObject({
      heroGuide: true,
      empty: false,
      allClear: false,
    });
    expect(homeSubtitle(home, layout, "pt-BR")).toContain("Boas-vindas!");
  });

  it("com contrato, sem ação e com o guia por terminar: só o guia verde (ele já diz o que fazer)", () => {
    const home = homeFixture({
      onboarding: { ...homeFixture().onboarding, hasPixKey: false },
    });
    const layout = homeLayout(home);
    expect(layout).toMatchObject({
      heroGuide: true,
      allClear: false,
      empty: false,
    });
    expect(homeSubtitle(home, layout, "pt-BR")).toBe(
      "Nada pede sua atenção agora."
    );
  });

  it("com ações, o guia fica compacto no fim (dois cartões verdes nunca empilham)", () => {
    const home = homeFixture({
      actions: [installmentAction()],
      onboarding: { ...notStarted, hasContract: true },
    });
    const layout = homeLayout(home);
    expect(layout).toMatchObject({
      heroGuide: false,
      compactGuide: true,
      allClear: false,
    });
    expect(homeSubtitle(home, layout, "pt-BR")).toBe(
      "1 coisa pede sua atenção"
    );
  });

  it("acompanhar contratos não esconde o guia: só contam aqueles em que você é parte", () => {
    // Coordinator's rule, end to end: 5 followed contracts (the sidebar's
    // count), none where the person pays or receives.
    const home = homeFixture({
      activeContractsCount: 5,
      onboarding: { ...notStarted, activePartyContracts: 0 },
    });
    expect(homeLayout(home)).toMatchObject({ heroGuide: true, empty: false });
  });

  it("30 dias de conta, sem contrato e sem ação: o guia sumiu sozinho e fica o estado vazio", () => {
    const home = homeFixture({
      onboarding: { ...notStarted, accountCreatedOn: "2026-09-02" },
    });
    expect(homeLayout(home)).toMatchObject({
      heroGuide: false,
      compactGuide: false,
      empty: true,
    });
  });

  it("sem contrato e com o guia dispensado: estado vazio", () => {
    const home = homeFixture({
      onboarding: { ...notStarted, dismissedAt: "2026-10-02T10:00:00.000Z" },
    });
    expect(homeLayout(home)).toMatchObject({ empty: true, showChips: false });
  });

  it("só um convite, sem contrato: não é o vazio nem o Nada pendente, e os chips aparecem", () => {
    const dismissed = {
      ...notStarted,
      dismissedAt: "2026-10-02T10:00:00.000Z",
    };
    for (const onboarding of [notStarted, dismissed]) {
      const home = homeFixture({ actions: [inviteAction()], onboarding });
      expect(homeLayout(home)).toMatchObject({
        empty: false,
        allClear: false,
        heroGuide: false,
        showChips: true,
        compactGuide: onboarding.dismissedAt === null,
      });
      expect(homeSubtitle(home, homeLayout(home), "pt-BR")).toBe(
        "1 coisa pede sua atenção"
      );
    }
  });

  it("subtítulo no plural", () => {
    const home = homeFixture({
      actions: [
        installmentAction(),
        installmentAction({ installmentId: "i2" }),
      ],
    });
    expect(homeSubtitle(home, homeLayout(home), "pt-BR")).toBe(
      "2 coisas pedem sua atenção"
    );
  });

  it("subtítulo no idioma pedido", () => {
    const home = homeFixture({ actions: [installmentAction()] });
    expect(homeSubtitle(home, homeLayout(home), "en-US")).toBe(
      "1 thing needs your attention"
    );
  });
});

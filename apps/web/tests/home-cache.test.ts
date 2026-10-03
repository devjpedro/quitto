import { describe, expect, it } from "vitest";
import {
  applyInstallment,
  withAction,
  withOnboardingDismissed,
  withoutAction,
  withPendingWrites,
} from "@/features/home/lib/home-cache";
import { homeFixture, installmentAction, inviteAction } from "./home-fixtures";

describe("home-cache", () => {
  it("withoutAction tira só a ação pedida", () => {
    const home = homeFixture({
      actions: [installmentAction(), inviteAction()],
    });
    expect(withoutAction(home, "invite:tok1").actions.map((a) => a.id)).toEqual(
      ["installment:i1"]
    );
    expect(home.actions).toHaveLength(2);
  });

  it("withAction devolve a ação ao lugar dela, sem duplicar", () => {
    const invite = inviteAction();
    const home = homeFixture({
      actions: [
        installmentAction(),
        installmentAction({ installmentId: "i3" }),
      ],
    });
    expect(withAction(home, invite, 1).actions.map((a) => a.id)).toEqual([
      "installment:i1",
      "invite:tok1",
      "installment:i3",
    ]);
    // The list got shorter meanwhile: it goes to the end.
    expect(
      withAction(homeFixture(), invite, 5).actions.map((a) => a.id)
    ).toEqual(["invite:tok1"]);
    const withInvite = homeFixture({ actions: [invite] });
    expect(withAction(withInvite, invite, 0)).toBe(withInvite);
  });

  it("withOnboardingDismissed marca a dispensa sem mexer no resto", () => {
    const home = homeFixture();
    const next = withOnboardingDismissed(home, "2026-10-02T10:00:00.000Z");
    expect(next.onboarding).toEqual({
      ...home.onboarding,
      dismissedAt: "2026-10-02T10:00:00.000Z",
    });
  });

  it("withOnboardingDismissed com null traz o guia de volta", () => {
    const dismissed = withOnboardingDismissed(
      homeFixture(),
      "2026-10-02T10:00:00.000Z"
    );
    expect(withOnboardingDismissed(dismissed, null).onboarding).toEqual(
      homeFixture().onboarding
    );
  });

  it("withPendingWrites mantém fora as ações em voo e o guia dispensado em voo", () => {
    const home = homeFixture({
      actions: [installmentAction(), inviteAction()],
    });
    const next = withPendingWrites(home, {
      actionIds: ["invite:tok1"],
      dismissedAt: "2026-10-02T10:00:00.000Z",
      unreadCap: null,
    });
    expect(next.actions.map((a) => a.id)).toEqual(["installment:i1"]);
    expect(next.onboarding.dismissedAt).toBe("2026-10-02T10:00:00.000Z");
    expect(home.actions).toHaveLength(2);
    // Nothing in flight: the server's read stands as it is.
    expect(
      withPendingWrites(home, {
        actionIds: [],
        dismissedAt: null,
        unreadCap: null,
      })
    ).toBe(home);
  });

  it("withPendingWrites: com leitura de aviso em voo, o contador não passa do que o cache mostra", () => {
    const home = homeFixture({ unreadCount: 3 });
    const pending = { actionIds: [], dismissedAt: null };
    // The read was not applied yet on the server: keep the optimistic count.
    expect(
      withPendingWrites(home, { ...pending, unreadCap: 2 }).unreadCount
    ).toBe(2);
    // The server already counts fewer (it applied the read): its count stands.
    expect(
      withPendingWrites(home, { ...pending, unreadCap: 5 }).unreadCount
    ).toBe(3);
    // No read in flight: the server's read stands as it is.
    expect(withPendingWrites(home, { ...pending, unreadCap: null })).toBe(home);
  });

  it("withPendingWrites não troca a hora de uma dispensa que o servidor já gravou", () => {
    const home = withOnboardingDismissed(
      homeFixture(),
      "2026-10-02T09:00:00.000Z"
    );
    expect(
      withPendingWrites(home, {
        actionIds: [],
        dismissedAt: "2026-10-02T10:00:00.000Z",
        unreadCap: null,
      }).onboarding.dismissedAt
    ).toBe("2026-10-02T09:00:00.000Z");
  });

  it("applyInstallment troca o status da parcela no contrato em cache", () => {
    const contract = {
      title: "Aluguel",
      installments: [
        { id: "i1", status: "pending" },
        { id: "i2", status: "pending" },
      ],
    };
    expect(applyInstallment(contract, { id: "i2", status: "paid" })).toEqual({
      title: "Aluguel",
      installments: [
        { id: "i1", status: "pending" },
        { id: "i2", status: "paid" },
      ],
    });
    expect(
      applyInstallment(undefined, { id: "i2", status: "paid" })
    ).toBeUndefined();
  });
});

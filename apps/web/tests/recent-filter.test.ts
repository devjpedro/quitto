import { describe, expect, it } from "vitest";
import { withoutCards } from "@/features/home/lib/recent-filter";
import { installmentAction } from "./home-fixtures";
import { notificationItem } from "./notification-fixtures";

describe("withoutCards (Notificações recentes sem o que já tem cartão)", () => {
  const actions = [
    installmentAction({
      id: "installment:i4",
      kind: "review",
      installmentId: "i4",
      contractId: "moto",
    }),
    installmentAction({
      id: "overdue:notebook:receive",
      kind: "overdue",
      installmentId: "n3",
      installmentIds: ["n3", "n4"],
      contractId: "notebook",
    }),
    installmentAction({
      id: "installment:e7",
      kind: "due_soon",
      installmentId: "e7",
      installmentIds: ["e7"],
      contractId: "emprestimo",
    }),
  ];

  it("tira o comprovante que é o cartão 'Aguarda você', a atrasada que é um cartão e o 'vence em breve' que já é cartão", () => {
    const items = [
      notificationItem({
        groupKey: "p",
        type: "proof_submitted",
        installmentId: "i4",
        contractId: "moto",
      }),
      notificationItem({
        groupKey: "o",
        type: "installment_overdue_receivable",
        installmentId: "n4",
        contractId: "notebook",
      }),
      notificationItem({
        groupKey: "d",
        type: "installment_due_soon",
        installmentId: "e7",
        contractId: "emprestimo",
      }),
      notificationItem({
        groupKey: "k",
        type: "invite_accepted",
        installmentId: null,
        contractId: "moto",
      }),
    ];
    expect(withoutCards(items, actions).map((i) => i.groupKey)).toEqual(["k"]);
  });

  it("um comprovante de outra parcela continua", () => {
    const items = [
      notificationItem({
        groupKey: "p2",
        type: "proof_submitted",
        installmentId: "i9",
        contractId: "moto",
      }),
    ];
    expect(withoutCards(items, actions)).toHaveLength(1);
  });

  it("a contestação que é o cartão 'Contestada' de quem paga sai; a de outra parcela fica (M17)", () => {
    const disputed = [
      installmentAction({
        id: "installment:a2",
        kind: "disputed",
        installmentId: "a2",
        contractId: "aluguel",
      }),
    ];
    const items = [
      notificationItem({
        groupKey: "d1",
        type: "payment_disputed",
        installmentId: "a2",
        contractId: "aluguel",
      }),
      notificationItem({
        groupKey: "d2",
        type: "payment_disputed",
        installmentId: "a7",
        contractId: "aluguel",
      }),
    ];
    expect(withoutCards(items, disputed).map((i) => i.groupKey)).toEqual([
      "d2",
    ]);
  });
});

import { describe, expect, it } from "vitest";
import {
  notificationTarget,
  notificationView,
} from "@/features/notifications/lib/notification-view";
import type { NotificationItem } from "@/features/notifications/types";
import { notificationItem } from "./notification-fixtures";

const NOW = Date.parse("2026-10-02T12:00:00Z");

function item(over: Partial<NotificationItem> = {}): NotificationItem {
  return notificationItem({
    id: "n1",
    type: "payment_confirmed",
    contractId: "c1",
    installmentId: "i1",
    metadata: null,
    readAt: null,
    createdAt: "2026-10-02T10:00:00.000Z",
    contractTitle: "Aluguel do apê",
    installmentSequence: 7,
    installmentsCount: 12,
    ...over,
  });
}

describe("notificationView", () => {
  it("título pelo tipo; contrato, parcela e quando; não lida", () => {
    expect(notificationView(item(), NOW, "pt-BR")).toEqual({
      title: "Pagamento confirmado",
      tone: "brand",
      meta: "Aluguel do apê · parcela 7 de 12 · há 2 h",
      reason: null,
      unread: true,
      count: 1,
    });
  });

  it("contestação mostra o motivo, no tom de perigo", () => {
    const view = notificationView(
      item({
        type: "payment_disputed",
        metadata: { reason: "valor diferente do combinado" },
        readAt: "2026-10-02T11:00:00.000Z",
      }),
      NOW,
      "pt-BR"
    );
    expect(view).toMatchObject({
      title: "Pagamento contestado",
      tone: "danger",
      reason: "Motivo: valor diferente do combinado",
      unread: false,
    });
  });

  it("aviso sem parcela usa o e-mail do convite", () => {
    const view = notificationView(
      item({
        type: "invite_accepted",
        installmentId: null,
        installmentSequence: null,
        metadata: { email: "ana@example.com" },
        createdAt: "2026-10-01T12:00:00.000Z",
      }),
      NOW,
      "pt-BR"
    );
    expect(view.meta).toBe("Aluguel do apê · ana@example.com · ontem");
  });

  it("motivo vazio ou só com espaços não vira linha de motivo", () => {
    const view = notificationView(
      item({ type: "payment_disputed", metadata: { reason: "   " } }),
      NOW,
      "pt-BR"
    );
    expect(view.reason).toBeNull();
  });

  it("comprovante é aviso; tipo desconhecido cai no genérico", () => {
    expect(
      notificationView(item({ type: "proof_submitted" }), NOW, "pt-BR")
    ).toMatchObject({
      title: "Novo comprovante para confirmar",
      tone: "warning",
    });
    expect(
      notificationView(item({ type: "algo_novo" }), NOW, "pt-BR")
    ).toMatchObject({
      title: "Notificação",
      tone: "neutral",
    });
  });

  it("aviso de mais de uma semana diz a semana por extenso, como no mockup 10", () => {
    const view = notificationView(
      item({ createdAt: "2026-09-24T12:00:00.000Z" }),
      NOW,
      "pt-BR"
    );
    expect(view.meta).toBe("Aluguel do apê · parcela 7 de 12 · há 1 semana");
  });

  it("no idioma pedido", () => {
    expect(notificationView(item(), NOW, "en-US")).toMatchObject({
      title: "Payment confirmed",
      meta: "Aluguel do apê · installment 7 of 12 · 2 hr. ago",
    });
  });

  it("grupo: título no plural, as parcelas na meta e a contagem para o tile", () => {
    const view = notificationView(
      item({
        type: "installment_overdue_receivable",
        contractTitle: "Venda do terreno",
        installmentsCount: 60,
        count: 24,
        sequences: Array.from({ length: 24 }, (_, i) => i + 5),
      }),
      NOW,
      "pt-BR"
    );
    expect(view).toMatchObject({
      title: "24 parcelas a receber estão vencidas",
      meta: "Venda do terreno · parcelas 5 a 28 de 60 · há 2 h",
      tone: "danger",
      count: 24,
    });
  });

  it("grupo de um tipo sem plural: o título de sempre, a contagem no tile", () => {
    const view = notificationView(
      item({ type: "invite_accepted", count: 2, sequences: [] }),
      NOW,
      "pt-BR"
    );
    expect(view).toMatchObject({ title: "Convite aceito", count: 2 });
  });

  it("aonde a linha leva: um grupo abre o contrato filtrado pelo que conta; um aviso, a parcela", () => {
    expect(
      notificationTarget(item({ type: "installment_overdue", count: 3 }))
    ).toEqual({
      status: "overdue",
    });
    expect(
      notificationTarget(
        item({ type: "installment_overdue_receivable", count: 24 })
      )
    ).toEqual({ status: "overdue" });
    expect(
      notificationTarget(item({ type: "installment_paid", count: 2 }))
    ).toEqual({
      status: "paid",
    });
    expect(
      notificationTarget(item({ type: "payment_confirmed", count: 2 }))
    ).toEqual({
      status: "paid",
    });
    expect(
      notificationTarget(item({ type: "installment_due_soon", count: 2 }))
    ).toEqual({
      status: "due",
    });
    expect(
      notificationTarget(
        item({ type: "installment_due_soon_receivable", count: 2 })
      )
    ).toEqual({ status: "due" });
    // What no filter cuts opens the contract as it is.
    expect(
      notificationTarget(item({ type: "proof_submitted", count: 2 }))
    ).toEqual({});
    expect(
      notificationTarget(item({ type: "invite_accepted", count: 2 }))
    ).toEqual({});
    expect(notificationTarget(item())).toEqual({ installment: "i1" });
  });
});

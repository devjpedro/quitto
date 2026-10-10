import { describe, expect, it } from "vitest";
import {
  notificationTarget,
  notificationView,
} from "@/features/notifications/lib/notification-view";
import type { NotificationItem } from "@/features/notifications/types";
import { nb } from "./nbsp";
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
      meta: nb("Aluguel do apê~· parcela~7~de~12~· há~2~h"),
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
    expect(view.meta).toBe(nb("Aluguel do apê~· ana@example.com~· ontem"));
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
    expect(view.meta).toBe(
      nb("Aluguel do apê~· parcela~7~de~12~· há~1~semana")
    );
  });

  it("no idioma pedido", () => {
    expect(notificationView(item(), NOW, "en-US")).toMatchObject({
      title: "Payment confirmed",
      meta: nb("Aluguel do apê~· installment~7~of~12~· 2~hr.~ago"),
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
      meta: nb("Venda do terreno~· parcelas~5~a~28~de~60~· há~2~h"),
      tone: "danger",
      count: 24,
    });
  });

  it("todo grupo diz a contagem no título, para o leitor de tela ouvir quantos são", () => {
    const title = (type: string, count: number) =>
      notificationView(item({ type, count, sequences: [] }), NOW, "pt-BR")
        .title;
    expect(title("invite_accepted", 2)).toBe("2 convites aceitos");
    expect(title("invite_declined", 2)).toBe("2 convites recusados");
    expect(title("participant_left", 3)).toBe(
      "3 participantes saíram do contrato"
    );
    expect(title("algo_novo", 2)).toBe("2 notificações");
    expect(
      notificationView(
        item({ type: "invite_accepted", count: 2, sequences: [] }),
        NOW,
        "en-US"
      ).title
    ).toBe("2 invites accepted");
  });

  it("num grupo, o e-mail e o motivo de um aviso só não aparecem (leriam como de todos)", () => {
    const disputes = notificationView(
      item({
        type: "payment_disputed",
        count: 3,
        sequences: [5, 6, 7],
        metadata: { reason: "valor diferente do combinado" },
      }),
      NOW,
      "pt-BR"
    );
    expect(disputes.reason).toBeNull();
    const invites = notificationView(
      item({
        type: "invite_accepted",
        count: 2,
        installmentId: null,
        installmentSequence: null,
        sequences: [],
        metadata: { email: "ana@example.com" },
      }),
      NOW,
      "pt-BR"
    );
    expect(invites.meta).toBe(nb("Aluguel do apê~· há~2~h"));
  });

  it("o metadado só quebra onde lê bem: nenhum '·' abre linha, e os números e o tempo ficam inteiros", () => {
    const metas = [
      item(),
      item({
        contractTitle: "Venda do terreno",
        installmentsCount: 60,
        count: 24,
        sequences: Array.from({ length: 24 }, (_, i) => i + 5),
      }),
      item({ createdAt: "2026-09-29T12:00:00.000Z" }),
      item({
        type: "invite_accepted",
        installmentId: null,
        installmentSequence: null,
        sequences: [],
        metadata: { email: "ana@example.com" },
      }),
    ].map((one) => notificationView(one, NOW, "pt-BR").meta);
    for (const meta of metas) {
      // The ordinary spaces are the only places the line can break.
      for (const piece of meta.split(" ")) {
        expect(piece.startsWith("·"), meta).toBe(false);
      }
    }
    expect(metas[1]).toContain(nb("5~a~28~de~60"));
    expect(metas[2]).toContain(nb("há~3~dias"));
  });

  it("aonde a linha leva: um grupo abre o contrato sem busca; um aviso, a parcela", () => {
    for (const type of [
      "installment_overdue",
      "installment_overdue_receivable",
      "installment_paid",
      "payment_confirmed",
      "installment_due_soon",
      "installment_due_soon_receivable",
      "proof_submitted",
      "invite_accepted",
    ]) {
      expect(notificationTarget(item({ type, count: 2 }))).toEqual({});
    }
    expect(notificationTarget(item())).toEqual({ installment: "i1" });
  });
});

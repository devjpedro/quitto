import { describe, expect, it } from "vitest";
import {
  type ActionButtonKind,
  actionButtons,
  describeAction,
} from "@/features/home/lib/action-view";
import type { InstallmentAction } from "@/features/home/types";
import { installmentAction, inviteAction, TODAY } from "./home-fixtures";

const NBSP = String.fromCharCode(0xa0);
/** Writes "~" for the no-break space the installment messages keep between numbers. */
const nb = (text: string) => text.replaceAll("~", NBSP);

const ctx = { first: false, locale: "pt-BR" as const, today: TODAY };

/** "Notebook da Marina": 3 and 4 of 12 overdue since 30/08, Marina owes me. */
function marinaGroup(over: Partial<InstallmentAction> = {}) {
  return installmentAction({
    id: "overdue:nb:receive",
    kind: "overdue",
    direction: "receive",
    installmentId: "nb-3",
    contractId: "nb",
    contractTitle: "Notebook da Marina",
    sequence: 3,
    installmentsCount: 12,
    amountCents: 35_000,
    dueDate: "2026-08-30",
    counterpartyName: "Marina Pires",
    pixCode: null,
    canMarkPaid: false,
    count: 2,
    installmentIds: ["nb-3", "nb-4"],
    sequences: [3, 4],
    totalCents: 70_000,
    contract: {
      paidCount: 2,
      overdueCount: 2,
      remainingCents: 350_000,
      statuses: null,
    },
    ...over,
  });
}

const MUTATING: ReadonlySet<ActionButtonKind> = new Set<ActionButtonKind>([
  "mark_paid",
  "mark_received",
  "confirm",
  "accept",
  "decline",
]);

describe("describeAction: cartão simples", () => {
  it("primeiro cartão: tag limão, título, parcela, valor, pessoa e a legenda do contrato", () => {
    expect(
      describeAction(installmentAction(), { ...ctx, first: true })
    ).toEqual({
      tone: "highlight",
      tag: "Faça primeiro · amanhã",
      title: "Aluguel do apê",
      sequence: nb("parcela~7~de~12"),
      amountCents: 125_000,
      person: { name: "Maria Souza", text: "para Maria Souza" },
      terms: null,
      legend: { done: "6 de 12 pagas", remaining: "falta R$ 7.500,00" },
    });
  });

  it("atrasada a receber: há quantos dias, quem deve e as recebidas", () => {
    expect(
      describeAction(
        installmentAction({
          kind: "overdue",
          direction: "receive",
          dueDate: "2026-09-28",
          counterpartyName: "Carlos Lima",
        }),
        ctx
      )
    ).toMatchObject({
      tone: "danger",
      tag: "Atrasada · há 4 dias",
      person: { name: "Carlos Lima", text: "Carlos Lima te deve" },
      legend: { done: "6 de 12 recebidas" },
    });
  });

  it("vence hoje: a tag preta da ação", () => {
    expect(
      describeAction(installmentAction({ dueDate: TODAY }), ctx)
    ).toMatchObject({
      tone: "ink",
      tag: "Vence hoje",
    });
  });

  it("comprovante: de quem é; sem nome, o que fazer", () => {
    expect(
      describeAction(installmentAction({ kind: "review" }), ctx)
    ).toMatchObject({
      tone: "warning",
      tag: "Aguarda você",
      person: { name: "Maria Souza", text: "Comprovante de Maria Souza" },
    });
    expect(
      describeAction(
        installmentAction({ kind: "review", counterpartyName: null }),
        ctx
      ).person
    ).toEqual({ name: null, text: "Comprovante para conferir" });
  });

  it("contestada: quem contestou", () => {
    expect(
      describeAction(installmentAction({ kind: "disputed" }), {
        ...ctx,
        first: true,
      })
    ).toMatchObject({
      tag: "Faça primeiro · contestada",
      person: {
        name: "Maria Souza",
        text: "Maria Souza contestou o comprovante",
      },
    });
    expect(
      describeAction(
        installmentAction({ kind: "disputed", counterpartyName: null }),
        ctx
      ).person
    ).toEqual({ name: null, text: "Reenvie o comprovante" });
  });

  it("sem outra parte, a linha diz quando vence", () => {
    expect(
      describeAction(installmentAction({ counterpartyName: null }), ctx).person
    ).toEqual({ name: null, text: "Vence em 03/10" });
  });

  it("atrasada sem outra parte: em atraso desde quando, nunca 'vence em' uma data passada", () => {
    expect(
      describeAction(
        installmentAction({
          kind: "overdue",
          dueDate: "2026-09-28",
          counterpartyName: null,
        }),
        ctx
      ).person
    ).toEqual({ name: null, text: "Em atraso desde 28/09" });
  });

  it("no idioma pedido: as mensagens seguem o locale, não só as datas", () => {
    expect(
      describeAction(installmentAction(), {
        ...ctx,
        first: true,
        locale: "en-US",
      })
    ).toMatchObject({
      tag: "Do first · tomorrow",
      sequence: nb("installment~7~of~12"),
      person: { text: "to Maria Souza" },
      legend: { done: "6 of 12 paid" },
    });
    expect(
      describeAction(inviteAction(), { ...ctx, locale: "en-US" }).person
    ).toEqual({ name: "Ana", text: "Ana invited you as the payee" });
  });
});

describe("describeAction: grupo de atrasadas", () => {
  it("a receber: contagem e 'desde' na tag, o total, as parcelas e quem deve", () => {
    expect(describeAction(marinaGroup(), ctx)).toMatchObject({
      tone: "danger",
      tag: "2 atrasadas · desde 30/08",
      title: "Notebook da Marina",
      sequence: nb("parcelas~3 e 4~de~12"),
      amountCents: 70_000,
      person: {
        name: "Marina Pires",
        text: "Marina Pires te deve · desde 30/08",
      },
      legend: { done: "2 de 12 recebidas", remaining: "falta R$ 3.500,00" },
    });
    expect(describeAction(marinaGroup(), { ...ctx, first: true }).tag).toBe(
      "Faça primeiro · 2 atrasadas"
    );
  });

  it("de outro ano: o 'desde' leva o ano; a faixa vira 'a'", () => {
    const view = describeAction(
      marinaGroup({
        contractTitle: "Venda do terreno",
        installmentsCount: 60,
        dueDate: "2024-10-28",
        count: 24,
        sequences: Array.from({ length: 24 }, (_, i) => i + 5),
      }),
      ctx
    );
    expect(view.tag).toBe("24 atrasadas · desde 28/10/2024");
    expect(view.sequence).toBe(nb("parcelas~5~a~28~de~60"));
  });

  it("que você paga: para quem, desde quando", () => {
    expect(
      describeAction(
        marinaGroup({ direction: "pay", counterpartyName: "Helena Duarte" }),
        ctx
      ).person
    ).toEqual({
      name: "Helena Duarte",
      text: "para Helena Duarte · desde 30/08",
    });
  });

  it("que você paga, inteiro: a tag, as parcelas, o total e as pagas", () => {
    expect(
      describeAction(
        marinaGroup({
          id: "overdue:al:pay",
          direction: "pay",
          installmentId: "al-5",
          contractId: "al",
          sequence: 5,
          installmentIds: ["al-5", "al-6"],
          contractTitle: "Aluguel do apê",
          counterpartyName: "Maria Souza",
          dueDate: "2026-09-01",
          sequences: [5, 6],
          totalCents: 250_000,
          contract: {
            paidCount: 4,
            overdueCount: 2,
            remainingCents: 1_000_000,
            statuses: null,
          },
        }),
        { ...ctx, first: true }
      )
    ).toEqual({
      tone: "highlight",
      tag: "Faça primeiro · 2 atrasadas",
      title: "Aluguel do apê",
      sequence: nb("parcelas~5 e 6~de~12"),
      amountCents: 250_000,
      person: { name: "Maria Souza", text: "para Maria Souza · desde 01/09" },
      terms: null,
      legend: { done: "4 de 12 pagas", remaining: "falta R$ 10.000,00" },
    });
  });

  it("com lacuna: cada trecho vira faixa; com mais de 3 itens, quantas e entre quais", () => {
    const terreno = (sequences: number[]) =>
      describeAction(
        marinaGroup({
          contractTitle: "Venda do terreno",
          installmentsCount: 60,
          count: sequences.length,
          sequences,
        }),
        ctx
      ).sequence;
    expect(terreno([5, 6, 7, 8, 9, 11, 12, 13])).toBe(
      nb("parcelas~5~a~9 e 11~a~13~de~60")
    );
    expect(terreno([3, 5, 7, 9, 10, 11])).toBe(
      nb("6 parcelas entre 3~e~11~de~60")
    );
  });

  it("no idioma pedido", () => {
    expect(
      describeAction(marinaGroup(), { ...ctx, locale: "en-US" })
    ).toMatchObject({
      tag: "2 overdue · since 08/30",
      sequence: nb("installments~3 and 4~of~12"),
      person: { text: "Marina Pires owes you · since 08/30" },
      legend: { done: "2 of 12 received", remaining: "R$3,500.00 left" },
    });
    expect(
      describeAction(marinaGroup(), { ...ctx, first: true, locale: "en-US" })
        .tag
    ).toBe("Do first · 2 overdue");
    expect(
      describeAction(marinaGroup({ direction: "pay" }), {
        ...ctx,
        locale: "en-US",
      }).person
    ).toEqual({ name: "Marina Pires", text: "to Marina Pires · since 08/30" });
  });
});

describe("describeAction: grupo sem outra parte", () => {
  it("em atraso desde a mais antiga, nunca 'vence em' uma data passada", () => {
    expect(
      describeAction(marinaGroup({ counterpartyName: null }), ctx).person
    ).toEqual({
      name: null,
      text: "Em atraso desde 30/08",
    });
  });
});

describe("describeAction: convite", () => {
  it("quem convidou, o título e as condições", () => {
    expect(describeAction(inviteAction(), ctx)).toEqual({
      tone: "brand",
      tag: "Convite",
      title: "Moto da Ana",
      sequence: null,
      amountCents: null,
      person: { name: "Ana", text: "Ana te convidou como quem recebe" },
      terms: { amount: "4 parcelas de R$ 300,00", from: "a partir de 10/11" },
      legend: null,
    });
    expect(
      describeAction(inviteAction(), { ...ctx, first: true })
    ).toMatchObject({
      tone: "highlight",
      tag: "Faça primeiro · convite",
    });
  });

  it("parcelas de valores diferentes: o total; uma parcela só: no singular", () => {
    expect(
      describeAction(
        inviteAction({
          amountCents: null,
          totalCents: 100_000,
          installmentsCount: 3,
        }),
        ctx
      ).terms?.amount
    ).toBe("3 parcelas · R$ 1.000,00 no total");
    expect(
      describeAction(
        inviteAction({ installmentsCount: 1, amountCents: 50_000 }),
        ctx
      ).terms?.amount
    ).toBe("1 parcela de R$ 500,00");
  });
});

describe("actionButtons", () => {
  it("pagar: PIX + Já paguei sem confirmação; só PIX (ou comprovante) com confirmação", () => {
    expect(actionButtons(installmentAction())).toEqual(["pix", "mark_paid"]);
    expect(actionButtons(installmentAction({ pixCode: null }))).toEqual([
      "mark_paid",
    ]);
    expect(actionButtons(installmentAction({ canMarkPaid: false }))).toEqual([
      "pix",
    ]);
    expect(
      actionButtons(installmentAction({ canMarkPaid: false, pixCode: null }))
    ).toEqual(["send_proof"]);
  });

  it("receber: WhatsApp, e Marcar como recebida só quando a API deixa", () => {
    expect(actionButtons(installmentAction({ direction: "receive" }))).toEqual([
      "whatsapp",
      "mark_received",
    ]);
    expect(
      actionButtons(
        installmentAction({ direction: "receive", canMarkPaid: false })
      )
    ).toEqual(["whatsapp"]);
  });

  it("conferir, contestada e convite", () => {
    expect(
      actionButtons(installmentAction({ kind: "review", canConfirm: true }))
    ).toEqual(["review", "confirm"]);
    expect(actionButtons(installmentAction({ kind: "review" }))).toEqual([
      "review",
    ]);
    expect(actionButtons(installmentAction({ kind: "disputed" }))).toEqual([
      "resend_proof",
    ]);
    expect(actionButtons(inviteAction())).toEqual(["accept", "decline"]);
  });

  it("grupo: quem recebe cobra e vê as parcelas; quem paga paga a mais antiga e vê as parcelas", () => {
    expect(actionButtons(marinaGroup())).toEqual([
      "whatsapp",
      "see_installments",
    ]);
    expect(actionButtons(marinaGroup({ direction: "pay" }))).toEqual([
      "pay_oldest",
      "see_installments",
    ]);
  });

  it("um grupo só tem links: nenhum botão dele dispara mutação", () => {
    for (const group of [marinaGroup(), marinaGroup({ direction: "pay" })]) {
      expect(actionButtons(group).some((kind) => MUTATING.has(kind))).toBe(
        false
      );
    }
  });
});

import { describe, expect, it } from "vitest";
import { actionButtons, describeAction } from "@/features/home/lib/action-view";
import { installmentAction, inviteAction, TODAY } from "./home-fixtures";

const ctx = { first: false, locale: "pt-BR" as const, today: TODAY };

describe("describeAction", () => {
  it("primeiro cartão: tag limão 'Faça primeiro' com quando vence, e para quem paga", () => {
    expect(
      describeAction(installmentAction(), { ...ctx, first: true })
    ).toEqual({
      tone: "highlight",
      tag: "Faça primeiro · amanhã",
      meta: "Aluguel do apê · 7/12",
      detail: "para Maria Souza",
    });
  });

  it("atrasada a receber: tag de perigo com há quantos dias e quem deve", () => {
    const view = describeAction(
      installmentAction({
        kind: "overdue",
        direction: "receive",
        dueDate: "2026-09-28",
        counterpartyName: "Carlos",
      }),
      ctx
    );
    expect(view).toMatchObject({
      tone: "danger",
      tag: "Atrasada · há 4 dias",
      detail: "Carlos te deve",
    });
  });

  it("comprovante para conferir e contestada", () => {
    expect(
      describeAction(installmentAction({ kind: "review" }), ctx)
    ).toMatchObject({
      tone: "warning",
      tag: "Aguarda você",
      detail: "Comprovante para conferir",
    });
    expect(
      describeAction(installmentAction({ kind: "disputed" }), {
        ...ctx,
        first: true,
      })
    ).toMatchObject({
      tag: "Faça primeiro · contestada",
      detail: "Reenvie o comprovante",
    });
  });

  it("sem outra parte, a linha de baixo diz quando vence", () => {
    expect(
      describeAction(installmentAction({ counterpartyName: null }), ctx).detail
    ).toBe("Vence em 03/10");
  });

  it("convite: quem convidou e para qual papel", () => {
    expect(describeAction(inviteAction(), { ...ctx, first: true })).toEqual({
      tone: "highlight",
      tag: "Faça primeiro · convite",
      meta: "Ana te convidou como quem recebe",
      detail: null,
    });
    expect(describeAction(inviteAction(), ctx).tone).toBe("brand");
  });

  it("no idioma pedido: as mensagens seguem o locale, não só as datas", () => {
    expect(
      describeAction(installmentAction(), {
        ...ctx,
        first: true,
        locale: "en-US",
      })
    ).toEqual({
      tone: "highlight",
      tag: "Do first · tomorrow",
      meta: "Aluguel do apê · 7/12",
      detail: "to Maria Souza",
    });
    expect(
      describeAction(inviteAction(), { ...ctx, locale: "en-US" }).meta
    ).toBe("Ana invited you as the payee");
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
});

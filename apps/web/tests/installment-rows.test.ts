import { describe, expect, it } from "vitest";
import { rowView } from "@/features/contracts/lib/installment-row-view";
import { motoDetail } from "./contract-fixtures";

const TODAY = "2026-10-05";
const ctx = {
  today: TODAY,
  perspective: "receive" as const,
  settled: false,
  otherFirstName: "Rafael",
  locale: "pt-BR" as const,
};
describe("rowView (uma vez por tela)", () => {
  const [p1, , p3, p4, p5] = motoDetail().installments;

  it("parcela em aberto: sem tag, só 'em N dias' até 62 dias; longe, nada", () => {
    expect(rowView(p5 as never, ctx)).toMatchObject({
      tag: null,
      meta: "em 25 dias",
      title: "30 de outubro",
    });
    const far = { ...(p5 as object), dueDate: "2027-01-30" };
    expect(rowView(far as never, ctx)).toMatchObject({
      tag: null,
      meta: null,
      title: "30 de janeiro de 2027",
    });
  });

  it("atrasada: 'Atrasada · 36 dias' em danger, sem metadado", () => {
    expect(rowView(p3 as never, ctx)).toMatchObject({
      tile: "overdue",
      tag: { tone: "danger", text: "Atrasada · 36 dias" },
      meta: null,
    });
  });

  it("comprovante: quem recebe confere; quem paga espera o outro; o espectador vê 'Comprovante enviado'", () => {
    expect(rowView(p4 as never, ctx).tag?.text).toBe("Conferir comprovante");
    expect(
      rowView(p4 as never, {
        ...ctx,
        perspective: "pay",
        otherFirstName: "João",
      }).tag?.text
    ).toBe("Aguardando João");
    expect(
      rowView(p4 as never, { ...ctx, perspective: "view" }).tag?.text
    ).toBe("Comprovante enviado");
  });

  it("quitado: nenhuma tag, 'recebida' no nome acessível, e a data só quando chegou depois", () => {
    const late = {
      ...(p1 as object),
      dueDate: "2026-04-15",
      status: "paid",
      paidAt: "2026-04-22T15:00:00Z",
    };
    expect(rowView(late as never, { ...ctx, settled: true })).toMatchObject({
      tag: null,
      srState: "recebida",
      meta: "recebida em 22/04 · 7 dias depois",
      muted: true,
    });
    const onTime = { ...late, paidAt: "2026-04-15T15:00:00Z" };
    expect(rowView(onTime as never, { ...ctx, settled: true }).meta).toBeNull();
  });
  it("vence hoje: tag ink 'Vence hoje' sem ícone, e sem metadado", () => {
    const today = { ...(p5 as object), dueDate: TODAY };
    expect(rowView(today as never, ctx)).toMatchObject({
      tag: { tone: "ink", icon: null, text: "Vence hoje" },
      meta: null,
    });
  });

  it("contestada: o tile é de atraso e a tag é danger com o x", () => {
    const disputed = { ...(p5 as object), status: "disputed" };
    expect(rowView(disputed as never, ctx)).toMatchObject({
      tile: "overdue",
      tag: { tone: "danger", icon: "x", text: "Contestada" },
    });
  });

  it("amanhã: o metadado é 'amanhã', não 'em 1 dia'", () => {
    const tomorrow = { ...(p5 as object), dueDate: "2026-10-06" };
    expect(rowView(tomorrow as never, ctx).meta).toBe("amanhã");
  });

  it("atrasada: 1 dia no singular; passando de 60 dias, só 'Atrasada' (o grupo diz desde quando)", () => {
    const one = { ...(p5 as object), dueDate: "2026-10-04" };
    expect(rowView(one as never, ctx).tag?.text).toBe("Atrasada · 1 dia");
    const sixty = { ...(p5 as object), dueDate: "2026-08-06" };
    expect(rowView(sixty as never, ctx).tag?.text).toBe("Atrasada · 60 dias");
    const long = { ...(p5 as object), dueDate: "2026-08-05" };
    expect(rowView(long as never, ctx).tag?.text).toBe("Atrasada");
  });

  it("quitado de quem paga: 'paga' no nome acessível e 'paga em …' no metadado", () => {
    const paid = {
      ...(p1 as object),
      dueDate: "2026-04-15",
      status: "paid",
      paidAt: "2026-04-22T15:00:00Z",
    };
    expect(
      rowView(paid as never, { ...ctx, perspective: "pay", settled: true })
    ).toMatchObject({
      srState: "paga",
      meta: "paga em 22/04 · 7 dias depois",
      tag: null,
    });
  });
});

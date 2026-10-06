import { describe, expect, it } from "vitest";
import { rowView } from "@/features/contracts/lib/installment-row-view";
import { groupInstallmentRows } from "@/features/contracts/lib/installment-rows";
import { motoDetail } from "./contract-fixtures";

const TODAY = "2026-10-05";
const ctx = {
  today: TODAY,
  perspective: "receive" as const,
  settled: false,
  otherFirstName: "Rafael",
  locale: "pt-BR" as const,
};
type Row = ReturnType<typeof groupInstallmentRows>[number];
const shape = (rows: Row[]) =>
  rows.map((r) =>
    r.kind === "one"
      ? r.installment.sequence
      : `${r.group}:${r.installments.map((i) => i.sequence).join(",")}`
  );

function make(
  n: number,
  status: (seq: number) => string,
  due: (seq: number) => string
) {
  return Array.from({ length: n }, (_, i) => ({
    id: `i${i + 1}`,
    sequence: i + 1,
    amountCents: 1000,
    dueDate: due(i + 1),
    status: status(i + 1),
    paidAt: null,
  }));
}

describe("groupInstallmentRows", () => {
  it("a Moto: as pagas do começo (2) viram uma linha; a atrasada sozinha e o resto, uma por uma", () => {
    expect(
      shape(groupInstallmentRows(motoDetail().installments, TODAY, false))
    ).toEqual(["paid:1,2", 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("uma paga só no começo não agrupa; atrasadas seguidas, a partir de 2, agrupam", () => {
    const items = make(
      5,
      (s) => (s === 1 ? "paid" : "pending"),
      (s) => `2026-0${s + 4}-10`
    );
    // Due 05/10, 06/10 … 09/10 (day 10 of each month); on 05/09 the 5th (10/09) is still ahead.
    expect(shape(groupInstallmentRows(items, "2026-09-05", false))).toEqual([
      1,
      "overdue:2,3,4",
      5,
    ]);
  });

  it("todas pagas sem estar quitado não acontece; quitado lista uma por uma (registro)", () => {
    const items = make(
      10,
      () => "paid",
      (s) => `2026-${String(s).padStart(2, "0")}-15`
    );
    expect(shape(groupInstallmentRows(items, TODAY, true))).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it("acima de 24: depois das 3 próximas em aberto, o resto vira a cauda", () => {
    const items = make(
      60,
      (s) => (s <= 4 ? "paid" : "pending"),
      (s) => (s <= 28 ? "2025-01-30" : "2027-01-30")
    );
    expect(shape(groupInstallmentRows(items, TODAY, false))).toEqual([
      "paid:1,2,3,4",
      `overdue:${Array.from({ length: 24 }, (_, i) => i + 5).join(",")}`,
      29,
      30,
      31,
      `tail:${Array.from({ length: 29 }, (_, i) => i + 32).join(",")}`,
    ]);
  });

  it("exatamente 24 parcelas: sem cauda", () => {
    const items = make(
      24,
      () => "pending",
      () => "2027-01-30"
    );
    expect(
      groupInstallmentRows(items, TODAY, false).every((r) => r.kind === "one")
    ).toBe(true);
  });
});

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

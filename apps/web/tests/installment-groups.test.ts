import { describe, expect, it } from "vitest";
import { groupInstallments } from "@/features/installments/lib/installment-groups";
import { listInstallment } from "./installments-fixtures";

const TODAY = "2026-10-08";
const group = (
  items: ReturnType<typeof listInstallment>[],
  options: Partial<Parameters<typeof groupInstallments>[1]> = {}
) => groupInstallments(items, { month: "2026-10", today: TODAY, ...options });
const ids = (r: ReturnType<typeof group>) => r.groups.map((g) => g.id);

describe("groupInstallments", () => {
  it("o mês corrente: a atrasada de setembro no grupo Atrasadas", () => {
    const r = group([listInstallment({ dueDate: "2026-09-05" })]);
    expect(ids(r)).toEqual(["overdue"]);
  });

  it("a vencida com comprovante vai para Aguardando e não entra na soma das Atrasadas", () => {
    const r = group([
      listInstallment({
        dueDate: "2026-10-03",
        status: "awaiting_confirmation",
        amountCents: 48_000,
      }),
      listInstallment({ dueDate: "2026-10-06", amountCents: 10_000 }),
    ]);
    expect(ids(r)).toEqual(["overdue", "awaiting"]);
    expect(r.groups[0]?.payCents).toBe(10_000);
  });

  it("esta semana atravessa o mês: em 29/10, a parcela de 02/11 entra em Esta semana de outubro", () => {
    const r = groupInstallments(
      [
        listInstallment({ dueDate: "2026-11-02" }),
        listInstallment({ dueDate: "2026-11-20" }),
      ],
      { month: "2026-10", today: "2026-10-29" }
    );
    expect(ids(r)).toEqual(["week"]);
    expect(r.groups[0]?.items).toHaveLength(1);
  });

  it("hoje entra em Esta semana", () => {
    expect(ids(group([listInstallment({ dueDate: TODAY })]))).toEqual(["week"]);
  });

  it("a paga de novembro que veio pela ponta da semana não aparece em outubro", () => {
    const r = groupInstallments(
      [listInstallment({ dueDate: "2026-11-02", status: "paid" })],
      { month: "2026-10", today: "2026-10-29" }
    );
    expect(r.groups).toEqual([]);
  });

  it("somas por direção, nunca juntas", () => {
    const r = group([
      listInstallment({
        dueDate: "2026-10-20",
        direction: "pay",
        amountCents: 100,
      }),
      listInstallment({
        dueDate: "2026-10-21",
        direction: "receive",
        amountCents: 250,
      }),
    ]);
    expect(r.groups[0]).toMatchObject({ payCents: 100, receiveCents: 250 });
  });

  it("filtro Aguardando pega a que espera confirmação em qualquer grupo; as contagens não mudam com o filtro", () => {
    const items = [
      listInstallment({
        dueDate: "2026-10-20",
        status: "awaiting_confirmation",
      }),
      listInstallment({
        dueDate: "2026-10-03",
        status: "awaiting_confirmation",
      }),
      listInstallment({ dueDate: "2026-10-04" }),
    ];
    const filtered = group(items, { filter: "awaiting" });
    expect(filtered.groups.flatMap((g) => g.items)).toHaveLength(2);
    expect(filtered.counts).toEqual(group(items).counts);
    expect(filtered.counts).toEqual({ awaiting: 2, overdue: 1 });
  });

  it("filtro A receber esconde as de pagar", () => {
    const r = group(
      [
        listInstallment({ dueDate: "2026-10-20", direction: "pay" }),
        listInstallment({ dueDate: "2026-10-21", direction: "receive" }),
      ],
      { filter: "receive" }
    );
    expect(r.groups.flatMap((g) => g.items.map((i) => i.direction))).toEqual([
      "receive",
    ]);
  });

  it("grupo vazio some; as atrasadas do mesmo contrato não se agrupam: uma linha cada, e o chip as conta", () => {
    const r = group([
      listInstallment({ contractId: "m", dueDate: "2026-09-05", sequence: 3 }),
      listInstallment({ contractId: "m", dueDate: "2026-10-05", sequence: 4 }),
      listInstallment({ contractId: "x", dueDate: "2026-10-06" }),
    ]);
    expect(ids(r)).toEqual(["overdue"]);
    expect(r.groups[0]?.lines.map((l) => l.items.length)).toEqual([1, 1, 1]);
    expect(r.counts.overdue).toBe(3);
  });

  it("pagas do mês no grupo Pagas, depois dos outros", () => {
    const r = group([
      listInstallment({ dueDate: "2026-10-02", status: "confirmed" }),
      listInstallment({ dueDate: "2026-10-20" }),
    ]);
    expect(ids(r)).toEqual(["month", "paid"]);
  });
});

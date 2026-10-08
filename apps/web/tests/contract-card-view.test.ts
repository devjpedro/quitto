import { describe, expect, it } from "vitest";
import { contractCardView } from "@/features/contracts/lib/contract-card-view";
import { listItem } from "./contracts-fixtures";

const TODAY = "2026-10-08";
const view = (overrides: Parameters<typeof listItem>[0]) =>
  contractCardView(listItem(overrides), TODAY, "pt-BR");

describe("contractCardView", () => {
  it("quitado: terminou em, tag Quitado", () => {
    const v = view({ settled: true, endDate: "2026-08-10", remainingCents: 0 });
    expect(v.footer).toBe("Terminou em ago/2026");
    expect(v.tags.map((t) => t.label)).toEqual(["Quitado"]);
    expect(v.percent).toBe(100);
  });

  it("atrasada: parcela, desde, tag Atrasada", () => {
    const v = view({
      oldestOverdue: { sequence: 4, dueDate: "2026-09-10" },
      overdueCount: 1,
      statuses: ["paid", "paid", "paid", "overdue", "open", "open"],
    });
    expect(v.footer).toBe("Parcela 4 · desde 10/09");
    expect(v.tags.map((t) => t.label)).toEqual(["Atrasada"]);
  });

  it("duas atrasadas seguidas: parcelas 3 e 4, 2 atrasadas", () => {
    const v = view({
      oldestOverdue: { sequence: 3, dueDate: "2026-09-05" },
      overdueCount: 2,
      statuses: ["paid", "paid", "overdue", "overdue", "open", "open"],
    });
    expect(v.footer).toBe("Parcelas 3 e 4 · desde 05/09");
    expect(v.tags.map((t) => t.label)).toEqual(["2 atrasadas"]);
  });

  it("atrasada com comprovante: duas tags, a curta para quem recebe", () => {
    const v = view({
      direction: "receive",
      oldestOverdue: { sequence: 3, dueDate: "2026-09-03" },
      overdueCount: 1,
      reviewCount: 1,
    });
    expect(v.tags.map((t) => t.label)).toEqual(["Atrasada", "Conferir"]);
  });

  it("comprovante sozinho: o texto inteiro; quem paga vê Comprovante enviado", () => {
    expect(
      view({ direction: "receive", reviewCount: 1 }).tags.map((t) => t.label)
    ).toEqual(["Conferir comprovante"]);
    expect(view({ reviewCount: 1 }).tags.map((t) => t.label)).toEqual([
      "Comprovante enviado",
    ]);
  });

  it("contestada", () => {
    const v = view({
      disputedCount: 1,
      next: {
        sequence: 4,
        dueDate: "2026-10-20",
        amountCents: 1,
        status: "disputed",
      },
    });
    expect(v.tags.map((t) => t.label)).toEqual(["Contestada"]);
    expect(v.footer).toBe("Parcela 4 · 20/10");
  });

  it("vence hoje: parcela n de total", () => {
    const v = view({
      next: { sequence: 7, dueDate: TODAY, amountCents: 1, status: "pending" },
      installmentsCount: 10,
    });
    expect(v.footer).toBe("Parcela 7 de 10");
    expect(v.tags.map((t) => t.label)).toEqual(["Vence hoje"]);
  });

  it("em dia: próxima em; a última parcela diz última", () => {
    expect(view({}).footer).toBe("Próxima em 10/10");
    expect(view({}).tags.map((t) => t.label)).toEqual(["Em dia"]);
    const last = view({
      next: {
        sequence: 6,
        dueDate: "2026-10-18",
        amountCents: 1,
        status: "pending",
      },
    });
    expect(last.footer).toBe("Última parcela em 18/10");
  });

  it("o % nunca é 100 sem estar quitado (99,6 → 99)", () => {
    expect(view({ percent: 100 }).percent).toBe(99);
    expect(view({ percent: 50 }).percent).toBe(50);
  });

  it("a segunda célula: Mensal, Parcela ou Total", () => {
    expect(view({}).cells[1].label).toBe("Mensal");
    expect(view({ monthly: false }).cells[1].label).toBe("Parcela");
    expect(view({ installmentAmountCents: null }).cells[1].label).toBe("Total");
  });

  it("no quitado, a terceira célula é o Total", () => {
    const v = view({ settled: true, endDate: "2026-08-10" });
    expect(v.cells[2]).toMatchObject({ label: "Total", cents: 600_000 });
    expect(view({}).cells[2].label).toBe("Falta");
  });

  it("o papel: paga, recebe e acompanha", () => {
    expect(view({}).role.label).toBe("Você paga");
    expect(view({ direction: "receive" }).role.label).toBe("Você recebe");
    expect(view({ direction: null }).role.label).toBe("Você acompanha");
    expect(view({ direction: null }).percentLabel).toBe("quitado");
  });
});

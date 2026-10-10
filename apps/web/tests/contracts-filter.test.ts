import { describe, expect, it } from "vitest";
import { contractsFilter } from "@/features/contracts/lib/contracts-filter";
import { listItem } from "./contracts-fixtures";

const OVERDUE = { sequence: 2, dueDate: "2026-09-05" };

describe("contractsFilter", () => {
  it("Concluídos = settled ou completed; cancelled em lugar nenhum", () => {
    const items = [
      listItem({ id: "a" }),
      listItem({ id: "b", settled: true, remainingCents: 0 }),
      listItem({ id: "c", status: "completed" }),
      listItem({ id: "d", status: "cancelled" }),
    ];
    const active = contractsFilter(items, {});
    expect(active.cards.map((c) => c.id)).toEqual(["a"]);
    expect(active.counts).toEqual({ active: 1, done: 2 });
    const done = contractsFilter(items, { show: "done" });
    expect(done.cards.map((c) => c.id).sort()).toEqual(["b", "c"]);
  });

  it("totais só dos ativos e do lado filtrado", () => {
    const items = [
      listItem({ id: "a", direction: "pay", remainingCents: 100 }),
      listItem({ id: "b", direction: "receive", remainingCents: 250 }),
      listItem({
        id: "c",
        direction: "receive",
        settled: true,
        remainingCents: 0,
      }),
    ];
    expect(contractsFilter(items, {}).totals).toEqual({
      payCents: 100,
      receiveCents: 250,
    });
    expect(contractsFilter(items, { side: "receive" }).totals).toEqual({
      payCents: 0,
      receiveCents: 250,
    });
  });

  it("o acompanhado só em Todos e fora dos totais", () => {
    const items = [
      listItem({ id: "a", direction: "pay", remainingCents: 100 }),
      listItem({ id: "v", direction: null, remainingCents: 999 }),
    ];
    const all = contractsFilter(items, {});
    expect(all.cards).toHaveLength(2);
    expect(all.totals).toEqual({ payCents: 100, receiveCents: 0 });
    expect(contractsFilter(items, { side: "pay" }).cards).toHaveLength(1);
  });

  it("as contagens dos segmentos respeitam o lado", () => {
    const items = [
      listItem({ id: "a", direction: "pay" }),
      listItem({ id: "b", direction: "receive" }),
      listItem({ id: "c", direction: "receive", settled: true }),
    ];
    expect(contractsFilter(items, { side: "receive" }).counts).toEqual({
      active: 1,
      done: 1,
    });
  });

  it("Ativos: atrasados primeiro, depois a próxima data", () => {
    const items = [
      listItem({
        id: "later",
        next: {
          sequence: 1,
          dueDate: "2026-11-01",
          amountCents: 1,
          status: "pending",
        },
      }),
      listItem({
        id: "soon",
        next: {
          sequence: 1,
          dueDate: "2026-10-09",
          amountCents: 1,
          status: "pending",
        },
      }),
      listItem({ id: "late", oldestOverdue: OVERDUE }),
    ];
    expect(contractsFilter(items, {}).cards.map((c) => c.id)).toEqual([
      "late",
      "soon",
      "later",
    ]);
  });
});

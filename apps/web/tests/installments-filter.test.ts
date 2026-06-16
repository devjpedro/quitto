import { describe, expect, it } from "vitest";
import {
  countByFilter,
  filterInstallments,
} from "../src/lib/installments-filter";

const TODAY = "2026-06-15";

// Cobre cada bucket: pagas (paid/confirmed), a pagar (pending/awaiting/disputed),
// atrasada (vencida + não paga + não awaiting).
const items = [
  { id: "a", dueDate: "2026-01-10", status: "paid" }, // paga
  { id: "b", dueDate: "2026-02-10", status: "confirmed" }, // paga
  { id: "c", dueDate: "2026-05-10", status: "pending" }, // atrasada (passada, não paga)
  { id: "d", dueDate: "2026-07-10", status: "pending" }, // a pagar, futura (não atrasada)
  { id: "e", dueDate: "2026-04-10", status: "awaiting_confirmation" }, // a pagar, NÃO atrasada
  { id: "f", dueDate: "2026-03-10", status: "disputed" }, // atrasada (passada, não paga, não awaiting)
];

function ids(list: { id: string }[]) {
  return list.map((x) => x.id);
}

describe("filterInstallments", () => {
  it("all → todos", () => {
    expect(ids(filterInstallments(items, "all", TODAY))).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
    ]);
  });

  it("paid → só pagas", () => {
    expect(ids(filterInstallments(items, "paid", TODAY))).toEqual(["a", "b"]);
  });

  it("due → tudo que não está pago", () => {
    expect(ids(filterInstallments(items, "due", TODAY))).toEqual([
      "c",
      "d",
      "e",
      "f",
    ]);
  });

  it("overdue → vencidas, não pagas e não awaiting", () => {
    expect(ids(filterInstallments(items, "overdue", TODAY))).toEqual([
      "c",
      "f",
    ]);
  });
});

describe("countByFilter", () => {
  it("conta cada bucket", () => {
    expect(countByFilter(items, TODAY)).toEqual({
      all: 6,
      due: 4,
      overdue: 2,
      paid: 2,
    });
  });

  it("invariante: due + paid === all", () => {
    const c = countByFilter(items, TODAY);
    expect(c.due + c.paid).toBe(c.all);
  });

  it("invariante: overdue ⊆ due", () => {
    const c = countByFilter(items, TODAY);
    expect(c.overdue).toBeLessThanOrEqual(c.due);
  });
});

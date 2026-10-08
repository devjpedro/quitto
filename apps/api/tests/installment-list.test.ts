import { describe, expect, it } from "bun:test";
import type {
  HomeContractRow,
  HomeInstallmentRow,
  PartyContract,
} from "../src/lib/home-parties";
import { listInstallments } from "../src/lib/installment-list";

const TODAY = "2026-10-15";

function inst(
  over: Partial<HomeInstallmentRow> & { id: string; sequence: number }
): HomeInstallmentRow {
  return {
    contractId: "c1",
    amountCents: 10_000,
    dueDate: "2026-10-20",
    status: "pending",
    paidAt: null,
    lastProofAt: null,
    ...over,
  };
}

function party(
  id: string,
  title: string,
  direction: "pay" | "receive",
  installments: HomeInstallmentRow[]
): PartyContract {
  return {
    contract: {
      id,
      title,
      installmentsCount: installments.length,
    } as HomeContractRow,
    direction,
    counterpartyName: "Carla Nunes",
    installments: installments.map((i) => ({ ...i, contractId: id })),
  } as PartyContract;
}

const NO_FILTER = { pastDue: false };

describe("listInstallments", () => {
  const p = party("c1", "Moto", "pay", [
    inst({ id: "a", sequence: 1, dueDate: "2026-10-01" }),
    inst({ id: "b", sequence: 2, dueDate: "2026-10-31" }),
    inst({ id: "c", sequence: 3, dueDate: "2026-11-01" }),
  ]);

  it("a janela inclui from e to; sem limites, tudo", () => {
    const ids = (f: object) =>
      listInstallments([p], { ...NO_FILTER, ...f }, TODAY).map(
        (i) => i.installmentId
      );
    expect(ids({})).toEqual(["a", "b", "c"]);
    expect(ids({ from: "2026-10-01", to: "2026-10-31" })).toEqual(["a", "b"]);
    expect(ids({ from: "2026-10-02", to: "2026-10-30" })).toEqual([]);
    expect(ids({ to: "2026-10-01" })).toEqual(["a"]);
  });

  it("pastDue=include traz as não pagas antes de from, e só elas", () => {
    const q = party("c1", "Moto", "pay", [
      inst({ id: "paid", sequence: 1, dueDate: "2026-09-05", status: "paid" }),
      inst({ id: "late", sequence: 2, dueDate: "2026-09-10" }),
      inst({
        id: "proof",
        sequence: 3,
        dueDate: "2026-09-20",
        status: "awaiting_confirmation",
      }),
      inst({ id: "oct", sequence: 4, dueDate: "2026-10-10" }),
      inst({ id: "nov", sequence: 5, dueDate: "2026-11-10" }),
    ]);
    const f = { from: "2026-10-01", to: "2026-10-31" };
    expect(
      listInstallments([q], { ...f, pastDue: true }, TODAY).map(
        (i) => i.installmentId
      )
    ).toEqual(["late", "proof", "oct"]);
    expect(
      listInstallments([q], { ...f, pastDue: false }, TODAY).map(
        (i) => i.installmentId
      )
    ).toEqual(["oct"]);
    // Without `from` it does nothing.
    expect(
      listInstallments([q], { pastDue: true, to: "2026-09-12" }, TODAY).map(
        (i) => i.installmentId
      )
    ).toEqual(["paid", "late"]);
  });

  it("status overdue inclui a contestada vencida e exclui a que espera confirmação", () => {
    const q = party("c1", "Moto", "receive", [
      inst({ id: "late", sequence: 1, dueDate: "2026-10-01" }),
      inst({
        id: "disputed",
        sequence: 2,
        dueDate: "2026-10-02",
        status: "disputed",
      }),
      inst({
        id: "proof",
        sequence: 3,
        dueDate: "2026-10-03",
        status: "awaiting_confirmation",
      }),
    ]);
    const ids = (status: "overdue" | "awaiting") =>
      listInstallments([q], { ...NO_FILTER, status }, TODAY).map(
        (i) => i.installmentId
      );
    expect(ids("overdue")).toEqual(["late", "disputed"]);
    expect(ids("awaiting")).toEqual(["proof"]);
  });

  it("status open: não paga e não atrasada; status paid: paid e confirmed", () => {
    const q = party("c1", "Moto", "pay", [
      inst({ id: "late", sequence: 1, dueDate: "2026-10-01" }),
      inst({ id: "today", sequence: 2, dueDate: TODAY }),
      inst({ id: "future", sequence: 3, dueDate: "2026-12-01" }),
      inst({
        id: "proof",
        sequence: 4,
        dueDate: "2026-10-01",
        status: "awaiting_confirmation",
      }),
      inst({ id: "p", sequence: 5, status: "paid" }),
      inst({ id: "k", sequence: 6, status: "confirmed" }),
    ]);
    const ids = (status: "open" | "paid") =>
      listInstallments([q], { ...NO_FILTER, status }, TODAY).map(
        (i) => i.installmentId
      );
    expect(ids("open")).toEqual(["proof", "today", "future"]);
    expect(ids("paid")).toEqual(["p", "k"]);
  });

  it("direction filtra pelo lado", () => {
    const pay = party("c1", "Moto", "pay", [inst({ id: "x", sequence: 1 })]);
    const receive = party("c2", "Bike", "receive", [
      inst({ id: "y", sequence: 1 }),
    ]);
    const ids = (direction: "pay" | "receive") =>
      listInstallments([pay, receive], { ...NO_FILTER, direction }, TODAY).map(
        (i) => i.installmentId
      );
    expect(ids("pay")).toEqual(["x"]);
    expect(ids("receive")).toEqual(["y"]);
  });

  it("ordem: data, depois título, depois sequência", () => {
    const a = party("c1", "Zebra", "pay", [
      inst({ id: "z1", sequence: 1, dueDate: "2026-10-20" }),
      inst({ id: "z2", sequence: 2, dueDate: "2026-10-10" }),
    ]);
    const b = party("c2", "água", "receive", [
      inst({ id: "a1", sequence: 1, dueDate: "2026-10-20" }),
      inst({ id: "a2", sequence: 2, dueDate: "2026-10-20" }),
    ]);
    expect(
      listInstallments([a, b], NO_FILTER, TODAY).map((i) => i.installmentId)
    ).toEqual(["z2", "a1", "a2", "z1"]);
  });
});

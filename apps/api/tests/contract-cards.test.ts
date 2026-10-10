import { describe, expect, it } from "bun:test";
import { contractCards } from "../src/lib/contract-cards";
import type { ContractRows } from "../src/lib/contract-rows";
import type { HomeInstallmentRow } from "../src/lib/home-parties";

const ME = "u-me";
const OTHER = "u-other";
const WATCHER = "u-watcher";
const TODAY = "2026-10-03";

function inst(
  over: Partial<HomeInstallmentRow> & { id: string; sequence: number }
): HomeInstallmentRow {
  return {
    contractId: "c1",
    amountCents: 30_000,
    dueDate: "2026-10-30",
    status: "pending",
    paidAt: null,
    lastProofAt: null,
    ...over,
  };
}

function rows(
  installments: HomeInstallmentRow[],
  over: Partial<ContractRows["contracts"][number]> = {}
): ContractRows {
  return {
    accounts: [],
    invites: [],
    contracts: [
      {
        id: "c1",
        title: "Moto do Rafa",
        description: null,
        monthlyAmountCents: null,
        ownerId: OTHER,
        ownerRole: "seller",
        requiresConfirmation: true,
        status: "active",
        installmentsCount: installments.length,
        createdAt: new Date("2026-09-01T12:00:00Z"),
        ...over,
      },
    ],
    installments,
    participants: [
      {
        id: "p1",
        contractId: "c1",
        displayName: "Joana Lima",
        role: "seller",
        linkedUserId: OTHER,
        pixKey: null,
      },
      {
        id: "p2",
        contractId: "c1",
        displayName: "João Souza",
        role: "buyer",
        linkedUserId: ME,
        pixKey: null,
      },
      {
        id: "p3",
        contractId: "c1",
        displayName: "Marcos",
        role: "viewer",
        linkedUserId: WATCHER,
        pixKey: null,
      },
    ],
    users: [{ id: OTHER, name: "Joana Lima", pixKey: null }],
  };
}

const three = [
  inst({ id: "a", sequence: 1, status: "confirmed", dueDate: "2026-08-30" }),
  inst({ id: "b", sequence: 2, dueDate: "2026-09-30" }),
  inst({ id: "c", sequence: 3 }),
];

describe("contractCards", () => {
  it("pay, receive e quem acompanha: direction e counterpartyName de cada um", () => {
    const r = rows(three);
    const [asBuyer] = contractCards(ME, r, TODAY);
    expect(asBuyer).toMatchObject({
      direction: "pay",
      counterpartyName: "Joana Lima",
    });
    const [asSeller] = contractCards(OTHER, r, TODAY);
    expect(asSeller).toMatchObject({
      direction: "receive",
      counterpartyName: "João Souza",
    });
    const [asViewer] = contractCards(WATCHER, r, TODAY);
    expect(asViewer?.direction).toBeNull();
    expect(asViewer?.counterpartyName).toBeNull();
  });

  it("remainingCents e paidCount pelos pagos; settled só com tudo pago", () => {
    const [card] = contractCards(
      ME,
      rows([
        ...three.slice(0, 2),
        inst({ id: "c", sequence: 3, status: "awaiting_confirmation" }),
      ]),
      TODAY
    );
    expect(card).toMatchObject({
      paidCount: 1,
      remainingCents: 60_000,
      settled: false,
      reviewCount: 1,
    });
    const [done] = contractCards(
      ME,
      rows(three.map((i) => ({ ...i, status: "paid" }))),
      TODAY
    );
    expect(done).toMatchObject({
      paidCount: 3,
      remainingCents: 0,
      settled: true,
    });
  });

  it("next é a primeira não paga pela data, mesmo com sequência maior", () => {
    const [card] = contractCards(
      ME,
      rows([
        inst({ id: "a", sequence: 1, dueDate: "2026-11-30" }),
        inst({ id: "b", sequence: 2, dueDate: "2026-10-15" }),
      ]),
      TODAY
    );
    expect(card?.next).toEqual({
      sequence: 2,
      dueDate: "2026-10-15",
      amountCents: 30_000,
      status: "pending",
    });
    expect(card?.endDate).toBe("2026-11-30");
  });

  it("next null e settled true no quitado", () => {
    const [card] = contractCards(
      ME,
      rows(three.map((i) => ({ ...i, status: "confirmed" }))),
      TODAY
    );
    expect(card?.next).toBeNull();
    expect(card?.settled).toBe(true);
    expect(card?.nextDueDate).toBeNull();
  });

  it("oldestOverdue ignora a vencida que espera confirmação", () => {
    const [card] = contractCards(
      ME,
      rows([
        inst({
          id: "a",
          sequence: 1,
          dueDate: "2026-08-30",
          status: "awaiting_confirmation",
        }),
        inst({ id: "b", sequence: 2, dueDate: "2026-09-30" }),
      ]),
      TODAY
    );
    expect(card?.oldestOverdue).toEqual({ sequence: 2, dueDate: "2026-09-30" });
    expect(card?.overdueCount).toBe(1);
  });

  it("installmentAmountCents null quando os valores diferem; monthly pelo monthlyAmountCents", () => {
    const [same] = contractCards(ME, rows(three), TODAY);
    expect(same?.installmentAmountCents).toBe(30_000);
    expect(same?.monthly).toBe(false);
    const [mixed] = contractCards(
      ME,
      rows(
        [
          inst({ id: "a", sequence: 1 }),
          inst({ id: "b", sequence: 2, amountCents: 31_000 }),
        ],
        { monthlyAmountCents: 30_000 }
      ),
      TODAY
    );
    expect(mixed?.installmentAmountCents).toBeNull();
    expect(mixed?.monthly).toBe(true);
  });

  it("statuses null acima de 24 parcelas", () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      inst({ id: `i${i}`, sequence: i + 1 })
    );
    const [card] = contractCards(ME, rows(many), TODAY);
    expect(card?.statuses).toBeNull();
    expect(card?.installmentsCount).toBe(25);
  });

  it("a contestada vencida conta como overdue, como na home", () => {
    const [card] = contractCards(
      ME,
      rows([
        inst({
          id: "a",
          sequence: 1,
          dueDate: "2026-09-01",
          status: "disputed",
        }),
      ]),
      TODAY
    );
    expect(card?.overdueCount).toBe(1);
    expect(card?.disputedCount).toBe(1);
    expect(card?.statuses).toEqual(["overdue"]);
  });
});

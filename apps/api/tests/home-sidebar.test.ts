import { describe, expect, it } from "bun:test";
import type {
  HomeContractRow,
  HomeContractRows,
  HomeInstallmentRow,
} from "../src/lib/home-parties";
import { SIDEBAR_CONTRACTS, sidebarContracts } from "../src/lib/home-sidebar";

const TODAY = "2026-10-03";

function contract(
  id: string,
  createdAt: string,
  over: Partial<HomeContractRow> = {}
): HomeContractRow {
  return {
    id,
    title: `Contrato ${id}`,
    ownerId: "u-me",
    ownerRole: "seller",
    requiresConfirmation: false,
    status: "active",
    pixKey: null,
    installmentsCount: 2,
    createdAt: new Date(createdAt),
    ...over,
  };
}

function inst(
  contractId: string,
  sequence: number,
  over: Partial<HomeInstallmentRow> = {}
): HomeInstallmentRow {
  return {
    id: `${contractId}-${sequence}`,
    contractId,
    sequence,
    amountCents: 10_000,
    dueDate: "2026-10-20",
    status: "pending",
    paidAt: null,
    lastProofAt: null,
    ...over,
  };
}

function rows(
  contracts: HomeContractRow[],
  installments: HomeInstallmentRow[] = []
): HomeContractRows {
  return { contracts, installments, participants: [], users: [] };
}

describe("sidebarContracts", () => {
  it("os mais recentes em cima, no máximo 5, só os ativos", () => {
    const data = rows([
      contract("a", "2026-01-01T12:00:00Z"),
      contract("b", "2026-02-01T12:00:00Z"),
      contract("c", "2026-03-01T12:00:00Z", { status: "cancelled" }),
      contract("d", "2026-04-01T12:00:00Z", { status: "completed" }),
      contract("e", "2026-05-01T12:00:00Z"),
      contract("f", "2026-06-01T12:00:00Z"),
      contract("g", "2026-07-01T12:00:00Z"),
      contract("h", "2026-08-01T12:00:00Z"),
    ]);
    expect(SIDEBAR_CONTRACTS).toBe(5);
    expect(sidebarContracts(data, TODAY).map((c) => c.contractId)).toEqual([
      "h",
      "g",
      "f",
      "e",
      "b",
    ]);
  });

  it("a ordem não muda quando uma parcela é paga: é pela criação, não pela urgência", () => {
    const contracts = [
      contract("old", "2026-01-01T12:00:00Z"),
      contract("new", "2026-02-01T12:00:00Z"),
    ];
    const late = rows(contracts, [inst("old", 1, { dueDate: "2026-09-01" })]);
    const paid = rows(contracts, [
      inst("old", 1, { dueDate: "2026-09-01", status: "paid" }),
    ]);
    expect(sidebarContracts(late, TODAY).map((c) => c.contractId)).toEqual([
      "new",
      "old",
    ]);
    expect(sidebarContracts(paid, TODAY).map((c) => c.contractId)).toEqual([
      "new",
      "old",
    ]);
  });

  it("conta as pagas e marca o atraso; comprovante esperando não é atraso", () => {
    const data = rows(
      [
        contract("x", "2026-01-01T12:00:00Z", { installmentsCount: 3 }),
        contract("y", "2026-02-01T12:00:00Z"),
      ],
      [
        inst("x", 1, { status: "confirmed", dueDate: "2026-08-01" }),
        inst("x", 2, { dueDate: "2026-09-01" }),
        inst("x", 3),
        inst("y", 1, {
          status: "awaiting_confirmation",
          dueDate: "2026-09-01",
        }),
        inst("y", 2),
      ]
    );
    expect(sidebarContracts(data, TODAY)).toEqual([
      {
        contractId: "y",
        title: "Contrato y",
        paidCount: 0,
        totalCount: 2,
        hasOverdue: false,
      },
      {
        contractId: "x",
        title: "Contrato x",
        paidCount: 1,
        totalCount: 3,
        hasOverdue: true,
      },
    ]);
  });

  it("criados no mesmo instante: desempata pelo id, sempre do mesmo jeito", () => {
    const same = "2026-05-01T12:00:00Z";
    const data = rows([contract("b2", same), contract("a1", same)]);
    expect(sidebarContracts(data, TODAY).map((c) => c.contractId)).toEqual([
      "a1",
      "b2",
    ]);
  });
});

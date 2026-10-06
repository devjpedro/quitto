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

  it("quitado com status active não entra; o mais antigo com atraso sobe para a lista", () => {
    // Nothing writes `completed` yet: a paid-off contract stays `active`.
    const paidOff = ["q1", "q2", "q3", "q4", "q5"].map((id, i) =>
      contract(id, `2026-0${i + 2}-01T12:00:00Z`)
    );
    const data = rows(
      [contract("aluguel", "2026-01-01T12:00:00Z"), ...paidOff],
      [
        inst("aluguel", 1, { dueDate: "2026-09-01" }),
        inst("aluguel", 2),
        ...paidOff.flatMap((c) => [
          inst(c.id, 1, { status: "paid", dueDate: "2026-09-01" }),
          // Confirmed counts as paid too.
          inst(c.id, 2, { status: "confirmed" }),
        ]),
      ]
    );
    expect(sidebarContracts(data, TODAY)).toEqual([
      {
        contractId: "aluguel",
        title: "Contrato aluguel",
        paidCount: 0,
        totalCount: 2,
        hasOverdue: true,
      },
    ]);
  });

  it("acima de 24 parcelas também: decide pela contagem de pagas", () => {
    const long = (id: string, paid: number) =>
      Array.from({ length: 30 }, (_, i) =>
        inst(id, i + 1, { status: i < paid ? "paid" : "pending" })
      );
    const data = rows(
      [
        contract("done", "2026-01-01T12:00:00Z", { installmentsCount: 30 }),
        contract("almost", "2026-02-01T12:00:00Z", { installmentsCount: 30 }),
      ],
      [...long("done", 30), ...long("almost", 29)]
    );
    expect(sidebarContracts(data, TODAY).map((c) => c.contractId)).toEqual([
      "almost",
    ]);
  });

  it("contestada vencida marca atraso, como a barra do cartão (decisão 21)", () => {
    const data = rows(
      [contract("z", "2026-01-01T12:00:00Z")],
      [
        inst("z", 1, { status: "disputed", dueDate: "2026-09-01" }),
        inst("z", 2),
      ]
    );
    expect(sidebarContracts(data, TODAY)).toEqual([
      {
        contractId: "z",
        title: "Contrato z",
        paidCount: 0,
        totalCount: 2,
        hasOverdue: true,
      },
    ]);
  });

  it("contrato que a pessoa só acompanha entra, como no 'Ver todos (N)'", () => {
    const data: HomeContractRows = {
      contracts: [
        contract("mine", "2026-01-01T12:00:00Z"),
        contract("followed", "2026-02-01T12:00:00Z", { ownerId: "u-owner" }),
      ],
      installments: [],
      participants: [
        {
          contractId: "followed",
          role: "viewer",
          linkedUserId: "u-me",
          displayName: "Eu",
          pixKey: null,
        },
      ],
      users: [],
    };
    expect(sidebarContracts(data, TODAY).map((c) => c.contractId)).toEqual([
      "followed",
      "mine",
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

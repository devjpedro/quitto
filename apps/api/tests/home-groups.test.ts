import { describe, expect, it } from "bun:test";
import { addMonths } from "@quitto/shared";
import { buildAgenda } from "../src/lib/home";
import { groupOverdue } from "../src/lib/home-groups";
import {
  type HomeContractRow,
  type HomeContractRows,
  type HomeInstallmentRow,
  type HomeParticipantRow,
  partyContracts,
} from "../src/lib/home-parties";
import type { HomeInviteRow, InstallmentAction } from "../src/lib/home-types";

const ME = "u-me";
const OTHER = "u-other";
const TODAY = "2026-10-03";

function contractRow(
  over: Partial<HomeContractRow> & { id: string }
): HomeContractRow {
  return {
    title: `Contrato ${over.id}`,
    ownerId: ME,
    ownerRole: "seller",
    requiresConfirmation: false,
    status: "active",
    pixKey: null,
    installmentsCount: 12,
    createdAt: new Date("2026-06-01T12:00:00Z"),
    ...over,
  };
}

function inst(
  over: Partial<HomeInstallmentRow> & { contractId: string; id: string }
): HomeInstallmentRow {
  return {
    sequence: 1,
    amountCents: 35_000,
    dueDate: "2026-10-30",
    status: "pending",
    paidAt: null,
    lastProofAt: null,
    ...over,
  };
}

function person(
  contractId: string,
  role: string,
  linkedUserId: string | null,
  displayName: string
): HomeParticipantRow {
  return { contractId, role, linkedUserId, displayName };
}

function rows(over: Partial<HomeContractRows>): HomeContractRows {
  return {
    contracts: [],
    installments: [],
    participants: [],
    users: [],
    ...over,
  };
}

function invite(over: Partial<HomeInviteRow> = {}): HomeInviteRow {
  return {
    token: "tok-1",
    contractId: "c-invite",
    contractTitle: "Viagem para Floripa (dividida)",
    role: "buyer",
    inviterName: "Bia Lopes",
    createdAt: new Date("2026-10-02T12:00:00Z"),
    ...over,
  };
}

function agenda(data: HomeContractRows, invites: HomeInviteRow[] = []) {
  return buildAgenda(partyContracts(ME, data), invites, TODAY);
}

/** "Notebook da Marina": I receive, Marina Pires pays. */
const NOTEBOOK = {
  contract: contractRow({ id: "nb", title: "Notebook da Marina" }),
  people: [
    person("nb", "seller", ME, "João Souza"),
    person("nb", "buyer", null, "Marina Pires"),
  ],
};

/** "Aluguel da sala": I pay, Helena Duarte receives. */
const RENT = {
  // With a key, so a single overdue card keeps its PIX code and a group drops it.
  contract: contractRow({
    id: "al",
    title: "Aluguel da sala",
    ownerRole: "buyer",
    pixKey: "helena.duarte@exemplo.com",
  }),
  people: [
    person("al", "buyer", ME, "João Souza"),
    person("al", "seller", null, "Helena Duarte"),
  ],
};

/** A bare overdue card, for groupOverdue on its own. */
function overdueCard(
  over: Partial<InstallmentAction> & { installmentId: string }
): InstallmentAction {
  const sequence = over.sequence ?? 1;
  const amountCents = over.amountCents ?? 10_000;
  return {
    id: `installment:${over.installmentId}`,
    kind: "overdue",
    contractId: "c",
    contractTitle: "Contrato",
    sequence,
    installmentsCount: 12,
    amountCents,
    dueDate: "2026-09-01",
    direction: "pay",
    status: "pending",
    counterpartyName: null,
    pixCode: null,
    canMarkPaid: true,
    canConfirm: false,
    count: 1,
    installmentIds: [over.installmentId],
    sequences: [sequence],
    totalCents: amountCents,
    contract: {
      paidCount: 0,
      overdueCount: 1,
      remainingCents: amountCents,
      statuses: ["overdue"],
    },
    ...over,
  };
}

describe("buildAgenda: atrasadas agrupadas", () => {
  it("2 atrasadas do mesmo contrato viram um cartão: a mais antiga é a base, com total, contagem e sequências", () => {
    const data = rows({
      contracts: [NOTEBOOK.contract],
      participants: NOTEBOOK.people,
      installments: [
        inst({
          id: "nb-4",
          contractId: "nb",
          sequence: 4,
          dueDate: "2026-09-30",
        }),
        inst({
          id: "nb-3",
          contractId: "nb",
          sequence: 3,
          dueDate: "2026-08-30",
        }),
        inst({
          id: "nb-5",
          contractId: "nb",
          sequence: 5,
          dueDate: "2026-10-30",
        }),
      ],
    });
    const { actions } = agenda(data);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      id: "overdue:nb:receive",
      kind: "overdue",
      installmentId: "nb-3",
      sequence: 3,
      dueDate: "2026-08-30",
      amountCents: 35_000,
      count: 2,
      installmentIds: ["nb-3", "nb-4"],
      sequences: [3, 4],
      totalCents: 70_000,
      counterpartyName: "Marina Pires",
      pixCode: null,
      canMarkPaid: false,
      canConfirm: false,
    });
  });

  it("uma atrasada só continua o cartão de hoje: id da parcela, count 1, PIX e 'já paguei'", () => {
    const data = rows({
      contracts: [RENT.contract],
      participants: RENT.people,
      installments: [
        inst({
          id: "al-5",
          contractId: "al",
          sequence: 5,
          dueDate: "2026-10-01",
          amountCents: 180_000,
        }),
      ],
    });
    expect(agenda(data).actions).toEqual([
      expect.objectContaining({
        id: "installment:al-5",
        kind: "overdue",
        count: 1,
        installmentIds: ["al-5"],
        sequences: [5],
        totalCents: 180_000,
        amountCents: 180_000,
        canMarkPaid: true,
      }),
    ]);
    expect(
      (agenda(data).actions[0] as InstallmentAction).pixCode
    ).not.toBeNull();
  });

  it("grupo que você paga: sem PIX e sem 'já paguei' (um código é um valor; o lote fica fora)", () => {
    const data = rows({
      contracts: [RENT.contract],
      participants: RENT.people,
      installments: [
        inst({
          id: "al-5",
          contractId: "al",
          sequence: 5,
          dueDate: "2026-09-01",
          amountCents: 180_000,
        }),
        inst({
          id: "al-6",
          contractId: "al",
          sequence: 6,
          dueDate: "2026-10-01",
          amountCents: 180_000,
        }),
      ],
    });
    expect(agenda(data).actions).toEqual([
      expect.objectContaining({
        id: "overdue:al:pay",
        count: 2,
        totalCents: 360_000,
        pixCode: null,
        canMarkPaid: false,
      }),
    ]);
  });

  it("24 atrasadas viram um cartão com as 24 em ordem e o total, venha a lista na ordem que vier", () => {
    const late = Array.from({ length: 24 }, (_, i) =>
      inst({
        id: `vt-${i + 5}`,
        contractId: "vt",
        sequence: i + 5,
        amountCents: 200_000,
        dueDate: addMonths("2024-10-28", i),
      })
    ).reverse();
    const data = rows({
      contracts: [
        contractRow({
          id: "vt",
          title: "Venda do terreno",
          installmentsCount: 60,
        }),
      ],
      participants: [
        person("vt", "seller", ME, "Renata Campos"),
        person("vt", "buyer", null, "Diego Martins"),
      ],
      installments: late,
    });
    const [group] = agenda(data).actions as InstallmentAction[];
    expect(group?.count).toBe(24);
    expect(group?.sequences).toEqual(
      Array.from({ length: 24 }, (_, i) => i + 5)
    );
    expect(group?.totalCents).toBe(4_800_000);
    expect(group?.dueDate).toBe("2024-10-28");
    expect(group?.installmentId).toBe("vt-5");
  });

  it("direções diferentes do mesmo contrato nunca se juntam", () => {
    const grouped = groupOverdue([
      overdueCard({ installmentId: "a", direction: "pay", sequence: 1 }),
      overdueCard({ installmentId: "b", direction: "receive", sequence: 2 }),
      overdueCard({
        installmentId: "c",
        direction: "pay",
        sequence: 3,
        dueDate: "2026-09-02",
      }),
    ]);
    expect(grouped.map((a) => [a.id, a.count, a.installmentIds])).toEqual([
      ["overdue:c:pay", 2, ["a", "c"]],
      ["installment:b", 1, ["b"]],
    ]);
  });

  it("contratos diferentes não se juntam", () => {
    const data = rows({
      contracts: [NOTEBOOK.contract, RENT.contract],
      participants: [...NOTEBOOK.people, ...RENT.people],
      installments: [
        inst({
          id: "nb-3",
          contractId: "nb",
          sequence: 3,
          dueDate: "2026-08-30",
        }),
        inst({
          id: "al-5",
          contractId: "al",
          sequence: 5,
          dueDate: "2026-10-01",
        }),
      ],
    });
    expect(agenda(data).actions.map((a) => a.id)).toEqual([
      "installment:nb-3",
      "installment:al-5",
    ]);
  });
});

describe("buildAgenda: ordem das ações", () => {
  it("atrasadas (pela mais antiga), vence hoje, conferir, contestada, convite e depois o que vence em 7 dias", () => {
    const pay = (id: string) => contractRow({ id, ownerRole: "buyer" });
    const data = rows({
      contracts: [
        pay("late"),
        pay("older"),
        pay("today"),
        pay("soon"),
        contractRow({
          id: "proof",
          ownerId: OTHER,
          ownerRole: "buyer",
          requiresConfirmation: true,
        }),
        contractRow({
          id: "disp",
          ownerRole: "buyer",
          requiresConfirmation: true,
        }),
      ],
      participants: [
        person("late", "buyer", ME, "Eu"),
        person("older", "buyer", ME, "Eu"),
        person("today", "buyer", ME, "Eu"),
        person("soon", "buyer", ME, "Eu"),
        person("proof", "buyer", OTHER, "Outro"),
        person("proof", "seller", ME, "Eu"),
        person("disp", "buyer", ME, "Eu"),
        person("disp", "seller", OTHER, "Outro"),
      ],
      installments: [
        inst({ id: "soon-1", contractId: "soon", dueDate: "2026-10-06" }),
        inst({ id: "late-1", contractId: "late", dueDate: "2026-09-20" }),
        inst({ id: "today-1", contractId: "today", dueDate: TODAY }),
        inst({
          id: "proof-1",
          contractId: "proof",
          status: "awaiting_confirmation",
          dueDate: "2026-09-28",
        }),
        inst({
          id: "disp-1",
          contractId: "disp",
          status: "disputed",
          dueDate: "2026-11-20",
        }),
        inst({ id: "older-1", contractId: "older", dueDate: "2026-08-15" }),
      ],
    });
    expect(agenda(data, [invite()]).actions.map((a) => a.id)).toEqual([
      "installment:older-1",
      "installment:late-1",
      "installment:today-1",
      "installment:proof-1",
      "installment:disp-1",
      "invite:tok-1",
      "installment:soon-1",
    ]);
  });

  it("o grupo se ordena pela mais antiga: vem antes de uma atrasada única mais nova que ela, mesmo chegando depois", () => {
    const data = rows({
      contracts: [RENT.contract, NOTEBOOK.contract],
      participants: [...RENT.people, ...NOTEBOOK.people],
      installments: [
        inst({
          id: "al-5",
          contractId: "al",
          sequence: 5,
          dueDate: "2026-09-01",
        }),
        inst({
          id: "nb-2",
          contractId: "nb",
          sequence: 2,
          dueDate: "2026-10-01",
        }),
        inst({
          id: "nb-1",
          contractId: "nb",
          sequence: 1,
          dueDate: "2026-08-01",
        }),
      ],
    });
    expect(agenda(data).actions.map((a) => a.id)).toEqual([
      "overdue:nb:receive",
      "installment:al-5",
    ]);
  });

  it("empate de data, título e sequência entre contratos: a ordem não depende da entrada", () => {
    const rent = (id: string) =>
      contractRow({ id, title: "Aluguel", ownerRole: "buyer" });
    const people = ["x", "y"].map((id) => person(id, "buyer", ME, "Eu"));
    const tied = ["x", "y"].flatMap((id) => [
      // Overdue: an action. Past the 7 days: a line of "Próximos 30 dias".
      inst({
        id: `${id}-3`,
        contractId: id,
        sequence: 3,
        dueDate: "2026-09-10",
      }),
      inst({
        id: `${id}-4`,
        contractId: id,
        sequence: 4,
        dueDate: "2026-10-20",
      }),
    ]);
    const forward = agenda(
      rows({
        contracts: [rent("x"), rent("y")],
        participants: people,
        installments: tied,
      })
    );
    const backward = agenda(
      rows({
        contracts: [rent("y"), rent("x")],
        participants: [...people].reverse(),
        installments: [...tied].reverse(),
      })
    );
    for (const result of [forward, backward]) {
      expect(result.actions.map((a) => a.id)).toEqual([
        "installment:x-3",
        "installment:y-3",
      ]);
      expect(result.upcoming.items.map((it) => it.installmentId)).toEqual([
        "x-4",
        "y-4",
      ]);
    }
  });
});

describe("buildAgenda: total em atraso", () => {
  it("soma o atraso por direção, sem misturar, e o 'a pagar · 30d' continua só para a frente", () => {
    const data = rows({
      contracts: [NOTEBOOK.contract, RENT.contract],
      participants: [...NOTEBOOK.people, ...RENT.people],
      installments: [
        inst({
          id: "nb-3",
          contractId: "nb",
          sequence: 3,
          dueDate: "2026-08-30",
        }),
        inst({
          id: "nb-4",
          contractId: "nb",
          sequence: 4,
          dueDate: "2026-09-30",
        }),
        inst({
          id: "al-5",
          contractId: "al",
          sequence: 5,
          dueDate: "2026-10-01",
          amountCents: 180_000,
        }),
        inst({
          id: "al-6",
          contractId: "al",
          sequence: 6,
          dueDate: "2026-11-01",
          amountCents: 180_000,
        }),
      ],
    });
    const result = agenda(data);
    expect(result.overdue).toEqual({
      toPayCents: 180_000,
      toReceiveCents: 70_000,
    });
    expect(result.upcoming.toPayCents).toBe(180_000);
    expect(result.upcoming.toReceiveCents).toBe(0);
  });

  it("contestada vencida: quem paga vê o cartão 'Contestada' e ela fica fora do atraso; quem recebe a soma no atraso (decisão 21)", () => {
    const data = rows({
      contracts: [
        // I pay; the seller (linked) disputed my proof.
        contractRow({
          id: "pg",
          ownerRole: "buyer",
          requiresConfirmation: true,
        }),
        // I receive; I disputed the buyer's proof.
        contractRow({
          id: "rc",
          ownerId: OTHER,
          ownerRole: "buyer",
          requiresConfirmation: true,
        }),
      ],
      participants: [
        person("pg", "buyer", ME, "Eu"),
        person("pg", "seller", OTHER, "Outro"),
        person("rc", "buyer", OTHER, "Outro"),
        person("rc", "seller", ME, "Eu"),
      ],
      installments: [
        inst({
          id: "pg-2",
          contractId: "pg",
          sequence: 2,
          status: "disputed",
          dueDate: "2026-09-15",
          amountCents: 50_000,
        }),
        inst({
          id: "rc-2",
          contractId: "rc",
          sequence: 2,
          status: "disputed",
          dueDate: "2026-09-20",
          amountCents: 80_000,
        }),
      ],
    });
    const result = agenda(data);
    expect(result.actions.map((a) => [a.id, a.kind])).toEqual([
      ["installment:rc-2", "overdue"],
      ["installment:pg-2", "disputed"],
    ]);
    expect(result.overdue).toEqual({ toPayCents: 0, toReceiveCents: 80_000 });
  });
});

import { describe, expect, it } from "bun:test";
import { buildAgenda } from "../src/lib/home";
import {
  type HomeContractRow,
  type HomeContractRows,
  type HomeInstallmentRow,
  type HomeParticipantRow,
  partyContracts,
} from "../src/lib/home-parties";
import type { HomeInviteRow } from "../src/lib/home-types";

const ME = "u-me";
const OTHER = "u-other";
const TODAY = "2026-10-02";

function contractRow(
  over: Partial<HomeContractRow> & { id: string }
): HomeContractRow {
  return {
    title: `Contrato ${over.id}`,
    ownerId: ME,
    ownerRole: "buyer",
    requiresConfirmation: false,
    status: "active",
    pixKey: null,
    installmentsCount: 3,
    createdAt: new Date("2026-09-01T12:00:00Z"),
    ...over,
  };
}

function inst(
  over: Partial<HomeInstallmentRow> & { contractId: string; id: string }
): HomeInstallmentRow {
  return {
    sequence: 1,
    amountCents: 10_000,
    dueDate: "2026-10-20",
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
    contractTitle: "Moto da Ana",
    role: "seller",
    inviterName: "Ana",
    createdAt: new Date("2026-10-01T12:00:00Z"),
    ...over,
  };
}

function agenda(data: HomeContractRows, invites: HomeInviteRow[] = []) {
  return buildAgenda(partyContracts(ME, data), invites, TODAY);
}

describe("buildAgenda: ações", () => {
  it("ordena: atrasadas, comprovantes para conferir, contestadas, convites e depois o que vence em 7 dias", () => {
    const data = rows({
      contracts: [
        contractRow({ id: "c1" }),
        contractRow({ id: "c2", ownerId: OTHER, requiresConfirmation: true }),
        contractRow({ id: "c3", requiresConfirmation: true }),
      ],
      participants: [
        person("c1", "buyer", ME, "Eu"),
        person("c2", "buyer", OTHER, "Outro"),
        person("c2", "seller", ME, "Eu"),
        person("c3", "buyer", ME, "Eu"),
        person("c3", "seller", OTHER, "Outro"),
      ],
      installments: [
        inst({
          id: "soon",
          contractId: "c1",
          dueDate: "2026-10-05",
          sequence: 2,
        }),
        inst({ id: "late", contractId: "c1", dueDate: "2026-09-25" }),
        inst({
          id: "proof",
          contractId: "c2",
          status: "awaiting_confirmation",
        }),
        inst({
          id: "disp",
          contractId: "c3",
          status: "disputed",
          dueDate: "2026-11-20",
        }),
        inst({
          id: "far",
          contractId: "c1",
          dueDate: "2026-10-25",
          sequence: 3,
        }),
      ],
    });
    const { actions } = agenda(data, [invite()]);
    expect(actions.map((a) => a.kind)).toEqual([
      "overdue",
      "review",
      "disputed",
      "invite",
      "due_soon",
    ]);
    expect(actions.map((a) => a.id)).toEqual([
      "installment:late",
      "installment:proof",
      "installment:disp",
      "invite:tok-1",
      "installment:soon",
    ]);
  });

  it("dá direção e o nome da outra parte (para quem pago, quem me deve)", () => {
    const data = rows({
      contracts: [
        contractRow({ id: "pay", title: "Aluguel" }),
        contractRow({ id: "recv", title: "Notebook", ownerRole: "seller" }),
      ],
      participants: [
        person("pay", "buyer", ME, "Eu"),
        person("pay", "seller", null, "Maria"),
        person("recv", "seller", ME, "Eu"),
        person("recv", "buyer", null, "Carlos"),
      ],
      users: [{ id: ME, name: "Eu", pixKey: null }],
      installments: [
        inst({ id: "p1", contractId: "pay", dueDate: "2026-09-30" }),
        inst({ id: "r1", contractId: "recv", dueDate: "2026-09-29" }),
      ],
    });
    const byId = new Map(agenda(data).actions.map((a) => [a.id, a]));
    expect(byId.get("installment:p1")).toMatchObject({
      direction: "pay",
      counterpartyName: "Maria",
      contractTitle: "Aluguel",
      installmentsCount: 3,
    });
    expect(byId.get("installment:r1")).toMatchObject({
      direction: "receive",
      counterpartyName: "Carlos",
    });
  });

  it("monta o PIX quando o recebedor tem chave e libera 'já paguei' só sem confirmação", () => {
    const data = rows({
      contracts: [
        contractRow({ id: "free", ownerRole: "seller" }),
        contractRow({ id: "conf", requiresConfirmation: true }),
      ],
      participants: [
        person("free", "seller", ME, "Eu"),
        person("conf", "buyer", ME, "Eu"),
        person("conf", "seller", OTHER, "Outro"),
      ],
      users: [
        { id: ME, name: "Eu", pixKey: "joao@example.com" },
        { id: OTHER, name: "Outro", pixKey: null },
      ],
      installments: [
        inst({ id: "a", contractId: "free", dueDate: "2026-09-30" }),
        inst({ id: "b", contractId: "conf", dueDate: "2026-09-30" }),
      ],
    });
    const byId = new Map(agenda(data).actions.map((a) => [a.id, a]));
    const free = byId.get("installment:a");
    const conf = byId.get("installment:b");
    expect(free?.kind === "invite" ? null : free?.pixCode).toStartWith(
      "000201"
    );
    expect(free?.kind === "invite" ? null : free?.canMarkPaid).toBe(true);
    expect(conf?.kind === "invite" ? null : conf?.pixCode).toBeNull();
    expect(conf?.kind === "invite" ? null : conf?.canMarkPaid).toBe(false);
  });

  it("chave PIX guardada que não é mais válida não gera código (nem quebra)", () => {
    const data = rows({
      contracts: [
        contractRow({ id: "c", ownerRole: "seller", pixKey: "não-é-chave" }),
      ],
      participants: [person("c", "seller", ME, "Eu")],
      users: [{ id: ME, name: "Eu", pixKey: null }],
      installments: [inst({ id: "x", contractId: "c", dueDate: "2026-09-30" })],
    });
    const [action] = agenda(data).actions;
    expect(action?.kind === "invite" ? "" : action?.pixCode).toBeNull();
  });

  it("contrato de espectador não gera ação nem total", () => {
    const data = rows({
      contracts: [contractRow({ id: "v", ownerId: OTHER })],
      participants: [
        person("v", "buyer", OTHER, "Outro"),
        person("v", "viewer", ME, "Eu"),
      ],
      installments: [
        inst({ id: "x", contractId: "v", dueDate: "2026-09-01" }),
        inst({ id: "y", contractId: "v", dueDate: "2026-10-10" }),
      ],
    });
    const result = agenda(data);
    expect(result.actions).toEqual([]);
    expect(result.upcoming).toEqual({
      items: [],
      moreCount: 0,
      toPayCents: 0,
      toReceiveCents: 0,
    });
    expect(result.nextDue).toBeNull();
  });

  it("comprovante enviado não é ação para quem paga, mas aparece nos próximos 30 dias", () => {
    const data = rows({
      contracts: [contractRow({ id: "c", requiresConfirmation: true })],
      participants: [
        person("c", "buyer", ME, "Eu"),
        person("c", "seller", OTHER, "Outro"),
      ],
      installments: [
        inst({
          id: "w",
          contractId: "c",
          status: "awaiting_confirmation",
          dueDate: "2026-10-10",
        }),
      ],
    });
    const result = agenda(data);
    expect(result.actions).toEqual([]);
    expect(result.upcoming.items[0]).toMatchObject({
      installmentId: "w",
      status: "awaiting_confirmation",
    });
  });

  it("ignora contrato cancelado", () => {
    const data = rows({
      contracts: [contractRow({ id: "c", status: "cancelled" })],
      participants: [person("c", "buyer", ME, "Eu")],
      installments: [inst({ id: "x", contractId: "c", dueDate: "2026-09-01" })],
    });
    expect(agenda(data).actions).toEqual([]);
  });

  it("contrato sem vaga minha não gera ação, item nem total", () => {
    const data = rows({
      contracts: [contractRow({ id: "x", ownerId: OTHER })],
      participants: [
        person("x", "buyer", OTHER, "Outro"),
        person("x", "seller", "u-third", "Terceiro"),
      ],
      installments: [
        inst({ id: "a", contractId: "x", dueDate: "2026-09-01" }),
        inst({ id: "b", contractId: "x", dueDate: "2026-10-10" }),
      ],
    });
    const result = agenda(data);
    expect(result.actions).toEqual([]);
    expect(result.upcoming).toEqual({
      items: [],
      moreCount: 0,
      toPayCents: 0,
      toReceiveCents: 0,
    });
    expect(result.nextDue).toBeNull();
  });

  it("dono comprador confere o comprovante por herança enquanto o vendedor não tem conta", () => {
    const data = rows({
      contracts: [contractRow({ id: "c", requiresConfirmation: true })],
      participants: [
        person("c", "buyer", ME, "Eu"),
        person("c", "seller", null, "Maria"),
      ],
      installments: [
        inst({
          id: "w",
          contractId: "c",
          status: "awaiting_confirmation",
          dueDate: "2026-10-10",
        }),
      ],
    });
    expect(agenda(data).actions).toEqual([
      expect.objectContaining({
        id: "installment:w",
        kind: "review",
        direction: "pay",
        counterpartyName: "Maria",
        canConfirm: true,
        canMarkPaid: false,
        pixCode: null,
      }),
    ]);
  });

  it("PIX para quem paga: usa a chave do vendedor vinculado, e a do contrato vence a do perfil", () => {
    const data = rows({
      contracts: [
        contractRow({ id: "profile" }),
        contractRow({ id: "own", pixKey: "loja@example.com" }),
      ],
      participants: [
        person("profile", "buyer", ME, "Eu"),
        person("profile", "seller", OTHER, "Maria"),
        person("own", "buyer", ME, "Eu"),
        person("own", "seller", OTHER, "Maria"),
      ],
      users: [
        { id: ME, name: "Eu", pixKey: "eu@example.com" },
        { id: OTHER, name: "Maria", pixKey: "maria@example.com" },
      ],
      installments: [
        inst({ id: "p", contractId: "profile", dueDate: "2026-09-30" }),
        inst({ id: "o", contractId: "own", dueDate: "2026-09-30" }),
      ],
    });
    const byId = new Map(agenda(data).actions.map((a) => [a.id, a]));
    const viaProfile = byId.get("installment:p");
    const viaContract = byId.get("installment:o");
    const profileCode =
      viaProfile?.kind === "invite" ? null : viaProfile?.pixCode;
    const contractCode =
      viaContract?.kind === "invite" ? null : viaContract?.pixCode;
    expect(viaProfile).toMatchObject({ direction: "pay", canMarkPaid: true });
    expect(profileCode).toContain("maria@example.com");
    expect(profileCode).not.toContain("eu@example.com");
    expect(contractCode).toContain("loja@example.com");
    expect(contractCode).not.toContain("maria@example.com");
  });
});

describe("buildAgenda: fronteiras de data", () => {
  it("vence hoje é 'vence em breve', não atrasada", () => {
    const data = rows({
      contracts: [contractRow({ id: "c" })],
      participants: [person("c", "buyer", ME, "Eu")],
      installments: [inst({ id: "today", contractId: "c", dueDate: TODAY })],
    });
    expect(agenda(data).actions).toEqual([
      expect.objectContaining({ id: "installment:today", kind: "due_soon" }),
    ]);
  });

  it("'vence em breve' vai até hoje+7, inclusive; hoje+8 fica nos próximos 30 dias", () => {
    const data = rows({
      contracts: [contractRow({ id: "c" })],
      participants: [person("c", "buyer", ME, "Eu")],
      installments: [
        inst({ id: "d7", contractId: "c", dueDate: "2026-10-09" }),
        inst({ id: "d8", contractId: "c", dueDate: "2026-10-10", sequence: 2 }),
      ],
    });
    const { actions, upcoming } = agenda(data);
    expect(actions.map((a) => [a.id, a.kind])).toEqual([
      ["installment:d7", "due_soon"],
    ]);
    expect(upcoming.items.map((i) => i.installmentId)).toEqual(["d8"]);
  });

  it("a janela de 30 dias inclui hoje+30 e deixa hoje+31 de fora, nos itens e nos totais", () => {
    const data = rows({
      contracts: [contractRow({ id: "c" })],
      participants: [person("c", "buyer", ME, "Eu")],
      installments: [
        inst({
          id: "d30",
          contractId: "c",
          dueDate: "2026-11-01",
          amountCents: 10_000,
        }),
        inst({
          id: "d31",
          contractId: "c",
          dueDate: "2026-11-02",
          amountCents: 20_000,
          sequence: 2,
        }),
      ],
    });
    const { upcoming, nextDue } = agenda(data);
    expect(upcoming.items.map((i) => i.installmentId)).toEqual(["d30"]);
    expect(upcoming.moreCount).toBe(0);
    expect(upcoming.toPayCents).toBe(10_000);
    expect(nextDue?.installmentId).toBe("d30");
  });
});

describe("buildAgenda: próximos 30 dias e próxima parcela", () => {
  it("janela de 30 dias sem o que já é ação, totais incluindo, limite de 8", () => {
    const due = [
      "2026-10-10",
      "2026-10-11",
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
      "2026-10-19",
    ];
    const data = rows({
      contracts: [contractRow({ id: "c", installmentsCount: 12 })],
      participants: [person("c", "buyer", ME, "Eu")],
      installments: [
        inst({
          id: "soon",
          contractId: "c",
          dueDate: "2026-10-03",
          sequence: 1,
        }),
        ...due.map((dueDate, i) =>
          inst({ id: `d${i}`, contractId: "c", dueDate, sequence: i + 2 })
        ),
        inst({
          id: "out",
          contractId: "c",
          dueDate: "2026-11-15",
          sequence: 12,
        }),
      ],
    });
    const { upcoming, actions } = agenda(data);
    expect(actions.map((a) => a.id)).toEqual(["installment:soon"]);
    expect(upcoming.items).toHaveLength(8);
    expect(upcoming.items.map((i) => i.installmentId)).not.toContain("soon");
    expect(upcoming.moreCount).toBe(2);
    expect(upcoming.toPayCents).toBe(11 * 10_000);
    expect(upcoming.toReceiveCents).toBe(0);
  });

  it("a próxima parcela é a primeira em aberto de hoje em diante, mesmo fora dos 30 dias", () => {
    const data = rows({
      contracts: [contractRow({ id: "c" })],
      participants: [person("c", "buyer", ME, "Eu")],
      installments: [
        inst({
          id: "paid",
          contractId: "c",
          status: "paid",
          dueDate: "2026-10-05",
        }),
        inst({
          id: "next",
          contractId: "c",
          dueDate: "2026-12-01",
          sequence: 2,
        }),
      ],
    });
    const result = agenda(data);
    expect(result.actions).toEqual([]);
    expect(result.upcoming.items).toEqual([]);
    expect(result.nextDue?.installmentId).toBe("next");
  });
});

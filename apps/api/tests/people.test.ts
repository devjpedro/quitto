import { describe, expect, it } from "bun:test";
import type {
  AccountRow,
  ContractRows,
  ListContractRow,
  ListParticipantRow,
  SlotInviteRow,
} from "../src/lib/contract-rows";
import type { HomeInstallmentRow } from "../src/lib/home-parties";
import { groupPeople, personKey } from "../src/lib/people";

const ME = { id: "u-me", email: "joao@exemplo.com" };
const TODAY = "2026-10-15";
const NOW = new Date("2026-10-15T12:00:00Z");
const HEX16_RE = /^[0-9a-f]{16}$/;

let seq = 0;

interface Spec {
  /** days ago the contract was created */
  age?: number;
  /** The caller's side. */
  direction?: "pay" | "receive";
  id: string;
  installments?: Partial<HomeInstallmentRow>[];
  invite?: Partial<SlotInviteRow>;
  /** The caller owns the contract (default true). */
  mine?: boolean;
  /** The other side's slot. */
  other: { linkedUserId?: string | null; name: string } | null;
  /** Owner when `mine` is false. */
  ownerId?: string;
  status?: string;
  title?: string;
  viewerOnly?: boolean;
}

function build(specs: Spec[], accounts: AccountRow[] = []): ContractRows {
  const rows: ContractRows = {
    accounts: [{ id: ME.id, name: "João Souza", email: ME.email }, ...accounts],
    contracts: [],
    installments: [],
    invites: [],
    participants: [],
    users: [],
  };
  for (const spec of specs) {
    const direction = spec.direction ?? "receive";
    const mine = spec.mine ?? true;
    const ownerId = mine ? ME.id : (spec.ownerId ?? "u-owner");
    const contract: ListContractRow = {
      id: spec.id,
      title: spec.title ?? spec.id,
      description: null,
      monthlyAmountCents: null,
      ownerId,
      ownerRole: mine === (direction === "pay") ? "buyer" : "seller",
      requiresConfirmation: true,
      status: spec.status ?? "active",
      installmentsCount: (spec.installments ?? [{}]).length,
      createdAt: new Date(NOW.getTime() - (spec.age ?? 0) * 86_400_000),
    };
    rows.contracts.push(contract);
    const mySlotRole = direction === "pay" ? "buyer" : "seller";
    const otherRole = direction === "pay" ? "seller" : "buyer";
    rows.participants.push({
      id: `${spec.id}-me`,
      contractId: spec.id,
      displayName: "João Souza",
      role: spec.viewerOnly ? "viewer" : mySlotRole,
      linkedUserId: ME.id,
      pixKey: null,
    });
    if (spec.other) {
      const slot: ListParticipantRow = {
        id: `${spec.id}-other`,
        contractId: spec.id,
        displayName: spec.other.name,
        role: otherRole,
        linkedUserId: spec.other.linkedUserId ?? null,
        pixKey: null,
      };
      rows.participants.push(slot);
      if (spec.invite) {
        rows.invites.push({
          participantId: slot.id,
          email: "x@exemplo.com",
          createdAt: new Date("2026-10-01T00:00:00Z"),
          expiresAt: new Date("2026-10-30T00:00:00Z"),
          acceptedAt: null,
          declinedAt: null,
          ...spec.invite,
        });
      }
    }
    seq += 1;
    (spec.installments ?? [{}]).forEach((over, i) => {
      rows.installments.push({
        id: `${spec.id}-i${i + 1}-${seq}`,
        contractId: spec.id,
        sequence: i + 1,
        amountCents: 10_000,
        dueDate: "2026-11-20",
        status: "pending",
        paidAt: null,
        lastProofAt: null,
        ...over,
      } as HomeInstallmentRow);
    });
  }
  return rows;
}

const CARLOS: AccountRow = {
  id: "u-carlos",
  name: "Carlos Lima",
  email: "carlos@exemplo.com",
};

describe("groupPeople", () => {
  it("contato convidado pelo e-mail de uma conta já ligada em outro contrato: uma pessoa", () => {
    const rows = build(
      [
        {
          id: "a",
          other: { name: "Carlos Lima", linkedUserId: CARLOS.id },
        },
        {
          id: "b",
          other: { name: "Carlinhos" },
          invite: { email: "Carlos@Exemplo.com" },
        },
      ],
      [CARLOS]
    );
    const people = groupPeople(ME, rows, TODAY, NOW);
    expect(people).toHaveLength(1);
    expect(people[0]?.contracts.map((c) => c.contractId).sort()).toEqual([
      "a",
      "b",
    ]);
    expect(people[0]?.account).toBe("linked");
  });

  it("dois contatos sem e-mail com o mesmo nome (acento e caixa à parte): uma pessoa", () => {
    const rows = build([
      { id: "a", other: { name: "Júlia Nogueira" } },
      { id: "b", other: { name: " JULIA   nogueira " }, age: 5 },
    ]);
    const people = groupPeople(ME, rows, TODAY, NOW);
    expect(people).toHaveLength(1);
    // The newest slot names the person.
    expect(people[0]?.name).toBe("Júlia Nogueira");
  });

  it("nomes diferentes sem e-mail: duas pessoas", () => {
    const rows = build([
      { id: "a", other: { name: "Júlia Nogueira" } },
      { id: "b", other: { name: "Júlio Nogueira" } },
    ]);
    expect(groupPeople(ME, rows, TODAY, NOW)).toHaveLength(2);
  });

  it("quem pede nunca aparece", () => {
    const rows = build([
      // The caller's own account on the other slot.
      { id: "a", other: { name: "João Souza", linkedUserId: ME.id } },
      // A legacy contact invited with the caller's own e-mail.
      {
        id: "b",
        other: { name: "João" },
        invite: { email: "JOAO@exemplo.com" },
      },
    ]);
    expect(groupPeople(ME, rows, TODAY, NOW)).toEqual([]);
  });

  it("saldo por direção, nunca somado", () => {
    const rows = build(
      [
        {
          id: "a",
          direction: "receive",
          other: { name: "Carlos Lima", linkedUserId: CARLOS.id },
          installments: [{ amountCents: 50_000 }, { status: "paid" }],
        },
        {
          id: "b",
          direction: "pay",
          other: { name: "Carlos Lima", linkedUserId: CARLOS.id },
          installments: [{ amountCents: 20_000 }],
        },
      ],
      [CARLOS]
    );
    const [person] = groupPeople(ME, rows, TODAY, NOW);
    expect(person).toMatchObject({ owesYouCents: 50_000, youOweCents: 20_000 });
  });

  it("account: linked > invited (pendente) > none; convite recusado ou vencido é none", () => {
    const rows = build(
      [
        {
          id: "a",
          other: { name: "Ana" },
          invite: { email: "ana@exemplo.com" },
        },
        {
          id: "b",
          other: { name: "Bia" },
          invite: { email: "bia@exemplo.com", declinedAt: NOW },
        },
        {
          id: "c",
          other: { name: "Caio" },
          invite: {
            email: "caio@exemplo.com",
            expiresAt: new Date("2026-10-14T00:00:00Z"),
          },
        },
        { id: "d", other: { name: "Dani" } },
        {
          id: "e",
          other: { name: "Eva", linkedUserId: "u-eva" },
        },
      ],
      [{ id: "u-eva", name: "Eva", email: "eva@exemplo.com" }]
    );
    const byName = new Map(
      groupPeople(ME, rows, TODAY, NOW).map((p) => [p.name, p.account])
    );
    expect(Object.fromEntries(byName)).toEqual({
      Ana: "invited",
      Bia: "none",
      Caio: "none",
      Dani: "none",
      Eva: "linked",
    });
  });

  it("o e-mail só vai para quem é dono de um contrato com a pessoa", () => {
    const owned = build([
      { id: "a", other: { name: "Ana" }, invite: { email: "ana@exemplo.com" } },
    ]);
    expect(groupPeople(ME, owned, TODAY, NOW)[0]?.email).toBe(
      "ana@exemplo.com"
    );
    // The other party owns the contract: the caller never sees their e-mail.
    const theirs = build(
      [
        {
          id: "a",
          mine: false,
          ownerId: CARLOS.id,
          other: { name: "Carlos Lima", linkedUserId: CARLOS.id },
        },
      ],
      [CARLOS]
    );
    const [person] = groupPeople(ME, theirs, TODAY, NOW);
    expect(person?.name).toBe("Carlos Lima");
    expect(person?.email).toBeNull();
  });

  it("reviewCount só onde quem pede recebe", () => {
    const rows = build([
      {
        id: "a",
        direction: "receive",
        other: { name: "Ana" },
        installments: [{ status: "awaiting_confirmation" }],
      },
      {
        id: "b",
        direction: "pay",
        other: { name: "Ana" },
        installments: [{ status: "awaiting_confirmation" }],
      },
    ]);
    const [person] = groupPeople(ME, rows, TODAY, NOW);
    expect(person?.reviewCount).toBe(1);
    expect(person?.overdueCount).toBe(0);
  });

  it("o contrato só eu, o acompanhado e o cancelado ficam fora", () => {
    const rows = build([
      { id: "solo", other: null },
      { id: "watch", viewerOnly: true, other: { name: "Ana" } },
      { id: "gone", status: "cancelled", other: { name: "Bia" } },
      { id: "ok", other: { name: "Caio" } },
    ]);
    expect(groupPeople(ME, rows, TODAY, NOW).map((p) => p.name)).toEqual([
      "Caio",
    ]);
  });

  it("a chave não contém id nem e-mail e é estável", () => {
    const rows = build(
      [{ id: "a", other: { name: "Carlos Lima", linkedUserId: CARLOS.id } }],
      [CARLOS]
    );
    const [first] = groupPeople(ME, rows, TODAY, NOW);
    const [again] = groupPeople(ME, rows, TODAY, NOW);
    expect(first?.key).toMatch(HEX16_RE);
    expect(first?.key).toBe(again?.key as string);
    expect(first?.key).toBe(personKey(ME.id, `u:${CARLOS.id}`));
    expect(first?.key).not.toBe(personKey("u-other", `u:${CARLOS.id}`));
    expect(JSON.stringify(first)).not.toContain(CARLOS.id);
  });

  it("ordem: atrasada, conferir, saldo em aberto, quitado; empate pelo nome", () => {
    const rows = build([
      {
        id: "paid",
        other: { name: "Zeca" },
        installments: [{ status: "paid" }],
      },
      { id: "open", other: { name: "Yuri" } },
      {
        id: "review",
        other: { name: "Xavier" },
        installments: [{ status: "awaiting_confirmation" }],
      },
      {
        id: "late",
        other: { name: "Wanda" },
        installments: [{ dueDate: "2026-09-01" }],
      },
      { id: "open2", other: { name: "álvaro" } },
    ]);
    expect(groupPeople(ME, rows, TODAY, NOW).map((p) => p.name)).toEqual([
      "Wanda",
      "Xavier",
      "álvaro",
      "Yuri",
      "Zeca",
    ]);
  });

  it("os contratos da pessoa vêm do mais novo para o mais antigo, com o resumo de cada um", () => {
    const rows = build([
      {
        id: "old",
        age: 30,
        other: { name: "Ana" },
        installments: [{ status: "paid" }, {}],
      },
      { id: "new", age: 1, other: { name: "Ana" } },
    ]);
    const [person] = groupPeople(ME, rows, TODAY, NOW);
    expect(person?.contracts.map((c) => c.contractId)).toEqual(["new", "old"]);
    expect(person?.contracts[1]).toMatchObject({
      paidCount: 1,
      installmentsCount: 2,
      remainingCents: 10_000,
      nextDueDate: "2026-11-20",
      settled: false,
    });
  });
});

import { describe, expect, it } from "bun:test";
import { buildAgenda } from "../src/lib/home";
import {
  type HomeContractRow,
  type HomeInstallmentRow,
  partyContracts,
} from "../src/lib/home-parties";
import {
  BAR_SEGMENTS_MAX,
  barStatus,
  contractSummary,
} from "../src/lib/home-progress";
import type { InstallmentAction } from "../src/lib/home-types";

const ME = "u-me";
const TODAY = "2026-10-03";

function inst(
  over: Partial<HomeInstallmentRow> & { id: string }
): HomeInstallmentRow {
  return {
    contractId: "c",
    sequence: 1,
    amountCents: 35_000,
    dueDate: "2026-10-30",
    status: "pending",
    paidAt: null,
    lastProofAt: null,
    ...over,
  };
}

describe("barStatus", () => {
  it("paga vence tudo; depois comprovante esperando, atraso, hoje e aberta", () => {
    expect(
      barStatus(
        inst({ id: "a", status: "confirmed", dueDate: "2026-09-01" }),
        TODAY
      )
    ).toBe("paid");
    expect(barStatus(inst({ id: "b", status: "paid" }), TODAY)).toBe("paid");
    expect(
      barStatus(
        inst({
          id: "c",
          status: "awaiting_confirmation",
          dueDate: "2026-09-01",
        }),
        TODAY
      )
    ).toBe("review");
    expect(barStatus(inst({ id: "d", dueDate: "2026-10-02" }), TODAY)).toBe(
      "overdue"
    );
    expect(
      barStatus(
        inst({ id: "e", status: "disputed", dueDate: "2026-10-02" }),
        TODAY
      )
    ).toBe("overdue");
    expect(barStatus(inst({ id: "f", dueDate: TODAY }), TODAY)).toBe("today");
    expect(barStatus(inst({ id: "g", dueDate: "2026-10-04" }), TODAY)).toBe(
      "open"
    );
  });
});

describe("contractSummary", () => {
  it("conta pagas, atrasadas e o que falta, com um status por parcela na ordem da sequência", () => {
    const summary = contractSummary(
      [
        inst({ id: "3", sequence: 3, dueDate: "2026-08-30" }),
        inst({ id: "1", sequence: 1, status: "paid", dueDate: "2026-06-30" }),
        inst({
          id: "2",
          sequence: 2,
          status: "confirmed",
          dueDate: "2026-07-30",
        }),
        inst({ id: "4", sequence: 4, dueDate: TODAY }),
        inst({ id: "5", sequence: 5 }),
      ],
      TODAY
    );
    expect(summary).toEqual({
      paidCount: 2,
      overdueCount: 1,
      remainingCents: 105_000,
      statuses: ["paid", "paid", "overdue", "today", "open"],
    });
  });

  it(`até ${BAR_SEGMENTS_MAX} parcelas há um status por parcela; acima disso, só as contagens`, () => {
    // 4 paid and 2 overdue (all 6 past due), then open ones.
    const many = (count: number) =>
      Array.from({ length: count }, (_, i) =>
        inst({
          id: `i${i + 1}`,
          sequence: i + 1,
          status: i < 4 ? "paid" : "pending",
          dueDate: i < 6 ? "2026-09-30" : "2026-10-30",
        })
      );
    expect(
      contractSummary(many(BAR_SEGMENTS_MAX), TODAY).statuses
    ).toHaveLength(BAR_SEGMENTS_MAX);
    // The counts are what draws the zones: they must hold when statuses is null.
    expect(contractSummary(many(BAR_SEGMENTS_MAX + 1), TODAY)).toEqual({
      paidCount: 4,
      overdueCount: 2,
      remainingCents: (BAR_SEGMENTS_MAX + 1 - 4) * 35_000,
      statuses: null,
    });
  });
});

describe("buildAgenda: o progresso no cartão", () => {
  it("o grupo de atrasadas e o cartão simples do mesmo contrato trazem o mesmo resumo do contrato inteiro", () => {
    const contract: HomeContractRow = {
      id: "c",
      title: "Notebook da Marina",
      ownerId: ME,
      ownerRole: "seller",
      requiresConfirmation: false,
      status: "active",
      installmentsCount: 4,
      createdAt: new Date("2026-06-01T12:00:00Z"),
    };
    const parties = partyContracts(ME, {
      contracts: [contract],
      installments: [
        inst({ id: "1", sequence: 1, status: "paid", dueDate: "2026-07-30" }),
        inst({ id: "2", sequence: 2, dueDate: "2026-08-30" }),
        inst({ id: "3", sequence: 3, dueDate: "2026-09-30" }),
        // Within the 7 days of "due soon": a single card next to the group.
        inst({ id: "4", sequence: 4, dueDate: "2026-10-08" }),
      ],
      participants: [
        {
          contractId: "c",
          role: "seller",
          linkedUserId: ME,
          displayName: "João Souza",
          pixKey: null,
        },
        {
          contractId: "c",
          role: "buyer",
          linkedUserId: null,
          displayName: "Marina Pires",
          pixKey: null,
        },
      ],
      users: [],
    });
    const cards = buildAgenda(parties, [], TODAY)
      .actions as InstallmentAction[];
    expect(cards.map((card) => [card.kind, card.count])).toEqual([
      ["overdue", 2],
      ["due_soon", 1],
    ]);
    const [group, single] = cards;
    expect(group?.contract).toEqual({
      paidCount: 1,
      overdueCount: 2,
      remainingCents: 105_000,
      statuses: ["paid", "overdue", "overdue", "open"],
    });
    // One summary per contract, shared by every card of it.
    expect(single?.contract).toBe(group?.contract);
  });
});

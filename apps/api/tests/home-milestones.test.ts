import { describe, expect, it } from "bun:test";
import { buildMilestones, previousMonth } from "../src/lib/home-milestones";
import { onboardingFacts } from "../src/lib/home-onboarding";
import {
  type HomeContractRow,
  type HomeContractRows,
  type HomeInstallmentRow,
  partyContracts,
} from "../src/lib/home-parties";

const ME = "u-me";
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
    installmentsCount: 4,
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

function milestones(data: Partial<HomeContractRows>) {
  const rows: HomeContractRows = {
    contracts: [],
    installments: [],
    participants: [],
    users: [],
    ...data,
  };
  return buildMilestones(partyContracts(ME, rows), TODAY);
}

describe("previousMonth", () => {
  it("volta um mês, inclusive na virada do ano", () => {
    expect(previousMonth("2026-10")).toBe("2026-09");
    expect(previousMonth("2026-01")).toBe("2025-12");
  });
});

describe("buildMilestones", () => {
  it("mais perto de quitar: maior fração paga entre os contratos em aberto", () => {
    const result = milestones({
      contracts: [
        contractRow({ id: "half", title: "Metade" }),
        contractRow({ id: "most", title: "Quase" }),
        contractRow({ id: "done", title: "Quitado" }),
        contractRow({ id: "none", title: "Nenhuma" }),
      ],
      participants: ["half", "most", "done", "none"].map((contractId) => ({
        contractId,
        role: "buyer",
        linkedUserId: ME,
        displayName: "Eu",
      })),
      installments: [
        inst({ id: "h1", contractId: "half", status: "paid" }),
        inst({ id: "h2", contractId: "half" }),
        inst({ id: "m1", contractId: "most", status: "paid" }),
        inst({ id: "m2", contractId: "most", status: "confirmed" }),
        inst({ id: "m3", contractId: "most", status: "paid" }),
        inst({ id: "m4", contractId: "most" }),
        inst({ id: "d1", contractId: "done", status: "paid" }),
        inst({ id: "n1", contractId: "none" }),
      ],
    });
    expect(result.closestToPayoff).toEqual({
      contractId: "most",
      title: "Quase",
      paidCount: 3,
      totalCount: 4,
      percent: 75,
    });
    expect(result.settled).toEqual({ paidCents: 5 * 10_000, receivedCents: 0 });
  });

  it("pago e recebido no mês pela data do pagamento em São Paulo", () => {
    const result = milestones({
      contracts: [
        contractRow({ id: "pay" }),
        contractRow({ id: "recv", ownerRole: "seller" }),
      ],
      participants: [
        {
          contractId: "pay",
          role: "buyer",
          linkedUserId: ME,
          displayName: "Eu",
        },
        {
          contractId: "recv",
          role: "seller",
          linkedUserId: ME,
          displayName: "Eu",
        },
      ],
      installments: [
        // 2026-10-01T02:00Z is still 30/09 in São Paulo: September, not October.
        inst({
          id: "p1",
          contractId: "pay",
          status: "paid",
          paidAt: new Date("2026-10-01T02:00:00Z"),
        }),
        inst({
          id: "p2",
          contractId: "pay",
          status: "paid",
          paidAt: new Date("2026-10-01T15:00:00Z"),
          amountCents: 2500,
        }),
        inst({
          id: "r1",
          contractId: "recv",
          status: "confirmed",
          paidAt: new Date("2026-10-02T12:00:00Z"),
          amountCents: 7000,
        }),
      ],
    });
    expect(result.monthToDate).toEqual({
      month: "2026-10",
      paidCents: 2500,
      receivedCents: 7000,
    });
    // "Já quitado no total": one total per direction, never summed together.
    expect(result.settled).toEqual({ paidCents: 12_500, receivedCents: 7000 });
  });

  it("tudo em dia no mês passado só quando todas as parcelas de lá foram pagas no prazo", () => {
    const base = {
      contracts: [contractRow({ id: "c" })],
      participants: [
        { contractId: "c", role: "buyer", linkedUserId: ME, displayName: "Eu" },
      ],
    };
    const allPaid = milestones({
      ...base,
      installments: [
        inst({
          id: "a",
          contractId: "c",
          dueDate: "2026-09-10",
          status: "paid",
          paidAt: new Date("2026-09-08T12:00:00Z"),
        }),
        inst({
          id: "b",
          contractId: "c",
          dueDate: "2026-09-25",
          status: "confirmed",
          lastProofAt: new Date("2026-09-24T12:00:00Z"),
          paidAt: new Date("2026-09-24T18:00:00Z"),
        }),
        inst({ id: "c", contractId: "c", dueDate: "2026-10-10" }),
      ],
    });
    expect(allPaid.previousMonthAllClear).toEqual({
      month: "2026-09",
      paidCount: 2,
    });
    const oneOpen = milestones({
      ...base,
      installments: [
        inst({
          id: "a",
          contractId: "c",
          dueDate: "2026-09-10",
          status: "paid",
          paidAt: new Date("2026-09-08T12:00:00Z"),
        }),
        inst({ id: "b", contractId: "c", dueDate: "2026-09-25" }),
      ],
    });
    expect(oneOpen.previousMonthAllClear).toBeNull();
    const nothingDue = milestones({
      ...base,
      installments: [inst({ id: "c", contractId: "c", dueDate: "2026-10-10" })],
    });
    expect(nothingDue.previousMonthAllClear).toBeNull();
  });

  describe("tudo em dia: a data que vale é a de quando o pagador agiu", () => {
    const base = {
      contracts: [contractRow({ id: "c" })],
      participants: [
        { contractId: "c", role: "buyer", linkedUserId: ME, displayName: "Eu" },
      ],
    };

    it("pago no dia do vencimento conta, no relógio de São Paulo", () => {
      const result = milestones({
        ...base,
        installments: [
          // 2026-09-11T02:30Z is still 23:30 of 10/09 in São Paulo: on the due date.
          inst({
            id: "a",
            contractId: "c",
            dueDate: "2026-09-10",
            status: "paid",
            paidAt: new Date("2026-09-11T02:30:00Z"),
          }),
        ],
      });
      expect(result.previousMonthAllClear).toEqual({
        month: "2026-09",
        paidCount: 1,
      });
    });

    it("pago um dia depois do vencimento não conta", () => {
      const result = milestones({
        ...base,
        installments: [
          inst({
            id: "a",
            contractId: "c",
            dueDate: "2026-09-10",
            status: "paid",
            paidAt: new Date("2026-09-11T12:00:00Z"),
          }),
        ],
      });
      expect(result.previousMonthAllClear).toBeNull();
    });

    it("comprovante enviado no prazo e confirmado depois conta", () => {
      const result = milestones({
        ...base,
        contracts: [contractRow({ id: "c", requiresConfirmation: true })],
        installments: [
          inst({
            id: "a",
            contractId: "c",
            dueDate: "2026-09-10",
            status: "confirmed",
            lastProofAt: new Date("2026-09-09T15:00:00Z"),
            // The approver confirmed five days late: confirm also writes paidAt.
            paidAt: new Date("2026-09-15T15:00:00Z"),
          }),
        ],
      });
      expect(result.previousMonthAllClear).toEqual({
        month: "2026-09",
        paidCount: 1,
      });
    });

    it("parcela paga sem nenhuma data (dado antigo) não conta como em dia", () => {
      const result = milestones({
        ...base,
        installments: [
          inst({
            id: "a",
            contractId: "c",
            dueDate: "2026-09-10",
            status: "paid",
          }),
        ],
      });
      expect(result.previousMonthAllClear).toBeNull();
    });
  });
});

describe("onboardingFacts", () => {
  const profile = {
    pixKey: null,
    emailRemindersOptIn: false,
    onboardingDismissedAt: null,
  };

  it("conta nova: nada feito", () => {
    expect(
      onboardingFacts(
        ME,
        { contracts: [], installments: [], participants: [], users: [] },
        profile,
        true
      )
    ).toEqual({
      hasContract: false,
      hasPixKey: false,
      hasCounterparty: false,
      remindersOn: false,
      remindersAvailable: true,
      counterpartyContractId: null,
      dismissedAt: null,
    });
  });

  it("outra parte = alguém além de mim; o link vai para o meu contrato mais recente", () => {
    const facts = onboardingFacts(
      ME,
      {
        contracts: [
          contractRow({
            id: "old",
            createdAt: new Date("2026-08-01T00:00:00Z"),
          }),
          contractRow({
            id: "new",
            createdAt: new Date("2026-09-20T00:00:00Z"),
          }),
        ],
        installments: [],
        participants: [
          {
            contractId: "old",
            role: "buyer",
            linkedUserId: ME,
            displayName: "Eu",
          },
          {
            contractId: "new",
            role: "buyer",
            linkedUserId: ME,
            displayName: "Eu",
          },
          {
            contractId: "new",
            role: "seller",
            linkedUserId: null,
            displayName: "Maria",
          },
        ],
        users: [],
      },
      {
        pixKey: "joao@example.com",
        emailRemindersOptIn: true,
        onboardingDismissedAt: new Date("2026-10-01T10:00:00Z"),
      },
      false
    );
    expect(facts).toEqual({
      hasContract: true,
      hasPixKey: true,
      hasCounterparty: true,
      remindersOn: true,
      remindersAvailable: false,
      counterpartyContractId: "new",
      dismissedAt: "2026-10-01T10:00:00.000Z",
    });
  });

  it("contrato cancelado não conta para nenhum passo", () => {
    const facts = onboardingFacts(
      ME,
      {
        contracts: [contractRow({ id: "gone", status: "cancelled" })],
        installments: [],
        participants: [
          {
            contractId: "gone",
            role: "buyer",
            linkedUserId: ME,
            displayName: "Eu",
          },
          {
            contractId: "gone",
            role: "seller",
            linkedUserId: null,
            displayName: "Maria",
          },
        ],
        users: [],
      },
      profile,
      true
    );
    expect(facts).toMatchObject({
      hasContract: false,
      hasCounterparty: false,
      counterpartyContractId: null,
    });
  });

  it("quem entrou por convite já tem contrato (e a outra parte é quem convidou)", () => {
    const facts = onboardingFacts(
      ME,
      {
        contracts: [contractRow({ id: "guest", ownerId: "u-owner" })],
        installments: [],
        participants: [
          {
            contractId: "guest",
            role: "buyer",
            linkedUserId: "u-owner",
            displayName: "Ana",
          },
          {
            contractId: "guest",
            role: "seller",
            linkedUserId: ME,
            displayName: "Eu",
          },
        ],
        users: [],
      },
      profile,
      true
    );
    expect(facts).toMatchObject({
      hasContract: true,
      hasCounterparty: true,
      // The guest owns no contract: "invite the other party" leads to a new one.
      counterpartyContractId: null,
    });
  });
});

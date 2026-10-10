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
        pixKey: null,
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
      remainingCount: 1,
      nextDueDate: "2026-10-20",
    });
    expect(result.settled).toEqual({
      paidCents: 5 * 10_000,
      receivedCents: 0,
      payableTotalCents: 8 * 10_000,
      receivableTotalCents: 0,
    });
  });

  describe("mais perto de quitar: o percentual fica entre 50% e 99% em contrato em aberto", () => {
    const base = {
      contracts: [contractRow({ id: "c", title: "Carro" })],
      participants: [
        {
          contractId: "c",
          role: "buyer",
          linkedUserId: ME,
          displayName: "Eu",
          pixKey: null,
        },
      ],
    };

    it("R$ 40,00 em aberto de R$ 10.000,00 (99,6%) mostra 99%, nunca 100%", () => {
      const result = milestones({
        ...base,
        installments: [
          inst({
            id: "a",
            contractId: "c",
            status: "paid",
            amountCents: 996_000,
          }),
          inst({ id: "b", contractId: "c", amountCents: 4000 }),
        ],
      });
      expect(result.closestToPayoff?.percent).toBe(99);
    });

    it("abaixo de 50% não é marco: R$ 1,00 pago de R$ 100.000,00 não vira 'mais perto de quitar'", () => {
      const result = milestones({
        ...base,
        installments: [
          inst({ id: "a", contractId: "c", status: "paid", amountCents: 100 }),
          inst({ id: "b", contractId: "c", amountCents: 9_999_900 }),
        ],
      });
      expect(result.closestToPayoff).toBeNull();
    });

    it("49% ainda não vale; 50% já vale, pelo mesmo % arredondado que a tela mostra", () => {
      const at = (paid: number) =>
        milestones({
          ...base,
          installments: [
            inst({
              id: "a",
              contractId: "c",
              status: "paid",
              amountCents: paid,
            }),
            inst({ id: "b", contractId: "c", amountCents: 10_000 - paid }),
          ],
        }).closestToPayoff;
      expect(at(4900)).toBeNull();
      expect(at(5000)?.percent).toBe(50);
      // Decision 5: 49.5% shows as 50%, so it counts; 49.49% shows as 49%, so it doesn't.
      expect(at(4950)?.percent).toBe(50);
      expect(at(4949)).toBeNull();
    });

    it("falta 1: traz quantas faltam e a data da próxima em aberto", () => {
      const result = milestones({
        ...base,
        installments: [
          // The paid ones fell due earlier: their dates never count as "next".
          inst({
            id: "a",
            contractId: "c",
            sequence: 1,
            status: "paid",
            dueDate: "2026-08-13",
          }),
          inst({
            id: "b",
            contractId: "c",
            sequence: 2,
            status: "confirmed",
            dueDate: "2026-09-13",
          }),
          inst({
            id: "c",
            contractId: "c",
            sequence: 3,
            dueDate: "2026-10-13",
          }),
        ],
      });
      expect(result.closestToPayoff).toMatchObject({
        remainingCount: 1,
        nextDueDate: "2026-10-13",
      });
    });

    it("a próxima é a menor data entre as em aberto, em qualquer ordem, nunca a de uma paga", () => {
      const result = milestones({
        ...base,
        installments: [
          inst({
            id: "a",
            contractId: "c",
            sequence: 1,
            status: "paid",
            dueDate: "2026-08-13",
          }),
          inst({
            id: "b",
            contractId: "c",
            sequence: 2,
            status: "paid",
            dueDate: "2026-09-13",
          }),
          // Out of order on purpose: the first open one in the list is not the next.
          inst({
            id: "d",
            contractId: "c",
            sequence: 4,
            dueDate: "2026-11-13",
          }),
          inst({
            id: "c",
            contractId: "c",
            sequence: 3,
            dueDate: "2026-10-13",
          }),
        ],
      });
      expect(result.closestToPayoff).toMatchObject({
        percent: 50,
        remainingCount: 2,
        nextDueDate: "2026-10-13",
      });
    });
  });

  it("pago no mês: quem paga conta pelo comprovante, quem recebe pela confirmação", () => {
    const result = milestones({
      contracts: [
        contractRow({ id: "pay", requiresConfirmation: true }),
        contractRow({
          id: "recv",
          ownerRole: "seller",
          requiresConfirmation: true,
        }),
      ],
      participants: [
        {
          contractId: "pay",
          role: "buyer",
          linkedUserId: ME,
          displayName: "Eu",
          pixKey: null,
        },
        {
          contractId: "recv",
          role: "seller",
          linkedUserId: ME,
          displayName: "Eu",
          pixKey: null,
        },
      ],
      installments: [
        // Proof sent in September, confirmed in October: the payer paid in September.
        inst({
          id: "p1",
          contractId: "pay",
          status: "confirmed",
          lastProofAt: new Date("2026-09-30T15:00:00Z"),
          paidAt: new Date("2026-10-01T15:00:00Z"),
        }),
        inst({
          id: "p2",
          contractId: "pay",
          status: "confirmed",
          lastProofAt: new Date("2026-10-01T15:00:00Z"),
          paidAt: new Date("2026-10-02T15:00:00Z"),
          amountCents: 2500,
        }),
        // Same dates on the receiving side: received when it was confirmed, in October.
        inst({
          id: "r1",
          contractId: "recv",
          status: "confirmed",
          lastProofAt: new Date("2026-09-30T15:00:00Z"),
          paidAt: new Date("2026-10-01T15:00:00Z"),
          amountCents: 7000,
        }),
      ],
    });
    expect(result.monthToDate).toEqual({
      month: "2026-10",
      paidCents: 2500,
      receivedCents: 7000,
    });
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
          pixKey: null,
        },
        {
          contractId: "recv",
          role: "seller",
          linkedUserId: ME,
          displayName: "Eu",
          pixKey: null,
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
    expect(result.settled).toEqual({
      paidCents: 12_500,
      receivedCents: 7000,
      payableTotalCents: 12_500,
      receivableTotalCents: 7000,
    });
  });

  it("tudo em dia no mês passado só quando todas as parcelas de lá foram pagas no prazo", () => {
    const base = {
      contracts: [contractRow({ id: "c" })],
      participants: [
        {
          contractId: "c",
          role: "buyer",
          linkedUserId: ME,
          displayName: "Eu",
          pixKey: null,
        },
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
        {
          contractId: "c",
          role: "buyer",
          linkedUserId: ME,
          displayName: "Eu",
          pixKey: null,
        },
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

    it("pago à meia-noite do dia seguinte, no relógio de São Paulo, já não conta", () => {
      const result = milestones({
        ...base,
        installments: [
          // 2026-09-11T03:00Z is 00:00 of 11/09 in São Paulo: one day late.
          inst({
            id: "a",
            contractId: "c",
            dueDate: "2026-09-10",
            status: "paid",
            paidAt: new Date("2026-09-11T03:00:00Z"),
          }),
        ],
      });
      expect(result.previousMonthAllClear).toBeNull();
    });

    it("confirmada sem comprovante (dado antigo) cai no paidAt: no prazo conta", () => {
      const result = milestones({
        ...base,
        installments: [
          inst({
            id: "a",
            contractId: "c",
            dueDate: "2026-09-10",
            status: "confirmed",
            lastProofAt: null,
            paidAt: new Date("2026-09-10T12:00:00Z"),
          }),
        ],
      });
      expect(result.previousMonthAllClear).toEqual({
        month: "2026-09",
        paidCount: 1,
      });
    });

    it("confirmada sem comprovante (dado antigo) cai no paidAt: depois do vencimento não conta", () => {
      const result = milestones({
        ...base,
        installments: [
          inst({
            id: "a",
            contractId: "c",
            dueDate: "2026-09-10",
            status: "confirmed",
            lastProofAt: null,
            paidAt: new Date("2026-09-12T12:00:00Z"),
          }),
        ],
      });
      expect(result.previousMonthAllClear).toBeNull();
    });

    it("comprovante esperando confirmação não fecha o mês em dia", () => {
      const result = milestones({
        ...base,
        contracts: [contractRow({ id: "c", requiresConfirmation: true })],
        installments: [
          inst({
            id: "a",
            contractId: "c",
            dueDate: "2026-09-10",
            status: "awaiting_confirmation",
            lastProofAt: new Date("2026-09-09T15:00:00Z"),
          }),
        ],
      });
      expect(result.previousMonthAllClear).toBeNull();
    });
  });

  it("o total por direção soma os contratos em aberto e os quitados, e nunca junta as duas direções", () => {
    const result = milestones({
      contracts: [
        contractRow({ id: "pay", ownerRole: "buyer" }),
        contractRow({ id: "recv", ownerRole: "seller" }),
        contractRow({ id: "done", ownerRole: "seller" }),
      ],
      participants: [
        {
          contractId: "pay",
          role: "buyer",
          linkedUserId: ME,
          displayName: "Eu",
          pixKey: null,
        },
        {
          contractId: "recv",
          role: "seller",
          linkedUserId: ME,
          displayName: "Eu",
          pixKey: null,
        },
        {
          contractId: "done",
          role: "seller",
          linkedUserId: ME,
          displayName: "Eu",
          pixKey: null,
        },
      ],
      installments: [
        inst({
          id: "p1",
          contractId: "pay",
          status: "paid",
          amountCents: 180_000,
        }),
        inst({
          id: "p2",
          contractId: "pay",
          sequence: 2,
          amountCents: 180_000,
        }),
        inst({
          id: "r1",
          contractId: "recv",
          status: "paid",
          amountCents: 35_000,
        }),
        inst({
          id: "r2",
          contractId: "recv",
          sequence: 2,
          amountCents: 35_000,
        }),
        inst({
          id: "d1",
          contractId: "done",
          status: "confirmed",
          amountCents: 25_000,
        }),
      ],
    });
    expect(result.settled).toEqual({
      paidCents: 180_000,
      payableTotalCents: 360_000,
      receivedCents: 60_000,
      receivableTotalCents: 95_000,
    });
  });
});

describe("onboardingFacts", () => {
  const profile = {
    pixKey: null,
    emailRemindersOptIn: false,
    onboardingDismissedAt: null,
    createdAt: new Date("2026-09-01T12:00:00Z"),
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
      accountCreatedOn: "2026-09-01",
      activePartyContracts: 0,
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
            pixKey: null,
          },
          {
            contractId: "new",
            role: "buyer",
            linkedUserId: ME,
            displayName: "Eu",
            pixKey: null,
          },
          {
            contractId: "new",
            role: "seller",
            linkedUserId: null,
            displayName: "Maria",
            pixKey: null,
          },
        ],
        users: [],
      },
      {
        pixKey: "joao@example.com",
        emailRemindersOptIn: true,
        onboardingDismissedAt: new Date("2026-10-01T10:00:00Z"),
        createdAt: new Date("2026-09-01T12:00:00Z"),
      },
      false
    );
    expect(facts).toEqual({
      accountCreatedOn: "2026-09-01",
      activePartyContracts: 2,
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
            pixKey: null,
          },
          {
            contractId: "gone",
            role: "seller",
            linkedUserId: null,
            displayName: "Maria",
            pixKey: null,
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
            pixKey: null,
          },
          {
            contractId: "guest",
            role: "seller",
            linkedUserId: ME,
            displayName: "Eu",
            pixKey: null,
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

  it("só um espectador além de mim não é a outra parte", () => {
    const facts = onboardingFacts(
      ME,
      {
        contracts: [contractRow({ id: "mine" })],
        installments: [],
        participants: [
          {
            contractId: "mine",
            role: "buyer",
            linkedUserId: ME,
            displayName: "Eu",
            pixKey: null,
          },
          {
            contractId: "mine",
            role: "viewer",
            linkedUserId: null,
            displayName: "Pai",
            pixKey: null,
          },
        ],
        users: [],
      },
      profile,
      true
    );
    expect(facts).toMatchObject({
      hasContract: true,
      hasCounterparty: false,
      counterpartyContractId: "mine",
    });
  });

  it("quem só acompanha o contrato de outra pessoa tem contrato, mas não tem outra parte", () => {
    const facts = onboardingFacts(
      ME,
      {
        contracts: [contractRow({ id: "watched", ownerId: "u-owner" })],
        installments: [],
        participants: [
          {
            contractId: "watched",
            role: "buyer",
            linkedUserId: "u-owner",
            displayName: "Ana",
            pixKey: null,
          },
          {
            contractId: "watched",
            role: "seller",
            linkedUserId: "u-seller",
            displayName: "Bruno",
            pixKey: null,
          },
          {
            contractId: "watched",
            role: "viewer",
            linkedUserId: ME,
            displayName: "Eu",
            pixKey: null,
          },
        ],
        users: [],
      },
      profile,
      true
    );
    expect(facts).toMatchObject({
      hasContract: true,
      hasCounterparty: false,
      counterpartyContractId: null,
    });
  });

  it("contratos ativos em que é parte: os acompanhados, os concluídos e os cancelados não contam", () => {
    const facts = onboardingFacts(
      ME,
      {
        contracts: [
          contractRow({ id: "mine" }),
          contractRow({ id: "followed", ownerId: "u-owner" }),
          contractRow({ id: "gone", status: "cancelled" }),
          contractRow({ id: "done", status: "completed" }),
        ],
        installments: [],
        participants: [
          {
            contractId: "mine",
            role: "buyer",
            linkedUserId: ME,
            displayName: "Eu",
            pixKey: null,
          },
          {
            contractId: "followed",
            role: "viewer",
            linkedUserId: ME,
            displayName: "Eu",
            pixKey: null,
          },
          {
            contractId: "gone",
            role: "buyer",
            linkedUserId: ME,
            displayName: "Eu",
            pixKey: null,
          },
          {
            contractId: "done",
            role: "buyer",
            linkedUserId: ME,
            displayName: "Eu",
            pixKey: null,
          },
        ],
        users: [],
      },
      profile,
      true
    );
    expect(facts.activePartyContracts).toBe(1);
  });

  it("contrato quitado com status active não conta para o guia", () => {
    // Nothing writes `completed` yet: a paid-off contract stays `active`.
    const facts = onboardingFacts(
      ME,
      {
        contracts: [
          contractRow({ id: "running", installmentsCount: 2 }),
          contractRow({ id: "paid-off", installmentsCount: 2 }),
        ],
        installments: [
          inst({ contractId: "running", id: "r1", status: "paid" }),
          inst({ contractId: "running", id: "r2", sequence: 2 }),
          inst({ contractId: "paid-off", id: "p1", status: "paid" }),
          inst({
            contractId: "paid-off",
            id: "p2",
            sequence: 2,
            status: "confirmed",
          }),
        ],
        participants: ["running", "paid-off"].map((contractId) => ({
          contractId,
          role: "buyer",
          linkedUserId: ME,
          displayName: "Eu",
          pixKey: null,
        })),
        users: [],
      },
      profile,
      true
    );
    expect(facts.activePartyContracts).toBe(1);
  });

  it("o dia da conta é o de São Paulo: 01:30 UTC ainda é a véspera lá", () => {
    const facts = onboardingFacts(
      ME,
      { contracts: [], installments: [], participants: [], users: [] },
      { ...profile, createdAt: new Date("2026-09-02T01:30:00Z") },
      true
    );
    expect(facts.accountCreatedOn).toBe("2026-09-01");
  });
});

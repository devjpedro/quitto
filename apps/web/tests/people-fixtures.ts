import type { Person, PersonContract } from "@/features/people/types";

export function personContract(
  overrides: Partial<PersonContract> = {}
): PersonContract {
  return {
    contractId: "c1",
    title: "Empréstimo do Carlos",
    direction: "pay",
    installmentsCount: 10,
    paidCount: 6,
    remainingCents: 200_000,
    overdueCount: 0,
    reviewCount: 0,
    nextDueDate: "2026-10-20",
    settled: false,
    ...overrides,
  };
}

/** A person you owe R$ 2.000,00, with one contract, on track. */
export function person(overrides: Partial<Person> = {}): Person {
  return {
    key: "0123456789abcdef",
    name: "Carlos Lima",
    account: "none",
    email: null,
    owesYouCents: 0,
    youOweCents: 200_000,
    overdueCount: 0,
    reviewCount: 0,
    lastContractAt: "2026-04-01T12:00:00.000Z",
    contracts: [personContract()],
    ...overrides,
  };
}

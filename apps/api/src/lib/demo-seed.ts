import { NOTIFICATION_TYPE } from "@quitto/shared";
import { addDays } from "./dates";
import {
  account,
  at,
  base,
  type DemoContract,
  type DemoNotification,
  type DemoScenario,
  monthly,
  shiftMonths,
} from "./demo-seed-kit";

function scenarioA(t: string): DemoContract[] {
  const moto = monthly({
    amountCents: 48_000,
    months: 10,
    firstDueDate: shiftMonths(addDays(t, -5), -2),
    paid: 2,
    confirmed: true,
    review: 3,
  }).map((it) =>
    it.sequence === 3 ? { ...it, proofAt: at(t, -1, "13:00") } : it
  );
  return [
    {
      ...base(
        "notebook",
        "agora",
        "Notebook da Marina",
        "seller",
        "Marina Pires"
      ),
      createdDaysAgo: 40,
      installments: monthly({
        amountCents: 35_000,
        months: 12,
        firstDueDate: addDays(shiftMonths(t, -3), -3),
        paid: 2,
      }),
    },
    {
      ...base("aluguel", "agora", "Aluguel da sala", "buyer", "Helena Duarte"),
      pixKey: "helena.duarte@exemplo.com",
      createdDaysAgo: 60,
      installments: monthly({
        amountCents: 180_000,
        months: 12,
        firstDueDate: shiftMonths(addDays(t, -2), -4),
        paid: 4,
      }),
    },
    {
      ...base("moto", "agora", "Moto do Rafa", "seller", "Rafael Prado"),
      requiresConfirmation: true,
      createdDaysAgo: 70,
      installments: moto,
    },
    {
      ...base(
        "emprestimo",
        "agora",
        "Empréstimo do Carlos",
        "buyer",
        "Carlos Lima"
      ),
      pixKey: "carlos.lima@exemplo.com",
      createdDaysAgo: 90,
      installments: monthly({
        amountCents: 50_000,
        months: 10,
        firstDueDate: shiftMonths(t, -6),
        paid: 6,
        today: { sequence: 7, todayISO: t },
      }),
    },
    {
      ...base("celular", "agora", "Celular da Ana", "seller", "Ana Rocha"),
      createdDaysAgo: 120,
      installments: monthly({
        amountCents: 32_000,
        months: 10,
        firstDueDate: shiftMonths(addDays(t, 10), -9),
        paid: 9,
      }),
    },
    {
      ...base("camera", "agora", "Câmera da Júlia", "seller", "Júlia Nogueira"),
      createdDaysAgo: 150,
      installments: monthly({
        amountCents: 25_000,
        months: 6,
        firstDueDate: shiftMonths(addDays(t, 17), -4),
        paid: 4,
      }),
    },
    {
      ...base(
        "floripa",
        "bia",
        "Viagem para Floripa (dividida)",
        "seller",
        "João Souza"
      ),
      invite: "agora",
      createdDaysAgo: 1,
      installments: monthly({
        amountCents: 30_000,
        months: 4,
        firstDueDate: addDays(t, 38),
        paid: 0,
      }),
    },
  ];
}

function scenarioOwnerAndNew(t: string): DemoContract[] {
  return [
    {
      ...base(
        "terreno",
        "atraso",
        "Venda do terreno",
        "seller",
        "Diego Martins"
      ),
      createdDaysAgo: 720,
      installments: monthly({
        amountCents: 200_000,
        months: 60,
        firstDueDate: shiftMonths(addDays(t, 25), -28),
        paid: 4,
      }),
    },
    {
      ...base(
        "reforma",
        "atraso",
        "Reforma da cozinha",
        "buyer",
        "Sérgio Almeida"
      ),
      pixKey: "sergio.almeida@exemplo.com",
      createdDaysAgo: 6,
      installments: monthly({
        amountCents: 80_000,
        months: 12,
        firstDueDate: addDays(t, 12),
        paid: 0,
      }),
    },
    {
      ...base(
        "bicicleta",
        "novo",
        "Bicicleta do Theo",
        "seller",
        "Theo Martins"
      ),
      createdDaysAgo: 1,
      installments: monthly({
        amountCents: 24_000,
        months: 5,
        firstDueDate: addDays(t, 5),
        paid: 0,
      }),
    },
  ];
}

/** Three actions in three contracts: the case of open question 3 (a free track from 1536 px). */
function scenarioThree(t: string): DemoContract[] {
  return [
    {
      ...base("curso", "tres", "Curso de inglês", "buyer", "Beatriz Melo"),
      pixKey: "beatriz.melo@exemplo.com",
      createdDaysAgo: 80,
      installments: monthly({
        amountCents: 45_000,
        months: 6,
        firstDueDate: shiftMonths(addDays(t, -9), -2),
        paid: 2,
      }),
    },
    {
      ...base("freezer", "tres", "Freezer da loja", "seller", "Otávio Reis"),
      createdDaysAgo: 100,
      installments: monthly({
        amountCents: 60_000,
        months: 8,
        firstDueDate: shiftMonths(addDays(t, -4), -3),
        paid: 3,
      }),
    },
    {
      ...base(
        "eletrica",
        "tres",
        "Bicicleta elétrica",
        "seller",
        "Igor Santos"
      ),
      createdDaysAgo: 160,
      installments: monthly({
        amountCents: 38_000,
        months: 10,
        firstDueDate: shiftMonths(addDays(t, 3), -5),
        paid: 5,
      }),
    },
  ];
}

function notifications(t: string): DemoNotification[] {
  const quadroA: DemoNotification[] = [
    {
      account: "agora",
      contract: "moto",
      type: NOTIFICATION_TYPE.proofSubmitted,
      sequence: 3,
      at: at(t, -1, "13:00"),
      read: false,
      // As modules/payments.ts writes it: the uploaded file's name.
      metadata: { fileName: "comprovante.pdf" },
    },
    {
      account: "agora",
      contract: "aluguel",
      type: NOTIFICATION_TYPE.installmentOverdue,
      sequence: 5,
      at: at(t, -1, "11:00"),
      read: false,
      metadata: null,
    },
    {
      account: "agora",
      contract: "notebook",
      type: NOTIFICATION_TYPE.installmentOverdueReceivable,
      sequence: 4,
      at: at(t, -2, "11:00"),
      read: false,
      metadata: null,
    },
    {
      account: "agora",
      contract: "emprestimo",
      type: NOTIFICATION_TYPE.installmentDueSoon,
      sequence: 7,
      at: at(t, -3, "11:00"),
      read: true,
      metadata: null,
    },
  ];
  // The owner's case: the reminder sweep wrote one notice per overdue
  // installment, in a row (sequences 28 down to 5, a second apart).
  const terreno = Array.from(
    { length: 24 },
    (_, i): DemoNotification => ({
      account: "atraso",
      contract: "terreno",
      type: NOTIFICATION_TYPE.installmentOverdueReceivable,
      sequence: 28 - i,
      at: `${addDays(t, -2)}T11:00:${String(59 - i).padStart(2, "0")}.000Z`,
      read: false,
      metadata: null,
    })
  );
  return [...quadroA, ...terreno];
}

/**
 * The demo data of this phase (mockup 13): scenario A for `agora`, the
 * owner's case (24 overdue installments) for `atraso`, a new account with
 * the guide for `novo` and exactly three actions for `tres`. Every date is
 * relative to `todayISO`, so the screens stay the same any day; with
 * 2026-10-03 they are the mockup's. Credible names and numbers that add up
 * (DIRECAO › Checklist).
 */
export function demoScenario(todayISO: string): DemoScenario {
  return {
    accounts: [
      account("agora", "João Souza", 400, "joao.souza@exemplo.com"),
      account("atraso", "Renata Campos", 760, "renata.campos@exemplo.com"),
      account("novo", "Lucas Teixeira", 2, null),
      account("tres", "Carla Nunes", 200, "carla.nunes@exemplo.com"),
      account("bia", "Bia Lopes", 300, "bia.lopes@exemplo.com"),
    ],
    contracts: [
      ...scenarioA(todayISO),
      ...scenarioOwnerAndNew(todayISO),
      ...scenarioThree(todayISO),
    ],
    notifications: notifications(todayISO),
  };
}

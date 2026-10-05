import { describe, expect, it } from "bun:test";
import { NOTIFICATION_TYPE } from "@quitto/shared";
import { demoScenario } from "../src/lib/demo-seed";
import {
  assertDemoEnvironment,
  type DemoAccountKey,
  type DemoScenario,
  reminderDedupeKey,
  shiftMonths,
} from "../src/lib/demo-seed-kit";
import { buildAgenda } from "../src/lib/home";
import { buildMilestones } from "../src/lib/home-milestones";
import { type HomeContractRows, partyContracts } from "../src/lib/home-parties";
import type { InstallmentAction } from "../src/lib/home-types";
import { computeReminders } from "../src/lib/reminders";

const T = "2026-10-03";
const DAY_MS = 86_400_000;
// Top-level regex literal (lint/performance/useTopLevelRegex).
const TEST_WORDS = /teste|testando|administrador|lorem/;

/** The scenario as the home would read it for one account (ids are the keys). */
function rowsFor(
  scenario: DemoScenario,
  account: DemoAccountKey
): HomeContractRows {
  const now = Date.parse(`${T}T15:00:00Z`);
  const mine = scenario.contracts.filter((c) => c.owner === account);
  return {
    contracts: mine.map((c) => ({
      id: c.key,
      title: c.title,
      ownerId: account,
      ownerRole: c.ownerRole,
      requiresConfirmation: c.requiresConfirmation,
      status: "active",
      pixKey: c.pixKey,
      installmentsCount: c.installments.length,
      createdAt: new Date(now - c.createdDaysAgo * DAY_MS),
    })),
    installments: mine.flatMap((c) =>
      c.installments.map((it) => ({
        id: `${c.key}-${it.sequence}`,
        contractId: c.key,
        sequence: it.sequence,
        amountCents: it.amountCents,
        dueDate: it.dueDate,
        status: it.status,
        paidAt: it.paidAt ? new Date(it.paidAt) : null,
        lastProofAt: it.proofAt ? new Date(it.proofAt) : null,
      }))
    ),
    participants: mine.flatMap((c) => [
      {
        contractId: c.key,
        displayName: "Dono",
        role: c.ownerRole,
        linkedUserId: account,
      },
      {
        contractId: c.key,
        displayName: c.counterpart.displayName,
        role: c.counterpart.role,
        linkedUserId: null,
      },
    ]),
    users: [{ id: account, name: "Dono", pixKey: null }],
  };
}

describe("shiftMonths", () => {
  it("anda para trás e para a frente atravessando o ano, com o dia no fim do mês", () => {
    expect(shiftMonths("2026-10-28", -28)).toBe("2024-06-28");
    expect(shiftMonths("2026-01-15", -1)).toBe("2025-12-15");
    expect(shiftMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(shiftMonths("2026-11-30", 3)).toBe("2027-02-28");
  });
});

describe("assertDemoEnvironment", () => {
  const local = {
    DATABASE_URL: "postgres://postgres:postgres@localhost:5432/quitto",
    NODE_ENV: "development",
    S3_ENDPOINT: "http://localhost:9000",
  };

  it("aceita o ambiente local, inclusive com a chave do Resend vazia", () => {
    expect(() => assertDemoEnvironment(local)).not.toThrow();
    expect(() =>
      assertDemoEnvironment({ ...local, RESEND_API_KEY: "" })
    ).not.toThrow();
  });

  it("aceita 127.0.0.1 e o IPv6 local com colchetes ([::1], como o hostname da URL o devolve)", () => {
    expect(() =>
      assertDemoEnvironment({
        ...local,
        DATABASE_URL: "postgres://u:p@127.0.0.1:5432/quitto",
        S3_ENDPOINT: "http://127.0.0.1:9000",
      })
    ).not.toThrow();
    expect(() =>
      assertDemoEnvironment({
        ...local,
        DATABASE_URL: "postgres://u:p@[::1]:5432/quitto",
        S3_ENDPOINT: "http://[::1]:9000",
      })
    ).not.toThrow();
  });

  it("recusa produção", () => {
    expect(() =>
      assertDemoEnvironment({ ...local, NODE_ENV: "production" })
    ).toThrow("produção");
  });

  it("recusa banco remoto, inclusive o nome de serviço 'postgres'", () => {
    expect(() =>
      assertDemoEnvironment({
        ...local,
        DATABASE_URL: "postgres://u:p@db.quitto.app:5432/quitto",
      })
    ).toThrow("local");
    expect(() =>
      assertDemoEnvironment({
        ...local,
        DATABASE_URL: "postgres://u:p@postgres:5432/quitto",
      })
    ).toThrow("local");
  });

  it("recusa um S3 que não é local, e a falta dele", () => {
    expect(() =>
      assertDemoEnvironment({
        ...local,
        S3_ENDPOINT: "https://abc.r2.cloudflarestorage.com",
      })
    ).toThrow("S3");
    expect(() =>
      assertDemoEnvironment({ ...local, S3_ENDPOINT: undefined })
    ).toThrow("S3");
    // The compose service name, like 'postgres' for the database.
    expect(() =>
      assertDemoEnvironment({ ...local, S3_ENDPOINT: "http://minio:9000" })
    ).toThrow("S3");
  });

  it("recusa RESEND_API_KEY definido: o cadastro mandaria e-mail de verdade", () => {
    expect(() =>
      assertDemoEnvironment({ ...local, RESEND_API_KEY: "re_123" })
    ).toThrow("RESEND_API_KEY");
  });
});

describe("demoScenario: os números do mockup 13", () => {
  const scenario = demoScenario(T);

  it("cenário A: 5 ações na ordem aprovada, o grupo da Marina e os chips", () => {
    const agenda = buildAgenda(
      partyContracts("agora", rowsFor(scenario, "agora")),
      [],
      T
    );
    const cards = agenda.actions as InstallmentAction[];
    expect(cards.map((a) => [a.contractTitle, a.kind, a.count])).toEqual([
      ["Notebook da Marina", "overdue", 2],
      ["Aluguel da sala", "overdue", 1],
      ["Empréstimo do Carlos", "due_soon", 1],
      ["Moto do Rafa", "review", 1],
    ]);
    expect(cards[2]?.dueDate).toBe(T);
    expect(cards[0]?.totalCents).toBe(70_000);
    expect(agenda.upcoming.items.map((i) => i.contractTitle)).toEqual([
      "Celular da Ana",
      "Câmera da Júlia",
      "Moto do Rafa",
      "Notebook da Marina",
      "Aluguel da sala",
    ]);
    expect(agenda.upcoming.toPayCents).toBe(230_000);
    expect(agenda.upcoming.toReceiveCents).toBe(140_000);
    expect(agenda.overdue).toEqual({
      toPayCents: 180_000,
      toReceiveCents: 70_000,
    });
  });

  it("cenário A: marcos e o mais perto de quitar", () => {
    const ms = buildMilestones(
      partyContracts("agora", rowsFor(scenario, "agora")),
      T
    );
    expect(ms.settled).toEqual({
      paidCents: 1_020_000,
      payableTotalCents: 2_660_000,
      receivedCents: 554_000,
      receivableTotalCents: 1_370_000,
    });
    expect(ms.closestToPayoff).toMatchObject({
      title: "Celular da Ana",
      percent: 90,
      remainingCount: 1,
      nextDueDate: "2026-10-13",
    });
    expect(ms.previousMonthAllClear).toBeNull();
  });

  it("contrato com confirmação: as pagas são 'confirmed', como o produto gera", () => {
    const moto = scenario.contracts.find((c) => c.key === "moto");
    expect(moto?.installments.slice(0, 3).map((it) => it.status)).toEqual([
      "confirmed",
      "confirmed",
      "awaiting_confirmation",
    ]);
  });

  it("caso do dono: 24 atrasadas são 1 cartão, sem 'mais perto de quitar' (7%)", () => {
    const rows = rowsFor(scenario, "atraso");
    const agenda = buildAgenda(partyContracts("atraso", rows), [], T);
    expect(agenda.actions).toHaveLength(1);
    expect(agenda.actions[0]).toMatchObject({
      count: 24,
      totalCents: 4_800_000,
    });
    expect(agenda.upcoming.toPayCents).toBe(80_000);
    expect(agenda.upcoming.toReceiveCents).toBe(200_000);
    expect(
      buildMilestones(partyContracts("atraso", rows), T).closestToPayoff
    ).toBeNull();
  });

  it("conta 'tres': exatamente 3 ações, em contratos diferentes", () => {
    const agenda = buildAgenda(
      partyContracts("tres", rowsFor(scenario, "tres")),
      [],
      T
    );
    expect(
      (agenda.actions as InstallmentAction[]).map((a) => [
        a.contractTitle,
        a.kind,
      ])
    ).toEqual([
      ["Curso de inglês", "overdue"],
      ["Freezer da loja", "overdue"],
      ["Bicicleta elétrica", "due_soon"],
    ]);
  });

  it("o convite e os avisos apontam para contratos e contas que existem", () => {
    const keys = new Set(scenario.contracts.map((c) => c.key));
    const accounts = new Set(scenario.accounts.map((a) => a.key));
    for (const n of scenario.notifications) {
      expect(keys.has(n.contract)).toBe(true);
      expect(accounts.has(n.account)).toBe(true);
    }
    const floripa = scenario.contracts.find((c) => c.key === "floripa");
    expect(floripa).toMatchObject({ owner: "bia", invite: "agora" });
    expect(
      scenario.notifications.filter(
        (n) => n.account === "atraso" && n.contract === "terreno"
      )
    ).toHaveLength(24);
  });

  it("dados críveis: nenhum nome de teste", () => {
    const texts = [
      ...scenario.accounts.map((a) => a.name),
      ...scenario.contracts.flatMap((c) => [
        c.title,
        c.counterpart.displayName,
      ]),
    ];
    for (const text of texts) {
      expect(text.toLowerCase()).not.toMatch(TEST_WORDS);
    }
  });
});

describe("reminderDedupeKey: o seed grava a chave da varredura", () => {
  const scenario = demoScenario(T);

  it("um cron:reminders depois do seed bate nas chaves gravadas e não duplica os avisos", () => {
    // What the sweep would write today for the demo installments. No slot is
    // linked to another account, so the owner pays, and receives as the seller.
    const swept = scenario.contracts.flatMap((c) =>
      computeReminders(
        c.installments.map((it) => ({
          contractId: c.key,
          installmentId: `${c.key}-${it.sequence}`,
          dueDate: it.dueDate,
          status: it.status,
          payerUserId: c.owner,
          receiverUserId: c.ownerRole === "seller" ? c.owner : null,
        })),
        T
      ).map((r) => r.dedupeKey)
    );
    const seeded = scenario.notifications.map((n) =>
      reminderDedupeKey(
        n.type,
        n.sequence === null ? null : `${n.contract}-${n.sequence}`,
        n.account
      )
    );
    expect(
      seeded.filter((key) => key !== null && swept.includes(key)).sort()
    ).toEqual([
      "reminder:installment_due_soon:emprestimo-7:agora",
      "reminder:installment_overdue:aluguel-5:agora",
      "reminder:installment_overdue_receivable:notebook-4:agora",
      "reminder:installment_overdue_receivable:terreno-28:atraso",
    ]);
  });

  it("aviso de evento (comprovante) e aviso sem parcela não têm chave, como no produto", () => {
    expect(
      reminderDedupeKey(NOTIFICATION_TYPE.proofSubmitted, "moto-3", "agora")
    ).toBeNull();
    expect(
      reminderDedupeKey(NOTIFICATION_TYPE.installmentOverdue, null, "agora")
    ).toBeNull();
  });
});

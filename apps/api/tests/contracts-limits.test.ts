import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { app } from "../src/app";
import { env } from "../src/env";
import { signUpCookie, uniqueEmail } from "./helpers/auth";

const original = env.RATE_LIMIT_ENABLED;
beforeAll(() => {
  env.RATE_LIMIT_ENABLED = "true";
});
afterAll(() => {
  env.RATE_LIMIT_ENABLED = original;
});

function create(cookie: string, extra: Record<string, unknown> = {}) {
  return app.handle(
    new Request("http://localhost/api/contracts", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        title: "Contrato",
        ownerRole: "buyer",
        requiresConfirmation: false,
        schedule: {
          mode: "auto",
          totalAmountCents: 3000,
          installmentsCount: 3,
          firstDueDate: "2026-09-10",
        },
        ...extra,
      }),
    })
  );
}

const row = { amountCents: 100, dueDate: "2026-09-10" };

describe("limites de criação de contrato", () => {
  it("601 parcelas (custom, installments ou paidInstallments) dão 422", async () => {
    const cookie = await signUpCookie(uniqueEmail("big"));
    const rows = Array.from({ length: 601 }, () => row);
    const custom = await create(cookie, {
      schedule: { mode: "custom", installments: rows },
    });
    expect(custom.status).toBe(422);
    expect((await create(cookie, { installments: rows })).status).toBe(422);
    const paid = await create(cookie, {
      paidInstallments: Array.from({ length: 601 }, (_, i) => i + 1),
    });
    expect(paid.status).toBe(422);
  });

  it("o 31º contrato na hora dá 429", async () => {
    const cookie = await signUpCookie(uniqueEmail("many"));
    for (let i = 0; i < 30; i++) {
      expect((await create(cookie)).status).toBe(200);
    }
    expect((await create(cookie)).status).toBe(429);
  });
});

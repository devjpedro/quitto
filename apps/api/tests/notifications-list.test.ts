import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { app } from "../src/app";
import { db } from "../src/db/client";
import { notification, user } from "../src/db/schema";
import { signUpCookie, uniqueEmail } from "./helpers/auth";

describe("GET /api/notifications", () => {
  it("traz o título do contrato e a parcela de cada aviso", async () => {
    const email = uniqueEmail("notif-title");
    const cookie = await signUpCookie(email);
    const created = await app.handle(
      new Request("http://localhost/api/contracts", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          title: "Aluguel do apê",
          ownerRole: "buyer",
          requiresConfirmation: false,
          schedule: {
            mode: "auto",
            totalAmountCents: 3000,
            installmentsCount: 3,
            firstDueDate: "2026-07-10",
          },
        }),
      })
    );
    const { id: contractId } = (await created.json()) as { id: string };
    const detail = await app.handle(
      new Request(`http://localhost/api/contracts/${contractId}`, {
        headers: { cookie },
      })
    );
    const { installments } = (await detail.json()) as {
      installments: { id: string; sequence: number }[];
    };
    const second = installments.find((i) => i.sequence === 2);
    const [me] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email));
    await db.insert(notification).values([
      {
        userId: me?.id as string,
        contractId,
        installmentId: second?.id,
        type: "payment_confirmed",
      },
      {
        userId: me?.id as string,
        contractId,
        type: "invite_accepted",
        metadata: { email: "ana@example.com" },
      },
    ]);

    const res = await app.handle(
      new Request("http://localhost/api/notifications", { headers: { cookie } })
    );
    const list = (await res.json()) as Record<string, unknown>[];
    expect(list).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "payment_confirmed",
          contractTitle: "Aluguel do apê",
          installmentSequence: 2,
          installmentsCount: 3,
        }),
        expect.objectContaining({
          type: "invite_accepted",
          contractTitle: "Aluguel do apê",
          installmentSequence: null,
          installmentsCount: 3,
        }),
      ])
    );
  });
});

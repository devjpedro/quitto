import { describe, expect, it } from "bun:test";
import { NOTIFICATION_TYPE } from "@quitto/shared";
import { eq } from "drizzle-orm";
import { app } from "../src/app";
import { db } from "../src/db/client";
import { notification } from "../src/db/schema";
import { signUpCookie, uniqueEmail } from "./helpers/auth";

async function setup(ownerCookie: string, inviteeEmail: string) {
  const c = await app.handle(
    new Request("http://localhost/api/contracts", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: ownerCookie },
      body: JSON.stringify({
        title: "C",
        ownerRole: "buyer",
        requiresConfirmation: false,
        schedule: {
          mode: "auto",
          totalAmountCents: 3000,
          installmentsCount: 3,
          firstDueDate: "2026-09-10",
        },
      }),
    })
  );
  const contractId = (await c.json()).id as string;
  const add = await app.handle(
    new Request(`http://localhost/api/contracts/${contractId}/participants`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: ownerCookie },
      body: JSON.stringify({ displayName: "Convidado", role: "seller" }),
    })
  );
  const participantId = (await add.json()).id as string;
  const inv = await app.handle(
    new Request(
      `http://localhost/api/contracts/${contractId}/participants/${participantId}/invite`,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: ownerCookie },
        body: JSON.stringify({ email: inviteeEmail }),
      }
    )
  );
  return { contractId, token: (await inv.json()).token as string };
}

describe("decline invite", () => {
  it("recusa marca declinedAt, notifica o dono e bloqueia aceite depois", async () => {
    const ownerEmail = uniqueEmail("owner");
    const ownerCookie = await signUpCookie(ownerEmail);
    const inviteeEmail = uniqueEmail("guest");
    const { contractId, token } = await setup(ownerCookie, inviteeEmail);
    const inviteeCookie = await signUpCookie(inviteeEmail);

    const dec = await app.handle(
      new Request(`http://localhost/api/invites/${token}/decline`, {
        method: "POST",
        headers: { cookie: inviteeCookie },
      })
    );
    expect(dec.status).toBe(200);

    const notifs = await db
      .select()
      .from(notification)
      .where(eq(notification.contractId, contractId));
    expect(
      notifs.some((n) => n.type === NOTIFICATION_TYPE.inviteDeclined)
    ).toBe(true);

    const acc = await app.handle(
      new Request(`http://localhost/api/invites/${token}/accept`, {
        method: "POST",
        headers: { cookie: inviteeCookie },
      })
    );
    expect(acc.status).toBeGreaterThanOrEqual(400);
  });
});

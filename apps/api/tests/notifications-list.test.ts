import { describe, expect, it } from "bun:test";
import { and, eq } from "drizzle-orm";
import { app } from "../src/app";
import { db } from "../src/db/client";
import { notification, user } from "../src/db/schema";
import { signUpCookie, uniqueEmail } from "./helpers/auth";

function send(cookie: string, method: string, path: string, body?: unknown) {
  return app.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers: { "content-type": "application/json", cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  );
}

async function get<T>(cookie: string, path: string): Promise<T> {
  const res = await send(cookie, "GET", path);
  expect(res.status).toBe(200);
  return (await res.json()) as T;
}

/** What the bell, the notification list and the home each say about one contract. */
async function bellFor(cookie: string, contractId: string) {
  const list = await get<{ contractId: string }[]>(
    cookie,
    "/api/notifications"
  );
  const unread = await get<{ count: number }>(
    cookie,
    "/api/notifications/unread-count"
  );
  const home = await get<{ unreadCount: number }>(cookie, "/api/home");
  return {
    listed: list.filter((n) => n.contractId === contractId).length,
    unreadCount: unread.count,
    homeUnreadCount: home.unreadCount,
  };
}

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

  it("aviso de contrato do qual saiu não aparece nem conta como não lido", async () => {
    const owner = await signUpCookie(uniqueEmail("notif-leave-owner"));
    const created = await send(owner, "POST", "/api/contracts", {
      title: "Contrato que ela deixou",
      ownerRole: "buyer",
      requiresConfirmation: false,
      schedule: {
        mode: "auto",
        totalAmountCents: 3000,
        installmentsCount: 3,
        firstDueDate: "2026-07-10",
      },
    });
    const { id: contractId } = (await created.json()) as { id: string };
    const sellerEmail = uniqueEmail("notif-leave-seller");
    const seller = await signUpCookie(sellerEmail);
    const added = await send(
      owner,
      "POST",
      `/api/contracts/${contractId}/participants`,
      { displayName: "Bia", role: "seller" }
    );
    const { id: participantId } = (await added.json()) as { id: string };
    const invited = await send(
      owner,
      "POST",
      `/api/contracts/${contractId}/participants/${participantId}/invite`,
      { email: sellerEmail }
    );
    const { token } = (await invited.json()) as { token: string };
    expect(
      (await send(seller, "POST", `/api/invites/${token}/accept`)).status
    ).toBe(200);

    // The owner pays; the seller, as approver, gets "installment paid".
    const { installments } = await get<{ installments: { id: string }[] }>(
      owner,
      `/api/contracts/${contractId}`
    );
    const paid = await send(
      owner,
      "POST",
      `/api/installments/${installments[0]?.id}/mark-paid`
    );
    expect(paid.status).toBe(200);
    expect(await bellFor(seller, contractId)).toEqual({
      listed: 1,
      unreadCount: 1,
      homeUnreadCount: 1,
    });

    const left = await send(
      seller,
      "DELETE",
      `/api/contracts/${contractId}/me`
    );
    expect(left.status).toBe(200);
    expect(await bellFor(seller, contractId)).toEqual({
      listed: 0,
      unreadCount: 0,
      homeUnreadCount: 0,
    });

    // "Mark all as read" acts on what the bell shows, nothing else.
    expect(
      (await send(seller, "POST", "/api/notifications/read-all")).status
    ).toBe(200);
    const [me] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, sellerEmail));
    const hidden = await db
      .select({ readAt: notification.readAt })
      .from(notification)
      .where(
        and(
          eq(notification.userId, me?.id as string),
          eq(notification.contractId, contractId)
        )
      );
    expect(hidden).toEqual([{ readAt: null }]);
  });
});

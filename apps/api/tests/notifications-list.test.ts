import { describe, expect, it } from "bun:test";
import { and, eq } from "drizzle-orm";
import { app } from "../src/app";
import { db } from "../src/db/client";
import { installment, notification, user } from "../src/db/schema";
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

describe("notificações agrupadas e a leitura do grupo", () => {
  async function terreno(
    cookie: string
  ): Promise<{ contractId: string; installmentIds: string[] }> {
    const created = await send(cookie, "POST", "/api/contracts", {
      title: "Venda do terreno",
      ownerRole: "seller",
      requiresConfirmation: false,
      schedule: {
        mode: "auto",
        totalAmountCents: 4_800_000,
        installmentsCount: 24,
        firstDueDate: "2024-10-28",
      },
    });
    const { id } = (await created.json()) as { id: string };
    const items = await db
      .select({ id: installment.id })
      .from(installment)
      .where(eq(installment.contractId, id))
      .orderBy(installment.sequence);
    return { contractId: id, installmentIds: items.map((i) => i.id) };
  }

  async function seedOverdue(email: string, cookie: string) {
    const { contractId, installmentIds } = await terreno(cookie);
    const [me] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email));
    await db.insert(notification).values(
      installmentIds.map((installmentId, i) => ({
        userId: me?.id as string,
        type: "installment_overdue_receivable",
        contractId,
        installmentId,
        createdAt: new Date(Date.UTC(2026, 9, 1, 12, 0, i)),
      }))
    );
    return contractId;
  }

  it("24 avisos seguidos do mesmo contrato chegam como uma linha com os 24 ids", async () => {
    const email = uniqueEmail("notif-group");
    const cookie = await signUpCookie(email);
    const contractId = await seedOverdue(email, cookie);
    const list = await get<
      {
        contractId: string;
        count: number;
        ids: string[];
        sequences: number[];
        unreadCount: number;
      }[]
    >(cookie, "/api/notifications");
    const mine = list.filter((n) => n.contractId === contractId);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.count).toBe(24);
    expect(mine[0]?.ids).toHaveLength(24);
    expect(mine[0]?.unreadCount).toBe(24);
    expect(mine[0]?.sequences).toEqual(
      Array.from({ length: 24 }, (_, i) => i + 1)
    );
  });

  it("ler o grupo lê todos e zera o contador", async () => {
    const email = uniqueEmail("notif-group-read");
    const cookie = await signUpCookie(email);
    await seedOverdue(email, cookie);
    const [line] = await get<{ ids: string[] }[]>(cookie, "/api/notifications");
    const res = await send(cookie, "POST", "/api/notifications/read", {
      ids: line?.ids,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, count: 24 });
    const unread = await get<{ count: number }>(
      cookie,
      "/api/notifications/unread-count"
    );
    expect(unread.count).toBe(0);
    const home = await get<{ unreadCount: number }>(cookie, "/api/home");
    expect(home.unreadCount).toBe(0);
  });

  it("mesmo instante: o empate junta o mesmo contrato e tipo, sempre do mesmo jeito", async () => {
    const email = uniqueEmail("notif-tie");
    const cookie = await signUpCookie(email);
    const x = await terreno(cookie);
    const y = await terreno(cookie);
    const [me] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email));
    // One reminder sweep writes every notice at the same instant, in this order: X, Y, X.
    const at = new Date(Date.UTC(2026, 9, 1, 12, 0, 0));
    const notice = (
      target: { contractId: string; installmentIds: string[] },
      index: number,
      type: string
    ) => ({
      userId: me?.id as string,
      type,
      contractId: target.contractId,
      installmentId: target.installmentIds[index] ?? null,
      createdAt: at,
    });
    await db
      .insert(notification)
      .values([
        notice(x, 0, "installment_overdue_receivable"),
        notice(y, 0, "installment_due_soon_receivable"),
        notice(x, 1, "installment_overdue_receivable"),
      ]);
    // The same answer on every read: X as one line of 2, Y as one line.
    const check = async () => {
      const list = await get<{ contractId: string; count: number }[]>(
        cookie,
        "/api/notifications"
      );
      const mine = list.filter(
        (n) => n.contractId === x.contractId || n.contractId === y.contractId
      );
      expect(mine).toHaveLength(2);
      expect(mine.find((n) => n.contractId === x.contractId)?.count).toBe(2);
      expect(mine.find((n) => n.contractId === y.contractId)?.count).toBe(1);
    };
    await check();
    await check();
    await check();
  });

  it("ids de outra pessoa: 404 e nada muda", async () => {
    const ownerEmail = uniqueEmail("notif-group-owner");
    const owner = await signUpCookie(ownerEmail);
    await seedOverdue(ownerEmail, owner);
    const [line] = await get<{ ids: string[] }[]>(owner, "/api/notifications");
    const stranger = await signUpCookie(uniqueEmail("notif-group-stranger"));
    const res = await send(stranger, "POST", "/api/notifications/read", {
      ids: line?.ids,
    });
    expect(res.status).toBe(404);
    const unread = await get<{ count: number }>(
      owner,
      "/api/notifications/unread-count"
    );
    expect(unread.count).toBe(24);
  });

  it("ids mistos, um meu e os de outra pessoa: lê só o meu, e os dela ficam como estavam", async () => {
    const myEmail = uniqueEmail("notif-mixed-me");
    const me = await signUpCookie(myEmail);
    await seedOverdue(myEmail, me);
    const [mine] = await get<{ ids: string[] }[]>(me, "/api/notifications");
    const otherEmail = uniqueEmail("notif-mixed-other");
    const other = await signUpCookie(otherEmail);
    await seedOverdue(otherEmail, other);
    const [theirs] = await get<{ ids: string[] }[]>(
      other,
      "/api/notifications"
    );
    // One id of mine gets past the 404; the other person's must stay untouched.
    const res = await send(me, "POST", "/api/notifications/read", {
      ids: [mine?.ids[0], ...(theirs?.ids ?? [])],
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, count: 1 });
    const myUnread = await get<{ count: number }>(
      me,
      "/api/notifications/unread-count"
    );
    expect(myUnread.count).toBe(23);
    const theirUnread = await get<{ count: number }>(
      other,
      "/api/notifications/unread-count"
    );
    expect(theirUnread.count).toBe(24);
  });

  it("reler não regrava: o count são os recém-lidos, e o que já estava lido guarda o readAt", async () => {
    const email = uniqueEmail("notif-reread");
    const cookie = await signUpCookie(email);
    await seedOverdue(email, cookie);
    const [line] = await get<{ ids: string[] }[]>(cookie, "/api/notifications");
    const ids = line?.ids ?? [];
    const first = ids[0] as string;
    // One notice of the line was already read, days earlier.
    const earlier = new Date(Date.UTC(2026, 8, 30, 12, 0, 0));
    await db
      .update(notification)
      .set({ readAt: earlier })
      .where(eq(notification.id, first));
    const readAtOf = async (id: string) => {
      const [found] = await db
        .select({ readAt: notification.readAt })
        .from(notification)
        .where(eq(notification.id, id));
      return found?.readAt;
    };
    const res = await send(cookie, "POST", "/api/notifications/read", { ids });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, count: 23 });
    expect(await readAtOf(first)).toEqual(earlier);
    // Reading the same line again still works, and reads nothing new.
    const again = await send(cookie, "POST", "/api/notifications/read", {
      ids,
    });
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ ok: true, count: 0 });
    expect(await readAtOf(first)).toEqual(earlier);
    const unread = await get<{ count: number }>(
      cookie,
      "/api/notifications/unread-count"
    );
    expect(unread.count).toBe(0);
  });
});

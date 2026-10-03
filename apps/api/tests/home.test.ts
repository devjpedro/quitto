import { describe, expect, it, setSystemTime, spyOn } from "bun:test";
import { todayISO } from "@quitto/shared";
import { eq } from "drizzle-orm";
import { app } from "../src/app";
import { db } from "../src/db/client";
import {
  contract,
  installment,
  invite,
  notification,
  proof,
  user,
} from "../src/db/schema";
import { addDays } from "../src/lib/dates";
import { previousMonth } from "../src/lib/home-milestones";
import { signUpCookie, uniqueEmail } from "./helpers/auth";

const today = todayISO();

interface HomeBody {
  actions: {
    contractTitle: string;
    counterpartyName?: string | null;
    direction?: string;
    id: string;
    kind: string;
    pixCode?: string | null;
    token?: string;
  }[];
  activeContractsCount: number;
  milestones: {
    previousMonthAllClear: { month: string; paidCount: number } | null;
  };
  onboarding: {
    dismissedAt: string | null;
    hasContract: boolean;
    hasPixKey: boolean;
  };
  today: string;
  unreadCount: number;
  upcoming: {
    items: { contractTitle: string }[];
    toPayCents: number;
    toReceiveCents: number;
  };
}

async function getHome(cookie: string): Promise<HomeBody> {
  const res = await app.handle(
    new Request("http://localhost/api/home", { headers: { cookie } })
  );
  expect(res.status).toBe(200);
  return (await res.json()) as HomeBody;
}

function post(cookie: string, path: string, body?: unknown) {
  return app.handle(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  );
}

async function createContract(
  cookie: string,
  title: string,
  firstDueDate: string
): Promise<string> {
  const res = await post(cookie, "/api/contracts", {
    title,
    ownerRole: "buyer",
    requiresConfirmation: false,
    schedule: {
      mode: "auto",
      totalAmountCents: 3000,
      installmentsCount: 3,
      firstDueDate,
    },
  });
  return ((await res.json()) as { id: string }).id;
}

async function addSlot(
  ownerCookie: string,
  contractId: string,
  role: "seller" | "viewer"
): Promise<string> {
  const added = await post(
    ownerCookie,
    `/api/contracts/${contractId}/participants`,
    {
      displayName: "Convidado",
      role,
    }
  );
  return ((await added.json()) as { id: string }).id;
}

async function inviteSlot(
  ownerCookie: string,
  contractId: string,
  slot: string,
  email: string
): Promise<string> {
  const inv = await post(
    ownerCookie,
    `/api/contracts/${contractId}/participants/${slot}/invite`,
    { email }
  );
  return ((await inv.json()) as { token: string }).token;
}

async function inviteTo(
  ownerCookie: string,
  contractId: string,
  email: string,
  role: "seller" | "viewer"
): Promise<string> {
  const slot = await addSlot(ownerCookie, contractId, role);
  return inviteSlot(ownerCookie, contractId, slot, email);
}

async function userIdOf(email: string): Promise<string> {
  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  if (!row) {
    throw new Error(`no user ${email}`);
  }
  return row.id;
}

describe("GET /api/home", () => {
  it("exige sessão", async () => {
    const res = await app.handle(new Request("http://localhost/api/home"));
    expect(res.status).toBe(401);
  });

  it("conta nova: sem ações, guia por fazer, contador zerado", async () => {
    const home = await getHome(await signUpCookie(uniqueEmail("home-new")));
    expect(home.today).toBe(today);
    expect(home.actions).toEqual([]);
    expect(home.unreadCount).toBe(0);
    expect(home.activeContractsCount).toBe(0);
    expect(home.onboarding).toMatchObject({
      hasContract: false,
      hasPixKey: false,
      dismissedAt: null,
    });
  });

  it("hoje é a data de São Paulo, não a do UTC", async () => {
    const cookie = await signUpCookie(uniqueEmail("home-tz"));
    const now = new Date();
    // 01:00 UTC of the next UTC day is still 22:00 of the day before in São Paulo.
    const lateEvening = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 1)
    );
    setSystemTime(lateEvening);
    try {
      const home = await getHome(cookie);
      expect(home.today).toBe(
        addDays(lateEvening.toISOString().slice(0, 10), -1)
      );
    } finally {
      setSystemTime();
    }
  });

  it("pagador: a atrasada vira ação e a próxima entra nos 30 dias; outro usuário não vê nada", async () => {
    const cookie = await signUpCookie(uniqueEmail("home-payer"));
    await createContract(cookie, "Aluguel Home", addDays(today, -5));
    const home = await getHome(cookie);
    expect(home.actions.map((a) => [a.kind, a.contractTitle])).toEqual([
      ["overdue", "Aluguel Home"],
    ]);
    expect(home.upcoming.items.map((i) => i.contractTitle)).toEqual([
      "Aluguel Home",
    ]);
    expect(home.upcoming.toPayCents).toBe(1000);
    expect(home.onboarding.hasContract).toBe(true);

    const stranger = await getHome(
      await signUpCookie(uniqueEmail("home-stranger"))
    );
    expect(stranger.actions).toEqual([]);
    expect(stranger.upcoming.items).toEqual([]);
    expect(stranger.activeContractsCount).toBe(0);
    expect(stranger.onboarding.hasContract).toBe(false);
  });

  it("vendedor vinculado: a outra parte vem da linha do dono e o PIX do pagador vem do perfil do vendedor", async () => {
    const owner = await signUpCookie(uniqueEmail("home-linked-owner"));
    const sellerEmail = uniqueEmail("home-linked-seller");
    const seller = await signUpCookie(sellerEmail);
    const id = await createContract(
      owner,
      "Parte vinculada",
      addDays(today, -5)
    );
    const token = await inviteTo(owner, id, sellerEmail, "seller");
    expect((await post(seller, `/api/invites/${token}/accept`)).status).toBe(
      200
    );

    const before = await getHome(owner);
    expect(before.actions[0]).toMatchObject({
      kind: "overdue",
      direction: "pay",
      counterpartyName: "Convidado",
      pixCode: null,
    });

    const sellerHome = await getHome(seller);
    expect(sellerHome.actions).toHaveLength(1);
    expect(sellerHome.actions[0]).toMatchObject({
      kind: "overdue",
      contractTitle: "Parte vinculada",
      direction: "receive",
      // The buyer's row is the owner's, not the seller's: every row of the contract is loaded.
      counterpartyName: "Test",
    });
    expect(sellerHome.upcoming.toReceiveCents).toBe(1000);
    expect(sellerHome.upcoming.toPayCents).toBe(0);

    const patched = await app.handle(
      new Request("http://localhost/api/me", {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie: seller },
        body: JSON.stringify({ pixKey: sellerEmail }),
      })
    );
    expect(patched.status).toBe(200);
    const after = await getHome(owner);
    expect(after.actions[0]?.pixCode).toEqual(expect.any(String));
  });

  it("espectador: o contrato conta como tem contrato e como ativo, mas não gera ação nem total", async () => {
    const owner = await signUpCookie(uniqueEmail("home-viewer-owner"));
    const viewerEmail = uniqueEmail("home-viewer");
    const viewer = await signUpCookie(viewerEmail);
    const id = await createContract(owner, "Acompanhado", addDays(today, -5));
    const token = await inviteTo(owner, id, viewerEmail, "viewer");
    expect((await post(viewer, `/api/invites/${token}/accept`)).status).toBe(
      200
    );
    const home = await getHome(viewer);
    expect(home.actions).toEqual([]);
    expect(home.upcoming).toMatchObject({
      items: [],
      toPayCents: 0,
      toReceiveCents: 0,
    });
    expect(home.onboarding.hasContract).toBe(true);
    expect(home.activeContractsCount).toBe(1);
  });

  it("contratos ativos: cancelado e concluído não contam", async () => {
    const cookie = await signUpCookie(uniqueEmail("home-active"));
    await createContract(cookie, "Ativo", addDays(today, 10));
    const cancelled = await createContract(
      cookie,
      "Cancelado",
      addDays(today, 40)
    );
    const completed = await createContract(
      cookie,
      "Concluído",
      addDays(today, 40)
    );
    await db
      .update(contract)
      .set({ status: "cancelled" })
      .where(eq(contract.id, cancelled));
    await db
      .update(contract)
      .set({ status: "completed" })
      .where(eq(contract.id, completed));
    const home = await getHome(cookie);
    expect(home.activeContractsCount).toBe(1);
  });

  it("convite recusado ou aceito some e não volta", async () => {
    const owner = await signUpCookie(uniqueEmail("home-inv-owner"));
    const guestEmail = uniqueEmail("home-inv-guest");
    const guest = await signUpCookie(guestEmail);
    const first = await createContract(owner, "Convite A", addDays(today, 10));
    const second = await createContract(owner, "Convite B", addDays(today, 10));
    const declineToken = await inviteTo(owner, first, guestEmail, "seller");
    const acceptToken = await inviteTo(owner, second, guestEmail, "seller");

    const before = await getHome(guest);
    expect(before.actions.filter((a) => a.kind === "invite")).toHaveLength(2);

    expect(
      (await post(guest, `/api/invites/${declineToken}/decline`)).status
    ).toBe(200);
    expect(
      (await post(guest, `/api/invites/${acceptToken}/accept`)).status
    ).toBe(200);

    const after = await getHome(guest);
    expect(after.actions.filter((a) => a.kind === "invite")).toEqual([]);
    expect(after.onboarding.hasContract).toBe(true);
  });

  it("convite para contrato em que já participa não vira ação", async () => {
    const email = uniqueEmail("home-self-invite");
    const cookie = await signUpCookie(email);
    const id = await createContract(cookie, "Meu contrato", addDays(today, 40));
    await inviteTo(cookie, id, email, "viewer");
    const home = await getHome(cookie);
    expect(home.actions.filter((a) => a.kind === "invite")).toEqual([]);
  });

  it("convite expirado não vira ação", async () => {
    const owner = await signUpCookie(uniqueEmail("home-exp-owner"));
    const guestEmail = uniqueEmail("home-exp-guest");
    const guest = await signUpCookie(guestEmail);
    const id = await createContract(
      owner,
      "Convite vencido",
      addDays(today, 10)
    );
    const token = await inviteTo(owner, id, guestEmail, "seller");
    await db
      .update(invite)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(invite.token, token));
    const home = await getHome(guest);
    expect(home.actions.filter((a) => a.kind === "invite")).toEqual([]);
  });

  it("convite para vaga que outro e-mail já ocupou não vira ação", async () => {
    const owner = await signUpCookie(uniqueEmail("home-slot-owner"));
    const firstEmail = uniqueEmail("home-slot-a");
    const first = await signUpCookie(firstEmail);
    const secondEmail = uniqueEmail("home-slot-b");
    const second = await signUpCookie(secondEmail);
    const id = await createContract(owner, "Vaga tomada", addDays(today, 10));
    const added = await post(owner, `/api/contracts/${id}/participants`, {
      displayName: "Convidado",
      role: "seller",
    });
    const { id: slot } = (await added.json()) as { id: string };
    const sendInvite = async (email: string) =>
      (
        (await (
          await post(
            owner,
            `/api/contracts/${id}/participants/${slot}/invite`,
            {
              email,
            }
          )
        ).json()) as { token: string }
      ).token;
    const firstToken = await sendInvite(firstEmail);
    await sendInvite(secondEmail);
    expect(
      (await post(first, `/api/invites/${firstToken}/accept`)).status
    ).toBe(200);
    const home = await getHome(second);
    expect(home.actions.filter((a) => a.kind === "invite")).toEqual([]);
  });

  it("convite repetido para a mesma vaga: um cartão só, e recusar some com os dois", async () => {
    const owner = await signUpCookie(uniqueEmail("home-dup-owner"));
    const guestEmail = uniqueEmail("home-dup-guest");
    const guest = await signUpCookie(guestEmail);
    const id = await createContract(
      owner,
      "Convite repetido",
      addDays(today, 10)
    );
    const added = await post(owner, `/api/contracts/${id}/participants`, {
      displayName: "Convidado",
      role: "seller",
    });
    const { id: slot } = (await added.json()) as { id: string };
    const path = `/api/contracts/${id}/participants/${slot}/invite`;
    await post(owner, path, { email: guestEmail });
    await post(owner, path, { email: guestEmail });
    const invites = (await getHome(guest)).actions.filter(
      (a) => a.kind === "invite"
    );
    expect(invites).toHaveLength(1);
    expect(
      (await post(guest, `/api/invites/${invites[0]?.token}/decline`)).status
    ).toBe(200);
    const after = await getHome(guest);
    expect(after.actions.filter((a) => a.kind === "invite")).toEqual([]);
  });

  it("recusar não derruba o convite que a mesma vaga mandou para outro e-mail", async () => {
    const owner = await signUpCookie(uniqueEmail("home-other-owner"));
    const declinerEmail = uniqueEmail("home-other-x");
    const decliner = await signUpCookie(declinerEmail);
    const keeperEmail = uniqueEmail("home-other-y");
    const keeper = await signUpCookie(keeperEmail);
    const id = await createContract(owner, "Mesma vaga", addDays(today, 10));
    const slot = await addSlot(owner, id, "seller");
    const declined = await inviteSlot(owner, id, slot, declinerEmail);
    const kept = await inviteSlot(owner, id, slot, keeperEmail);
    expect(
      (await post(decliner, `/api/invites/${declined}/decline`)).status
    ).toBe(200);
    const home = await getHome(keeper);
    expect(
      home.actions.filter((a) => a.kind === "invite").map((a) => a.token)
    ).toEqual([kept]);
    expect((await post(keeper, `/api/invites/${kept}/accept`)).status).toBe(
      200
    );
  });

  it("a cópia mais recente decide: recusada antes do decline de todas as cópias, a mais velha não volta", async () => {
    const owner = await signUpCookie(uniqueEmail("home-legacy-owner"));
    const guestEmail = uniqueEmail("home-legacy-guest");
    const guest = await signUpCookie(guestEmail);
    const id = await createContract(owner, "Recusa antiga", addDays(today, 10));
    const slot = await addSlot(owner, id, "seller");
    await inviteSlot(owner, id, slot, guestEmail);
    const newest = await inviteSlot(owner, id, slot, guestEmail);
    // The old decline only marked the copy it was called with.
    await db
      .update(invite)
      .set({ declinedAt: new Date() })
      .where(eq(invite.token, newest));
    const home = await getHome(guest);
    expect(home.actions.filter((a) => a.kind === "invite")).toEqual([]);
  });

  it("tudo em dia do mês passado usa a hora do comprovante, não a da confirmação", async () => {
    const cookie = await signUpCookie(uniqueEmail("home-on-time"));
    const lastMonth = previousMonth(today.slice(0, 7));
    const created = await post(cookie, "/api/contracts", {
      title: "No prazo",
      ownerRole: "buyer",
      requiresConfirmation: true,
      schedule: {
        mode: "custom",
        installments: [{ amountCents: 1000, dueDate: `${lastMonth}-10` }],
      },
    });
    const { id: contractId } = (await created.json()) as { id: string };
    const [row] = await db
      .select({ id: installment.id })
      .from(installment)
      .where(eq(installment.contractId, contractId));
    const installmentId = row?.id as string;
    // The proof went in on the 9th; the approver only confirmed on the 20th.
    await db.insert(proof).values({
      installmentId,
      objectKey: `proofs/${contractId}/${installmentId}/on-time.pdf`,
      fileName: "on-time.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1,
      createdAt: new Date(`${lastMonth}-09T15:00:00Z`),
    });
    await db
      .update(installment)
      .set({
        status: "confirmed",
        confirmedAt: new Date(`${lastMonth}-20T15:00:00Z`),
        paidAt: new Date(`${lastMonth}-20T15:00:00Z`),
      })
      .where(eq(installment.id, installmentId));
    const home = await getHome(cookie);
    expect(home.milestones.previousMonthAllClear).toEqual({
      month: lastMonth,
      paidCount: 1,
    });
  });

  it("mostra o guia dispensado e conta as notificações não lidas", async () => {
    const email = uniqueEmail("home-flags");
    const cookie = await signUpCookie(email);
    const contractId = await createContract(
      cookie,
      "Flags",
      addDays(today, 40)
    );
    await post(cookie, "/api/me/onboarding/dismiss");
    const userId = await userIdOf(email);
    await db.insert(notification).values([
      { userId, contractId, type: "payment_confirmed" },
      { userId, contractId, type: "installment_paid" },
      { userId, contractId, type: "invite_accepted", readAt: new Date() },
    ]);
    const home = await getHome(cookie);
    expect(home.onboarding.dismissedAt).not.toBeNull();
    expect(home.unreadCount).toBe(2);
  });

  it("consulta em lote: o número de consultas não cresce com contratos, partes vinculadas, comprovantes e convites", async () => {
    const email = uniqueEmail("home-batch");
    const cookie = await signUpCookie(email);
    // Each round adds a contract with a linked seller and a proof, plus a
    // pending invite from someone else's contract.
    const grow = async (round: number) => {
      const id = await createContract(
        cookie,
        `Lote ${round}`,
        addDays(today, -3)
      );
      const sellerEmail = uniqueEmail(`home-batch-seller-${round}`);
      const seller = await signUpCookie(sellerEmail);
      const token = await inviteTo(cookie, id, sellerEmail, "seller");
      expect((await post(seller, `/api/invites/${token}/accept`)).status).toBe(
        200
      );
      const [first] = await db
        .select({ id: installment.id })
        .from(installment)
        .where(eq(installment.contractId, id));
      await db.insert(proof).values({
        installmentId: first?.id as string,
        objectKey: `proofs/${id}/batch.pdf`,
        fileName: "batch.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1,
      });
      const other = await signUpCookie(
        uniqueEmail(`home-batch-other-${round}`)
      );
      const otherId = await createContract(
        other,
        `Convite ${round}`,
        addDays(today, 10)
      );
      await inviteTo(other, otherId, email, "seller");
    };
    await grow(1);
    const select = spyOn(db, "select");
    try {
      await getHome(cookie);
      const withOne = select.mock.calls.length;
      expect(withOne).toBeGreaterThan(0);
      for (const round of [2, 3, 4]) {
        await grow(round);
      }
      select.mockClear();
      const home = await getHome(cookie);
      expect(home.actions.filter((a) => a.kind === "overdue")).toHaveLength(4);
      expect(home.actions.filter((a) => a.kind === "invite")).toHaveLength(4);
      expect(home.activeContractsCount).toBe(4);
      expect(select.mock.calls.length).toBe(withOne);
    } finally {
      select.mockRestore();
    }
  });
});

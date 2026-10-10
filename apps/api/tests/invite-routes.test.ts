import { describe, expect, it } from "bun:test";
import { addMonths, todayISO } from "@quitto/shared";
import { eq } from "drizzle-orm";
import { app } from "../src/app";
import { db } from "../src/db/client";
import { invite } from "../src/db/schema";
import { env } from "../src/env";
import {
  INVITE_PREVIEW_GLOBAL,
  INVITE_PREVIEW_LIMIT,
} from "../src/lib/rate-limit";
import { signUpCookie, uniqueEmail } from "./helpers/auth";

// uniqueEmail gives "<tag>-<ts>-<n>@example.com".
const MASKED = /^[a-z]•••@example[.]com$/;

async function setup(
  inviteeEmail: string,
  extra: Record<string, unknown> = {}
) {
  const ownerCookie = await signUpCookie(uniqueEmail("owner"));
  const res = await app.handle(
    new Request("http://localhost/api/contracts", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: ownerCookie },
      body: JSON.stringify({
        title: "Viagem para Floripa (dividida)",
        description: "Hospedagem e passagens",
        ownerRole: "seller",
        requiresConfirmation: false,
        schedule: {
          mode: "split",
          totalAmountCents: 120_000,
          installmentsCount: 4,
          firstDueDate: "2026-11-10",
        },
        counterparty: { name: "João Souza", email: inviteeEmail },
        ...extra,
      }),
    })
  );
  const { id } = await res.json();
  const [row] = await db.select().from(invite).where(eq(invite.contractId, id));
  return { contractId: id as string, ownerCookie, token: row?.token as string };
}

function get(token: string, cookie?: string) {
  return app.handle(
    new Request(`http://localhost/api/invites/${token}`, {
      headers: cookie ? { cookie } : {},
    })
  );
}

function preview(token: string, headers: Record<string, string> = {}) {
  return app.handle(
    new Request(`http://localhost/api/invites/${token}/preview`, { headers })
  );
}

describe("GET /api/invites/:token", () => {
  it("o convidado: pendente, e-mail completo, termos e as 3 primeiras parcelas", async () => {
    const email = uniqueEmail("joao");
    const { token } = await setup(email);
    const cookie = await signUpCookie(email);
    const res = await get(token, cookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      status: "pending",
      viewer: "invitee",
      inviterName: "Test",
      contract: {
        title: "Viagem para Floripa (dividida)",
        description: "Hospedagem e passagens",
      },
      role: "buyer",
      requiresConfirmation: false,
      terms: {
        installmentsCount: 4,
        totalCents: 120_000,
        amountCents: 30_000,
        firstDueDate: "2026-11-10",
        lastDueDate: "2027-02-10",
        dayOfMonth: 10,
      },
      email: email.toLowerCase(),
      inviteeName: null,
      acceptedAt: null,
      declinedAt: null,
    });
    expect(body.schedulePreview).toEqual([
      { sequence: 1, dueDate: "2026-11-10", amountCents: 30_000 },
      { sequence: 2, dueDate: "2026-12-10", amountCents: 30_000 },
      { sequence: 3, dueDate: "2027-01-10", amountCents: 30_000 },
    ]);
  });

  it("contrato com parcelas já pagas: paidSequences e a prévia sem elas", async () => {
    const email = uniqueEmail("joao");
    const { token } = await setup(email, {
      ownerRole: "buyer",
      schedule: {
        mode: "split",
        totalAmountCents: 120_000,
        installmentsCount: 4,
        firstDueDate: addMonths(todayISO(), -3),
      },
      paidInstallments: [1, 2],
    });
    const body = await (await get(token, await signUpCookie(email))).json();
    expect(body.terms.paidSequences).toEqual([1, 2]);
    expect(
      body.schedulePreview.map((r: { sequence: number }) => r.sequence)
    ).toEqual([3, 4]);
  });

  it("o dono: owner, com o nome da vaga", async () => {
    const { ownerCookie, token } = await setup(uniqueEmail("joao"));
    const body = await (await get(token, ownerCookie)).json();
    expect(body.viewer).toBe("owner");
    expect(body.inviteeName).toBe("João Souza");
  });

  it("outra conta: otherAccount, só o e-mail mascarado", async () => {
    const { token } = await setup(uniqueEmail("joao"));
    const other = await signUpCookie(uniqueEmail("renata"));
    const body = await (await get(token, other)).json();
    expect(body.viewer).toBe("otherAccount");
    expect(body.email).toBeNull();
    expect(body.emailMasked).toMatch(MASKED);
  });

  it("outra conta num convite aceito: sem condições nem parcelas", async () => {
    const email = uniqueEmail("joao");
    const { token } = await setup(email);
    const cookie = await signUpCookie(email);
    await app.handle(
      new Request(`http://localhost/api/invites/${token}/accept`, {
        method: "POST",
        headers: { cookie },
      })
    );
    const other = await signUpCookie(uniqueEmail("renata"));
    const body = await (await get(token, other)).json();
    expect(body).toMatchObject({
      status: "accepted",
      viewer: "otherAccount",
      terms: null,
      schedulePreview: [],
    });
  });

  it("expirado: 200 com status expired (não 422)", async () => {
    const email = uniqueEmail("joao");
    const { token } = await setup(email);
    await db
      .update(invite)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(invite.token, token));
    const cookie = await signUpCookie(email);
    const res = await get(token, cookie);
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("expired");
  });

  it("aceito: status accepted com a data, e o convidado continua invitee", async () => {
    const email = uniqueEmail("joao");
    const { token } = await setup(email);
    const cookie = await signUpCookie(email);
    await app.handle(
      new Request(`http://localhost/api/invites/${token}/accept`, {
        method: "POST",
        headers: { cookie },
      })
    );
    const body = await (await get(token, cookie)).json();
    expect(body.status).toBe("accepted");
    expect(body.viewer).toBe("invitee");
    expect(typeof body.acceptedAt).toBe("string");
  });

  it("recusar devolve a tela com status declined", async () => {
    const email = uniqueEmail("joao");
    const { token } = await setup(email);
    const cookie = await signUpCookie(email);
    const res = await app.handle(
      new Request(`http://localhost/api/invites/${token}/decline`, {
        method: "POST",
        headers: { cookie },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("declined");
    expect(typeof body.declinedAt).toBe("string");
  });

  it("token desconhecido: 404; sem sessão: 401", async () => {
    const cookie = await signUpCookie(uniqueEmail("x"));
    expect((await get("nao-existe", cookie)).status).toBe(404);
    const { token } = await setup(uniqueEmail("joao"));
    expect((await get(token)).status).toBe(401);
  });
});

describe("GET /api/invites/:token/preview (sem sessão)", () => {
  it("o mínimo, sem descrição nem e-mail, com no-store e noindex", async () => {
    const { token } = await setup(uniqueEmail("joao"));
    const res = await preview(token);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual([
      "contractTitle",
      "emailMasked",
      "expiresAt",
      "inviterName",
      "role",
      "status",
      "terms",
    ]);
    expect(body).toMatchObject({
      status: "pending",
      inviterName: "Test",
      contractTitle: "Viagem para Floripa (dividida)",
      role: "buyer",
      terms: {
        installmentsCount: 4,
        amountCents: 30_000,
        totalCents: 120_000,
        firstDueDate: "2026-11-10",
      },
    });
  });

  it("token desconhecido: 404", async () => {
    expect((await preview("nao-existe")).status).toBe(404);
  });

  it("convite aceito: a prévia pública sem as condições", async () => {
    const email = uniqueEmail("joao");
    const { token } = await setup(email);
    const cookie = await signUpCookie(email);
    await app.handle(
      new Request(`http://localhost/api/invites/${token}/accept`, {
        method: "POST",
        headers: { cookie },
      })
    );
    const body = await (await preview(token)).json();
    expect(body.status).toBe("accepted");
    expect(body.terms).toBeNull();
  });

  it("limite desligado fora de produção: 40 pedidos seguidos passam", async () => {
    const { token } = await setup(uniqueEmail("joao"));
    const ip = { "fly-client-ip": `198.51.100.${Date.now() % 250}` };
    for (let i = 0; i < 40; i += 1) {
      expect((await preview(token, ip)).status).toBe(200);
    }
  });

  it("com o limite ligado, 31 pedidos da mesma conexão: o último é 429 RATE_LIMITED", async () => {
    const { token } = await setup(uniqueEmail("joao"));
    env.RATE_LIMIT_ENABLED = "true";
    try {
      const ip = { "fly-client-ip": `203.0.113.${Date.now() % 250}` };
      for (let i = 0; i < 30; i += 1) {
        expect((await preview(token, ip)).status).toBe(200);
      }
      const blocked = await preview(token, ip);
      expect(blocked.status).toBe(429);
      expect((await blocked.json()).error.code).toBe("RATE_LIMITED");
      // Another X-Forwarded-For does not open a new window.
      const forged = await preview(token, {
        ...ip,
        "x-forwarded-for": "192.0.2.99",
      });
      expect(forged.status).toBe(429);
    } finally {
      env.RATE_LIMIT_ENABLED = undefined;
    }
  });

  it("uma conexão que estoura o próprio limite não gasta o teto global: outra conexão ainda passa", async () => {
    const { token } = await setup(uniqueEmail("joao"));
    env.RATE_LIMIT_ENABLED = "true";
    try {
      const abusive = { "fly-client-ip": `192.0.2.${Date.now() % 250}` };
      const sent = INVITE_PREVIEW_LIMIT.max + INVITE_PREVIEW_GLOBAL.max;
      let refused = 0;
      for (let i = 0; i < sent; i += 1) {
        if ((await preview(token, abusive)).status === 429) {
          refused += 1;
        }
      }
      expect(refused).toBe(INVITE_PREVIEW_GLOBAL.max);
      // Had the refused ones counted, the global cap would be spent by now.
      const other = { "fly-client-ip": `198.18.0.${Date.now() % 250}` };
      expect((await preview(token, other)).status).toBe(200);
    } finally {
      env.RATE_LIMIT_ENABLED = undefined;
    }
  });
});

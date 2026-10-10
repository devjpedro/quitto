import { beforeEach, describe, expect, it, mock } from "bun:test";

const sent: { html: string; subject: string; to: string }[] = [];
let failMail = false;

mock.module("../src/lib/mailer", () => ({
  sendEmail: (input: { html: string; subject: string; to: string }) => {
    if (failMail) {
      return Promise.reject(new Error("resend fora do ar"));
    }
    sent.push(input);
    return Promise.resolve();
  },
}));

const { app } = await import("../src/app");
const { db } = await import("../src/db/client");
const { contract, installment, invite, participant } = await import(
  "../src/db/schema"
);
const { buildSchedule } = await import("@quitto/shared");
const { eq } = await import("drizzle-orm");
const { signUpCookie, uniqueEmail } = await import("./helpers/auth");

/** n copies of a value (biome wants `new Array`; this reads better). */
function times<T>(count: number, value: T): T[] {
  return Array.from({ length: count }, () => value);
}

const SPLIT = {
  mode: "split",
  totalAmountCents: 600_000,
  installmentsCount: 12,
  firstDueDate: "2026-11-10",
} as const;

function post(cookie: string, body: unknown) {
  return app.handle(
    new Request("http://localhost/api/contracts", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(body),
    })
  );
}

const base = {
  title: "Notebook da Renata",
  description: "Dell Inspiron 15, usado, com carregador",
  ownerRole: "seller",
  requiresConfirmation: true,
  schedule: SPLIT,
};

describe("POST /api/contracts", () => {
  beforeEach(() => {
    failMail = false;
  });

  it("split com outra parte e e-mail: contrato, parcelas, os dois participantes e o convite, numa ida", async () => {
    const cookie = await signUpCookie(uniqueEmail("joao"));
    sent.length = 0;
    const res = await post(cookie, {
      ...base,
      counterparty: {
        name: "Renata Campos",
        email: "Renata.Campos@Exemplo.com ",
      },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invite).toEqual({
      email: "renata.campos@exemplo.com",
      sent: true,
    });

    const [row] = await db
      .select()
      .from(contract)
      .where(eq(contract.id, body.id));
    expect(row).toMatchObject({
      totalAmountCents: 600_000,
      installmentsCount: 12,
      requiresConfirmation: true,
      monthlyAmountCents: null,
      ownerRole: "seller",
    });

    const people = await db
      .select()
      .from(participant)
      .where(eq(participant.contractId, body.id));
    expect(
      people.map((p) => [p.displayName, p.role, p.linkedUserId !== null]).sort()
    ).toEqual([
      ["Renata Campos", "buyer", false],
      ["Test", "seller", true],
    ]);

    const [sentInvite] = await db
      .select()
      .from(invite)
      .where(eq(invite.contractId, body.id));
    expect(sentInvite?.email).toBe("renata.campos@exemplo.com");
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe("renata.campos@exemplo.com");
    expect(sent[0]?.html).toContain(`/invites/${sentInvite?.token}`);
  });

  it("o servidor grava exatamente o buildSchedule do mesmo corpo", async () => {
    const cookie = await signUpCookie(uniqueEmail("cents"));
    const schedule = {
      ...SPLIT,
      totalAmountCents: 100_000,
      installmentsCount: 3,
    };
    const res = await post(cookie, { ...base, schedule });
    const { id } = await res.json();
    const rows = await db
      .select({
        sequence: installment.sequence,
        amountCents: installment.amountCents,
        dueDate: installment.dueDate,
      })
      .from(installment)
      .where(eq(installment.contractId, id));
    expect(rows.sort((a, b) => a.sequence - b.sequence)).toEqual(
      buildSchedule({ ...schedule, mode: "split" })
    );
  });

  it("mensal sem outra parte: sem convite e o valor do mês gravado", async () => {
    const cookie = await signUpCookie(uniqueEmail("solo"));
    const res = await post(cookie, {
      ...base,
      requiresConfirmation: false,
      schedule: {
        mode: "monthly",
        monthlyAmountCents: 125_000,
        months: 12,
        firstDueDate: "2026-11-05",
      },
    });
    const body = await res.json();
    expect(body.invite).toBeNull();
    const [row] = await db
      .select()
      .from(contract)
      .where(eq(contract.id, body.id));
    expect(row?.monthlyAmountCents).toBe(125_000);
    const people = await db
      .select()
      .from(participant)
      .where(eq(participant.contractId, body.id));
    expect(people).toHaveLength(1);
  });

  it("sem outra parte, o servidor grava a confirmação que veio (o legado convida depois)", async () => {
    const cookie = await signUpCookie(uniqueEmail("legacy"));
    const res = await post(cookie, { ...base, requiresConfirmation: true });
    const { id } = await res.json();
    const [row] = await db.select().from(contract).where(eq(contract.id, id));
    expect(row?.requiresConfirmation).toBe(true);
  });

  it("outra parte sem e-mail: a vaga existe, nenhum convite nem e-mail", async () => {
    const cookie = await signUpCookie(uniqueEmail("noemail"));
    sent.length = 0;
    const res = await post(cookie, {
      ...base,
      counterparty: { name: "Renata Campos", email: "" },
    });
    const body = await res.json();
    expect(body.invite).toBeNull();
    const invites = await db
      .select()
      .from(invite)
      .where(eq(invite.contractId, body.id));
    expect(invites).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  it("uma a uma: grava as parcelas como vieram; o mensal ajustado não guarda valor do mês", async () => {
    const cookie = await signUpCookie(uniqueEmail("adjust"));
    const installments = [
      { amountCents: 160_000, dueDate: "2026-11-05" },
      { amountCents: 90_000, dueDate: "2026-12-05" },
    ];
    const res = await post(cookie, {
      ...base,
      schedule: {
        mode: "monthly",
        monthlyAmountCents: 125_000,
        months: 2,
        firstDueDate: "2026-11-05",
      },
      installments,
    });
    const { id } = await res.json();
    const rows = await db
      .select()
      .from(installment)
      .where(eq(installment.contractId, id));
    expect(
      rows
        .sort((a, b) => a.sequence - b.sequence)
        .map((r) => [r.amountCents, r.dueDate])
    ).toEqual([
      [160_000, "2026-11-05"],
      [90_000, "2026-12-05"],
    ]);
    const [row] = await db.select().from(contract).where(eq(contract.id, id));
    expect(row?.monthlyAmountCents).toBeNull();
  });

  it("uma a uma que muda o total: o schedule vai com a soma das parcelas, e o contrato guarda a soma", async () => {
    const cookie = await signUpCookie(uniqueEmail("newtotal"));
    const installments = [160_000, ...times(11, 50_000)].map((amountCents) => ({
      amountCents,
      dueDate: "2026-11-10",
    }));
    const res = await post(cookie, {
      ...base,
      schedule: { ...SPLIT, totalAmountCents: 710_000 },
      installments,
    });
    expect(res.status).toBe(200);
    const { id } = await res.json();
    const [row] = await db.select().from(contract).where(eq(contract.id, id));
    expect(row).toMatchObject({
      totalAmountCents: 710_000,
      installmentsCount: 12,
      monthlyAmountCents: null,
    });
  });

  it("422 com error.code e details.path/diff quando a soma passa; nada é criado", async () => {
    const email = uniqueEmail("over");
    const cookie = await signUpCookie(email);
    const installments = [160_000, ...times(11, 50_000)].map((amountCents) => ({
      amountCents,
      dueDate: "2026-11-10",
    }));
    const res = await post(cookie, { ...base, installments });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      error: {
        code: "installments.sum.over",
        message: "installments.sum.over",
        details: { path: "installments", diff: 110_000 },
      },
    });
    // Nothing was created: the new account still has no contract.
    const list = await app.handle(
      new Request("http://localhost/api/contracts", { headers: { cookie } })
    );
    expect(await list.json()).toEqual([]);
  });

  it("nome com 201 caracteres: o zod responde com código (o TypeBox não barra antes)", async () => {
    const cookie = await signUpCookie(uniqueEmail("long"));
    const res = await post(cookie, { ...base, title: "a".repeat(201) });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("contract.title.tooLong");
    expect(body.error.details).toEqual({ path: "title" });
  });

  it("o e-mail da outra parte é o da sessão: 422 counterparty.email.self", async () => {
    const email = uniqueEmail("self");
    const cookie = await signUpCookie(email);
    const res = await post(cookie, {
      ...base,
      counterparty: { name: "Eu mesmo", email: email.toUpperCase() },
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("counterparty.email.self");
    expect(body.error.details).toEqual({ path: "counterparty.email" });
  });

  it("o mailer falha: 200, contrato e convite criados, invite.sent false", async () => {
    const cookie = await signUpCookie(uniqueEmail("mailfail"));
    failMail = true;
    const res = await post(cookie, {
      ...base,
      counterparty: { name: "Renata Campos", email: "renata@exemplo.com" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invite).toEqual({ email: "renata@exemplo.com", sent: false });
    const invites = await db
      .select()
      .from(invite)
      .where(eq(invite.contractId, body.id));
    expect(invites).toHaveLength(1);
  });

  it("legado: o modo auto continua criando (até a Fase 6)", async () => {
    const cookie = await signUpCookie(uniqueEmail("legacy"));
    const res = await post(cookie, {
      title: "Contrato legado",
      ownerRole: "buyer",
      requiresConfirmation: false,
      schedule: { ...SPLIT, mode: "auto" },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).invite).toBeNull();
  });
});

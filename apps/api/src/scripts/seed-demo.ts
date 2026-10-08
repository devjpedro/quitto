import { randomBytes } from "node:crypto";
import { todayISO } from "@quitto/shared";
import { eq, like } from "drizzle-orm";
import PDFDocument from "pdfkit";
import { auth } from "../auth";
import { db } from "../db/client";
import {
  auditEvent,
  contract,
  installment,
  invite,
  notification,
  participant,
  proof,
  receiptShare,
  user,
} from "../db/schema";
import { env } from "../env";
import { demoScenario } from "../lib/demo-seed";
import {
  assertDemoEnvironment,
  DEMO_DOMAIN,
  DEMO_PASSWORD,
  type DemoAccountKey,
  type DemoContract,
  demoInviteToken,
  reminderDedupeKey,
} from "../lib/demo-seed-kit";
import { newShareToken } from "../lib/receipt-share";
import { deleteObjects, presignUpload } from "../lib/storage";

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

/** A small PDF that reads like a Pix receipt, so the proof preview is believable. */
async function proofPdf(lines: string[]): Promise<Uint8Array<ArrayBuffer>> {
  const doc = new PDFDocument({ size: "A6", margin: 24 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve) => doc.on("end", () => resolve()));
  const [heading, ...rest] = lines;
  doc.fontSize(13).text(heading ?? "");
  doc.moveDown(0.6).fontSize(10);
  for (const line of rest) {
    doc.text(line);
  }
  doc.end();
  await done;
  // A plain Uint8Array (as lib/documents/pdf.ts does): fetch's BodyInit takes it, a Buffer it does not.
  return new Uint8Array(Buffer.concat(chunks));
}

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const BRASILIA = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

async function uploadProof(
  objectKey: string,
  bytes: Uint8Array<ArrayBuffer>
): Promise<void> {
  const url = await presignUpload(objectKey, "application/pdf");
  const res = await fetch(url, {
    method: "PUT",
    body: bytes,
    headers: { "content-type": "application/pdf" },
  });
  if (!res.ok) {
    throw new Error(`upload do comprovante falhou: ${res.status}`);
  }
}

/** What a previous run left: the proof files first, then the accounts (the rest goes by cascade). */
async function wipe(): Promise<void> {
  const demo = like(user.email, `%@${DEMO_DOMAIN}`);
  const files = await db
    .select({ key: proof.objectKey })
    .from(proof)
    .innerJoin(installment, eq(proof.installmentId, installment.id))
    .innerJoin(contract, eq(installment.contractId, contract.id))
    .innerJoin(user, eq(contract.ownerId, user.id))
    .where(demo);
  await deleteObjects(files.map((f) => f.key));
  await db.delete(user).where(demo);
}

interface Created {
  contractId: string;
  installmentIds: Map<number, string>;
}

type DemoUsers = Map<
  DemoAccountKey,
  { id: string; name: string; email: string }
>;

interface Ctx {
  contractId: string;
  counterpartUser: { id: string; name: string; email: string } | undefined;
  createdAt: Date;
  installmentIds: Map<number, string>;
  ownerId: string;
  ownerName: string;
  spec: DemoContract;
}

async function insertInvite(
  ctx: Ctx,
  participantId: string,
  values: Partial<typeof invite.$inferInsert> & { email: string }
): Promise<void> {
  await db.insert(invite).values({
    contractId: ctx.contractId,
    participantId,
    token: randomBytes(32).toString("hex"),
    expiresAt: new Date(Date.now() + 14 * DAY_MS),
    ...values,
  });
}

async function insertPeople(
  ctx: Ctx,
  inviteeEmail: string | null,
  users: DemoUsers
): Promise<void> {
  const { spec, counterpartUser, createdAt } = ctx;
  await db.insert(participant).values({
    contractId: ctx.contractId,
    displayName: ctx.ownerName,
    role: spec.ownerRole,
    linkedUserId: ctx.ownerId,
    createdAt,
  });
  const [slot] = await db
    .insert(participant)
    .values({
      contractId: ctx.contractId,
      displayName: spec.counterpart.displayName,
      role: spec.counterpart.role,
      linkedUserId: counterpartUser?.id ?? null,
      pixKey: spec.counterpart.pixKey,
      createdAt: new Date(createdAt.getTime() + MINUTE_MS),
    })
    .returning({ id: participant.id });
  if (slot && inviteeEmail) {
    const sentAt = new Date(createdAt.getTime() + 2 * MINUTE_MS);
    await insertInvite(ctx, slot.id, {
      email: inviteeEmail,
      token: demoInviteToken(spec.key),
      createdAt: sentAt,
      // Seven days, like INVITE_TTL_DAYS: the expired one (10 days old) ran out 3 days ago.
      expiresAt:
        spec.inviteState === "expired"
          ? new Date(sentAt.getTime() + 7 * DAY_MS)
          : new Date(Date.now() + 14 * DAY_MS),
      declinedAt: spec.inviteState === "declined" ? daysAgo(1) : null,
    });
  }
  if (slot && counterpartUser && spec.counterpart.joinedAt) {
    // The accepted invite of a counterpart that has an account.
    const sentAt = createdAt.getTime() + 2 * MINUTE_MS;
    await insertInvite(ctx, slot.id, {
      email: counterpartUser.email,
      token: demoInviteToken(spec.key),
      createdAt: new Date(sentAt),
      expiresAt: new Date(sentAt + 7 * DAY_MS),
      acceptedByUserId: counterpartUser.id,
      acceptedAt: new Date(spec.counterpart.joinedAt),
    });
  }
  for (const viewer of spec.viewers) {
    const invitedAt = new Date(viewer.invitedAt);
    const [viewerSlot] = await db
      .insert(participant)
      .values({
        contractId: ctx.contractId,
        displayName: viewer.displayName,
        role: "viewer",
        linkedUserId: null,
        createdAt: invitedAt,
      })
      .returning({ id: participant.id });
    if (viewerSlot) {
      await insertInvite(ctx, viewerSlot.id, {
        email: users.get(viewer.invite)?.email as string,
        createdAt: invitedAt,
        expiresAt: new Date(invitedAt.getTime() + 14 * DAY_MS),
      });
    }
  }
}

/** Uploads the proofs; returns each file's real size by `sequence:fileName`, for the audit rows. */
async function insertProofs(ctx: Ctx): Promise<Map<string, number>> {
  const { spec, counterpartUser } = ctx;
  const payerIsCounterpart =
    spec.counterpart.role === "buyer" && counterpartUser !== undefined;
  const payerName =
    spec.counterpart.role === "buyer"
      ? spec.counterpart.displayName
      : ctx.ownerName;
  const receiverName =
    spec.counterpart.role === "buyer"
      ? ctx.ownerName
      : spec.counterpart.displayName;
  const sizes = new Map<string, number>();
  for (const p of spec.proofs) {
    const installmentId = ctx.installmentIds.get(p.sequence);
    const row = spec.installments.find((it) => it.sequence === p.sequence);
    if (!(installmentId && row)) {
      continue;
    }
    const objectKey = `proofs/${ctx.contractId}/${installmentId}/${crypto.randomUUID()}-${p.fileName}`;
    const bytes = await proofPdf([
      "Comprovante de Pix",
      BRL.format(row.amountCents / 100),
      BRASILIA.format(new Date(p.paidAt ?? p.at)),
      `Para: ${receiverName}`,
      `De: ${payerName}`,
      "Instituição: Cooperativa de Crédito Vale Verde",
    ]);
    await uploadProof(objectKey, bytes);
    await db.insert(proof).values({
      installmentId,
      objectKey,
      fileName: p.fileName,
      mimeType: "application/pdf",
      sizeBytes: bytes.length,
      uploadedBy: payerIsCounterpart ? (counterpartUser?.id ?? null) : null,
      createdAt: new Date(p.at),
    });
    sizes.set(`${p.sequence}:${p.fileName}`, bytes.length);
  }
  return sizes;
}

function actorOf(ctx: Ctx, actor: "owner" | "counterpart" | null) {
  if (actor === "owner") {
    return ctx.ownerId;
  }
  return actor === "counterpart" ? (ctx.counterpartUser?.id ?? null) : null;
}

async function insertHistory(
  ctx: Ctx,
  proofSizes: Map<string, number>
): Promise<void> {
  for (const e of ctx.spec.events) {
    const fileName = (e.metadata as { fileName?: string } | null)?.fileName;
    const sizeBytes =
      e.type === "proof_submitted" && e.sequence !== null && fileName
        ? proofSizes.get(`${e.sequence}:${fileName}`)
        : undefined;
    await db.insert(auditEvent).values({
      contractId: ctx.contractId,
      installmentId:
        e.sequence === null
          ? null
          : (ctx.installmentIds.get(e.sequence) ?? null),
      actorUserId: actorOf(ctx, e.actor),
      type: e.type,
      metadata:
        sizeBytes === undefined ? e.metadata : { ...e.metadata, sizeBytes },
      createdAt: new Date(e.at),
    });
  }
  for (const r of ctx.spec.receiptShares) {
    const installmentId = ctx.installmentIds.get(r.sequence);
    if (installmentId) {
      await db.insert(receiptShare).values({
        installmentId,
        token: newShareToken(),
        createdByUserId: ctx.ownerId,
        createdAt: new Date(r.at),
      });
    }
  }
}

async function createContract(
  spec: DemoContract,
  ownerId: string,
  ownerName: string,
  inviteeEmail: string | null,
  users: DemoUsers
): Promise<Created> {
  const createdAt = spec.createdAt
    ? new Date(spec.createdAt)
    : daysAgo(spec.createdDaysAgo);
  const total = spec.installments.reduce((sum, it) => sum + it.amountCents, 0);
  const [row] = await db
    .insert(contract)
    .values({
      ownerId,
      title: spec.title,
      ownerRole: spec.ownerRole,
      totalAmountCents: total,
      installmentsCount: spec.installments.length,
      monthlyAmountCents: spec.installments[0]?.amountCents ?? null,
      requiresConfirmation: spec.requiresConfirmation,
      createdAt,
    })
    .returning({ id: contract.id });
  const contractId = row?.id as string;
  const inserted = await db
    .insert(installment)
    .values(
      spec.installments.map((it) => ({
        contractId,
        sequence: it.sequence,
        amountCents: it.amountCents,
        dueDate: it.dueDate,
        status: it.status,
        paidAt: it.paidAt ? new Date(it.paidAt) : null,
        confirmedAt: it.confirmedAt ? new Date(it.confirmedAt) : null,
      }))
    )
    .returning({ id: installment.id, sequence: installment.sequence });
  const installmentIds = new Map(inserted.map((it) => [it.sequence, it.id]));
  const ctx: Ctx = {
    contractId,
    counterpartUser: spec.counterpart.account
      ? users.get(spec.counterpart.account)
      : undefined,
    createdAt,
    installmentIds,
    ownerId,
    ownerName,
    spec,
  };
  await insertPeople(ctx, inviteeEmail, users);
  await insertHistory(ctx, await insertProofs(ctx));
  return { contractId, installmentIds };
}

assertDemoEnvironment(env);
const scenario = demoScenario(todayISO());
await wipe();

const users: DemoUsers = new Map();
for (const demoAccount of scenario.accounts) {
  // Through Better Auth, so the password works on the login page.
  const { user: created } = await auth.api.signUpEmail({
    body: {
      name: demoAccount.name,
      email: demoAccount.email,
      password: DEMO_PASSWORD,
    },
  });
  await db
    .update(user)
    .set({
      emailVerified: true,
      pixKey: demoAccount.pixKey,
      createdAt: daysAgo(demoAccount.createdDaysAgo),
    })
    .where(eq(user.id, created.id));
  users.set(demoAccount.key, {
    id: created.id,
    name: demoAccount.name,
    email: demoAccount.email,
  });
}

const contracts = new Map<string, Created>();
for (const spec of scenario.contracts) {
  const owner = users.get(spec.owner);
  if (!owner) {
    throw new Error(`conta ${spec.owner} não existe no cenário`);
  }
  const invitee =
    spec.inviteEmail ??
    (spec.invite ? (users.get(spec.invite)?.email ?? null) : null);
  contracts.set(
    spec.key,
    await createContract(spec, owner.id, owner.name, invitee, users)
  );
}

await db.insert(notification).values(
  scenario.notifications.map((n) => {
    const target = contracts.get(n.contract);
    const userId = users.get(n.account)?.id as string;
    const installmentId =
      n.sequence === null
        ? null
        : (target?.installmentIds.get(n.sequence) ?? null);
    return {
      userId,
      type: n.type,
      contractId: target?.contractId as string,
      installmentId,
      metadata: n.metadata,
      dedupeKey: reminderDedupeKey(n.type, installmentId, userId),
      readAt: n.read ? new Date(n.at) : null,
      createdAt: new Date(n.at),
    };
  })
);

console.info(
  `seed:demo pronto. Nenhum e-mail saiu (os avisos [mailer] acima confirmam). Senha de todas: ${DEMO_PASSWORD}. Contas: ${scenario.accounts
    .map((a) => a.email)
    .join(", ")}`
);
process.exit(0);

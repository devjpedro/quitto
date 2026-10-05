import { randomBytes } from "node:crypto";
import { todayISO } from "@quitto/shared";
import { eq, like } from "drizzle-orm";
import PDFDocument from "pdfkit";
import { auth } from "../auth";
import { db } from "../db/client";
import {
  contract,
  installment,
  invite,
  notification,
  participant,
  proof,
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
  reminderDedupeKey,
} from "../lib/demo-seed-kit";
import { deleteObjects, presignUpload } from "../lib/storage";

const DAY_MS = 86_400_000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

/** A one-line PDF, so "Conferir" opens a real file. */
async function proofPdf(title: string): Promise<Uint8Array<ArrayBuffer>> {
  const doc = new PDFDocument({ size: "A6", margin: 24 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve) => doc.on("end", () => resolve()));
  doc.fontSize(12).text(`Comprovante de demonstração · ${title}`);
  doc.end();
  await done;
  // A plain Uint8Array (as lib/documents/pdf.ts does): fetch's BodyInit takes it, a Buffer it does not.
  return new Uint8Array(Buffer.concat(chunks));
}

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

async function createContract(
  spec: DemoContract,
  ownerId: string,
  ownerName: string,
  inviteeEmail: string | null
): Promise<Created> {
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
      pixKey: spec.pixKey,
      createdAt: daysAgo(spec.createdDaysAgo),
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
  await db.insert(participant).values({
    contractId,
    displayName: ownerName,
    role: spec.ownerRole,
    linkedUserId: ownerId,
  });
  const [slot] = await db
    .insert(participant)
    .values({
      contractId,
      displayName: spec.counterpart.displayName,
      role: spec.counterpart.role,
      linkedUserId: null,
    })
    .returning({ id: participant.id });
  if (inviteeEmail && slot) {
    await db.insert(invite).values({
      contractId,
      participantId: slot.id,
      email: inviteeEmail,
      token: randomBytes(32).toString("hex"),
      expiresAt: new Date(Date.now() + 14 * DAY_MS),
    });
  }
  const installmentIds = new Map(inserted.map((it) => [it.sequence, it.id]));
  for (const it of spec.installments) {
    const installmentId = installmentIds.get(it.sequence);
    if (!(it.proofAt && installmentId)) {
      continue;
    }
    const objectKey = `proofs/${contractId}/${installmentId}/${crypto.randomUUID()}-comprovante.pdf`;
    const bytes = await proofPdf(spec.title);
    await uploadProof(objectKey, bytes);
    await db.insert(proof).values({
      installmentId,
      objectKey,
      fileName: "comprovante.pdf",
      mimeType: "application/pdf",
      sizeBytes: bytes.length,
      // On purpose: the payer is an unlinked slot in the demo, with no account to upload from.
      uploadedBy: null,
      createdAt: new Date(it.proofAt),
    });
  }
  return { contractId, installmentIds };
}

assertDemoEnvironment(env);
const scenario = demoScenario(todayISO());
await wipe();

const users = new Map<
  DemoAccountKey,
  { id: string; name: string; email: string }
>();
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
  const invitee = spec.invite ? (users.get(spec.invite)?.email ?? null) : null;
  contracts.set(
    spec.key,
    await createContract(spec, owner.id, owner.name, invitee)
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

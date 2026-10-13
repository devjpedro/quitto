import { afterAll, describe, expect, it } from "bun:test";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import { app } from "../src/app";
import { db } from "../src/db/client";
import { installment, proof } from "../src/db/schema";
import { env } from "../src/env";
import { signUpCookie, uniqueEmail } from "./helpers/auth";

const configured = Boolean(process.env.S3_ENDPOINT);

function call(cookie: string, path: string, payload: unknown) {
  return app.handle(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(payload),
    })
  );
}

/** A contract of 3 installments; `paid` marks the first one as paid on creation. */
async function setup(label: string, opts: { paid: boolean }) {
  const cookie = await signUpCookie(uniqueEmail(label));
  const created = await call(cookie, "/api/contracts", {
    title: "C",
    ownerRole: "buyer",
    requiresConfirmation: true,
    schedule: {
      mode: "auto",
      totalAmountCents: 3000,
      installmentsCount: 3,
      firstDueDate: "2026-07-10",
    },
    ...(opts.paid ? { paidInstallments: [1] } : {}),
  });
  const { id } = await created.json();
  const detail = await app.handle(
    new Request(`http://localhost/api/contracts/${id}`, { headers: { cookie } })
  );
  const iId = (await detail.json()).installments[0].id as string;
  const me = await app.handle(
    new Request("http://localhost/api/me", { headers: { cookie } })
  );
  return {
    cookie,
    cId: id as string,
    iId,
    userId: (await me.json()).id as string,
  };
}

function presign(cookie: string, iId: string) {
  return call(cookie, `/api/installments/${iId}/proofs/presign`, {
    fileName: "c.pdf",
    mimeType: "application/pdf",
    sizeBytes: 100,
  });
}

async function seedProofs(iId: string, userId: string, count: number) {
  for (let i = 0; i < count; i++) {
    await db.insert(proof).values({
      installmentId: iId,
      objectKey: `proofs/seed/${crypto.randomUUID()}.pdf`,
      fileName: "s.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1,
      uploadedBy: userId,
    });
  }
}

async function putIncoming(cId: string, iId: string) {
  const key = `incoming/${cId}/${iId}/${crypto.randomUUID()}-ok.pdf`;
  await new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
    },
    forcePathStyle: true,
  }).send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET as string,
      Key: key,
      Body: "x",
      ContentType: "application/pdf",
    })
  );
  return key;
}

function register(cookie: string, iId: string, objectKey: string) {
  return call(cookie, `/api/installments/${iId}/proofs`, {
    objectKey,
    fileName: "x.pdf",
    mimeType: "application/pdf",
  });
}

describe.if(configured)("tetos de comprovante", () => {
  it("recusa o presign e o registro quando a parcela já tem 5 comprovantes", async () => {
    const { cookie, cId, iId, userId } = await setup("lim5", {
      paid: false,
    });
    await seedProofs(iId, userId, 5);
    expect((await presign(cookie, iId)).status).toBe(422);
    const key = await putIncoming(cId, iId);
    expect((await register(cookie, iId, key)).status).toBe(422);
  });

  it("aceita o presign com 4 comprovantes (o 5º)", async () => {
    const { cookie, iId, userId } = await setup("lim4", { paid: false });
    await seedProofs(iId, userId, 4);
    expect((await presign(cookie, iId)).status).toBe(200);
  });

  it("parcela já paga na criação: 1 comprovante, o 2º é recusado", async () => {
    const { cookie, cId, iId } = await setup("attach", { paid: true });
    expect((await presign(cookie, iId)).status).toBe(200);
    const key = await putIncoming(cId, iId);
    expect((await register(cookie, iId, key)).status).toBe(200);
    expect((await presign(cookie, iId)).status).toBe(422);
    const second = await putIncoming(cId, iId);
    expect((await register(cookie, iId, second)).status).toBe(422);
  });

  it("recusa o presign numa parcela que não aceita comprovante (confirmed)", async () => {
    const { cookie, iId } = await setup("conf", { paid: false });
    await db
      .update(installment)
      .set({ status: "confirmed" })
      .where(eq(installment.id, iId));
    expect((await presign(cookie, iId)).status).toBe(422);
  });
});

describe.if(configured)("teto de presign por usuário", () => {
  const before = env.RATE_LIMIT_ENABLED;
  afterAll(() => {
    env.RATE_LIMIT_ENABLED = before;
  });

  it("20 presigns por hora; o 21º é 429", async () => {
    const { cookie, iId } = await setup("rl", { paid: false });
    env.RATE_LIMIT_ENABLED = "true";
    for (let i = 0; i < 20; i++) {
      expect((await presign(cookie, iId)).status).toBe(200);
    }
    expect((await presign(cookie, iId)).status).toBe(429);
  });
});

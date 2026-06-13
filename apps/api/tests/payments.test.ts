import { describe, expect, it } from "bun:test";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { app } from "../src/app";

const configured = Boolean(process.env.S3_ENDPOINT);

/** Writes an object straight to storage with an arbitrary content-type (bypasses presign). */
async function putObjectRaw(objectKey: string, contentType: string) {
  const client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
    },
    forcePathStyle: true,
  });
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET as string,
      Key: objectKey,
      Body: "x",
      ContentType: contentType,
    })
  );
}

async function signUpCookie(tag: string): Promise<string> {
  const res = await app.handle(
    new Request("http://localhost/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "T",
        email: `${tag}-${Date.now()}@e.com`,
        password: "password123",
      }),
    })
  );
  return (res.headers.get("set-cookie") as string).split(";")[0] as string;
}

async function createContract(cookie: string, requiresConfirmation: boolean) {
  const res = await app.handle(
    new Request("http://localhost/api/contracts", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        title: "C",
        ownerRole: "buyer",
        requiresConfirmation,
        schedule: {
          mode: "auto",
          totalAmountCents: 3000,
          installmentsCount: 3,
          firstDueDate: "2026-07-10",
        },
      }),
    })
  );
  return (await res.json()).id as string;
}

async function firstInstallmentId(
  cookie: string,
  contractId: string
): Promise<string> {
  const res = await app.handle(
    new Request(`http://localhost/api/contracts/${contractId}`, {
      headers: { cookie },
    })
  );
  return (await res.json()).installments[0].id as string;
}

async function uploadProof(cookie: string, installmentId: string) {
  const presign = await (
    await app.handle(
      new Request(
        `http://localhost/api/installments/${installmentId}/proofs/presign`,
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie },
          body: JSON.stringify({
            fileName: "c.pdf",
            mimeType: "application/pdf",
          }),
        }
      )
    )
  ).json();
  await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "content-type": "application/pdf" },
    body: "%PDF-1.4 fake",
  });
  return app.handle(
    new Request(`http://localhost/api/installments/${installmentId}/proofs`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        objectKey: presign.objectKey,
        fileName: "c.pdf",
        mimeType: "application/pdf",
      }),
    })
  );
}

describe.if(configured)("POST presign", () => {
  it("retorna uploadUrl + objectKey para o dono", async () => {
    const cookie = await signUpCookie("presign");
    const cId = await createContract(cookie, true);
    const iId = await firstInstallmentId(cookie, cId);
    const res = await app.handle(
      new Request(`http://localhost/api/installments/${iId}/proofs/presign`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          fileName: "comprovante.pdf",
          mimeType: "application/pdf",
        }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.uploadUrl).toContain("http");
    expect(body.objectKey).toContain(`/${iId}/`);
  });
});

describe.if(configured)("confirm upload (com confirmação)", () => {
  it("envia comprovante e vai para awaiting_confirmation", async () => {
    const cookie = await signUpCookie("up1");
    const cId = await createContract(cookie, true);
    const iId = await firstInstallmentId(cookie, cId);
    const res = await uploadProof(cookie, iId);
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("awaiting_confirmation");
  });
});

describe.if(configured)("confirm upload (sem confirmação)", () => {
  it("envia comprovante e já fica paid", async () => {
    const cookie = await signUpCookie("up2");
    const cId = await createContract(cookie, false);
    const iId = await firstInstallmentId(cookie, cId);
    const res = await uploadProof(cookie, iId);
    expect((await res.json()).status).toBe("paid");
  });
});

describe.if(configured)("confirm/dispute", () => {
  it("vendedor/dono confirma após o upload", async () => {
    const cookie = await signUpCookie("cf");
    const cId = await createContract(cookie, true);
    const iId = await firstInstallmentId(cookie, cId);
    await uploadProof(cookie, iId);
    const res = await app.handle(
      new Request(`http://localhost/api/installments/${iId}/confirm`, {
        method: "POST",
        headers: { cookie },
      })
    );
    expect((await res.json()).status).toBe("confirmed");
  });

  it("rejeita confirmar uma parcela ainda pendente (transição inválida -> 422)", async () => {
    const cookie = await signUpCookie("cf2");
    const cId = await createContract(cookie, true);
    const iId = await firstInstallmentId(cookie, cId);
    const res = await app.handle(
      new Request(`http://localhost/api/installments/${iId}/confirm`, {
        method: "POST",
        headers: { cookie },
      })
    );
    expect(res.status).toBe(422);
  });
});

describe.if(configured)("GET installment detail", () => {
  it("traz proofs com downloadUrl e a timeline de eventos", async () => {
    const cookie = await signUpCookie("det");
    const cId = await createContract(cookie, true);
    const iId = await firstInstallmentId(cookie, cId);
    await uploadProof(cookie, iId);
    const res = await app.handle(
      new Request(`http://localhost/api/installments/${iId}`, {
        headers: { cookie },
      })
    );
    const body = await res.json();
    expect(body.proofs).toHaveLength(1);
    expect(body.proofs[0].downloadUrl).toContain("http");
    expect(body.events.length).toBeGreaterThanOrEqual(1);
    // timeline expõe ator e metadata (motivo/arquivo) para o drawer da 3b
    expect(body.events[0].type).toBe("proof_submitted");
    expect(typeof body.events[0].actorUserId).toBe("string");
    expect(typeof body.events[0].actorName).toBe("string");
    expect(body.events[0].metadata.fileName).toBe("c.pdf");
  });
});

describe.if(configured)("confirm upload (MIME do objeto armazenado)", () => {
  it("rejeita objeto com content-type fora da whitelist (-> 422)", async () => {
    const cookie = await signUpCookie("mime");
    const cId = await createContract(cookie, true);
    const iId = await firstInstallmentId(cookie, cId);
    const objectKey = `proofs/${cId}/${iId}/${crypto.randomUUID()}-evil.txt`;
    await putObjectRaw(objectKey, "text/plain");
    const res = await app.handle(
      new Request(`http://localhost/api/installments/${iId}/proofs`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          objectKey,
          fileName: "evil.pdf",
          mimeType: "application/pdf",
        }),
      })
    );
    expect(res.status).toBe(422);
  });
});

import { describe, expect, it } from "bun:test";
import { app } from "../src/app";

const configured = Boolean(process.env.S3_ENDPOINT);

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

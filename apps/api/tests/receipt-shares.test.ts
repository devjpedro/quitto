import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { app } from "../src/app";
import { db } from "../src/db/client";
import { contract, installment, receiptShare } from "../src/db/schema";
import { signUpCookie, uniqueEmail } from "./helpers/auth";

async function createPaidInstallment(cookie: string) {
  const created = await app.handle(
    new Request("http://localhost/api/contracts", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        title: "Aluguel & cia",
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
  const contractId = (await created.json()).id as string;
  const detail = await app.handle(
    new Request(`http://localhost/api/contracts/${contractId}`, {
      headers: { cookie },
    })
  );
  const installmentId = (await detail.json()).installments[0].id as string;
  await app.handle(
    new Request(
      `http://localhost/api/installments/${installmentId}/mark-paid`,
      { method: "POST", headers: { cookie } }
    )
  );
  return { contractId, installmentId };
}

describe("receipt_share schema", () => {
  it("impede dois shares ativos na mesma parcela", async () => {
    const cookie = await signUpCookie(uniqueEmail("rs-idx"));
    const { installmentId } = await createPaidInstallment(cookie);
    const [inst] = await db
      .select()
      .from(installment)
      .where(eq(installment.id, installmentId));
    expect(inst?.status).toBe("paid");
    const [owner] = await db
      .select({ ownerId: contract.ownerId })
      .from(contract)
      .where(eq(contract.id, inst?.contractId as string));
    const createdByUserId = owner?.ownerId as string;

    await db
      .insert(receiptShare)
      .values({ installmentId, token: `t1-${installmentId}`, createdByUserId });
    await expect(
      (async () =>
        db.insert(receiptShare).values({
          installmentId,
          token: `t2-${installmentId}`,
          createdByUserId,
        }))()
    ).rejects.toThrow();

    // revogado não conta: um novo ativo é permitido
    await db
      .update(receiptShare)
      .set({ revokedAt: new Date() })
      .where(eq(receiptShare.installmentId, installmentId));
    await db
      .insert(receiptShare)
      .values({ installmentId, token: `t3-${installmentId}`, createdByUserId });
  });
});

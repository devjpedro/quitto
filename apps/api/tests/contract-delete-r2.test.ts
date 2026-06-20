import { describe, expect, it, spyOn } from "bun:test";
import { eq } from "drizzle-orm";
import { app } from "../src/app";
import { db } from "../src/db/client";
import { installment, proof } from "../src/db/schema";
// biome-ignore lint/performance/noNamespaceImport: spyOn needs a mutable module object to intercept the handler's named `deleteObjects` import (ES named bindings are read-only)
import * as storage from "../src/lib/storage";
import { signUpCookie } from "./helpers/auth";

let seq = 0;
function uniqueEmail(tag: string): string {
  seq += 1;
  return `${tag}-${Date.now()}-${seq}@example.com`;
}

async function createContract(cookie: string): Promise<string> {
  const res = await app.handle(
    new Request("http://localhost/api/contracts", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        title: "Contrato Teste",
        ownerRole: "buyer",
        requiresConfirmation: true,
        schedule: {
          mode: "auto",
          totalAmountCents: 3000,
          installmentsCount: 3,
          firstDueDate: "2026-07-10",
        },
      }),
    })
  );
  const body = await res.json();
  return body.id as string;
}

/** Attaches a proof row to one installment and returns its object key. */
async function attachProof(
  contractId: string,
  objectKey: string
): Promise<void> {
  const [inst] = await db
    .select({ id: installment.id })
    .from(installment)
    .where(eq(installment.contractId, contractId))
    .limit(1);
  if (!inst) {
    throw new Error("contract has no installments to attach a proof to");
  }
  await db.insert(proof).values({
    installmentId: inst.id,
    objectKey,
    fileName: "comprovante.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1234,
  });
}

describe("DELETE /api/contracts/:id purga as chaves R2 do contrato", () => {
  it("passa exatamente as chaves de comprovante do contrato para deleteObjects", async () => {
    const captured: string[][] = [];
    const spy = spyOn(storage, "deleteObjects").mockImplementation(
      (keys: string[]) => {
        captured.push(keys);
        return Promise.resolve();
      }
    );

    try {
      // Other contract whose proof key must NOT leak into the delete.
      const other = await signUpCookie(uniqueEmail("r2-other"));
      const otherContractId = await createContract(other);
      await attachProof(otherContractId, "proofs/other/leak-key.pdf");

      // Target contract with its own proof key.
      const owner = await signUpCookie(uniqueEmail("r2-owner"));
      const contractId = await createContract(owner);
      const objectKey = `proofs/${contractId}/known-key.pdf`;
      await attachProof(contractId, objectKey);

      const res = await app.handle(
        new Request(`http://localhost/api/contracts/${contractId}`, {
          method: "DELETE",
          headers: { cookie: owner },
        })
      );
      expect(res.status).toBe(200);

      // The handler must have called deleteObjects exactly once...
      expect(spy).toHaveBeenCalledTimes(1);
      // ...with exactly this contract's proof keys (no leak from the other contract).
      expect(captured).toHaveLength(1);
      expect(captured[0]).toEqual([objectKey]);
    } finally {
      spy.mockRestore();
    }
  });
});

import { describe, expect, it } from "bun:test";
import { db } from "../src/db/client";
import { contract, user } from "../src/db/schema";
import { getContractRole } from "../src/lib/contract-access";

const naoEncontradoRe = /não encontrado/i;

async function makeUser(id: string) {
  await db
    .insert(user)
    .values({ id, name: id, email: `${id}@example.com` })
    .onConflictDoNothing();
}

describe("getContractRole", () => {
  it("returns 'owner' for the contract owner", async () => {
    const uid = `owner-${Date.now()}`;
    await makeUser(uid);
    const rows = await db
      .insert(contract)
      .values({
        ownerId: uid,
        title: "T",
        ownerRole: "buyer",
        totalAmountCents: 1000,
        installmentsCount: 1,
      })
      .returning();
    const inserted = rows[0];
    if (!inserted) {
      throw new Error("insert did not return a row");
    }
    expect(await getContractRole(uid, inserted.id)).toBe("owner");
  });

  it("throws NotFound for a stranger (não vaza existência)", async () => {
    const owner = `o2-${Date.now()}`;
    const stranger = `s2-${Date.now()}`;
    await makeUser(owner);
    await makeUser(stranger);
    const rows2 = await db
      .insert(contract)
      .values({
        ownerId: owner,
        title: "T",
        ownerRole: "seller",
        totalAmountCents: 1000,
        installmentsCount: 1,
      })
      .returning();
    const inserted2 = rows2[0];
    if (!inserted2) {
      throw new Error("insert did not return a row");
    }
    await expect(getContractRole(stranger, inserted2.id)).rejects.toThrow(
      naoEncontradoRe
    );
  });
});

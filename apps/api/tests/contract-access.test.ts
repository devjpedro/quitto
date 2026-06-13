import { describe, expect, it } from "bun:test";
import { db } from "../src/db/client";
import { contract, participant, user } from "../src/db/schema";
import { getCapabilities, getContractRole } from "../src/lib/contract-access";

const naoEncontradoRe = /não encontrado/i;

async function makeUser(id: string) {
  await db
    .insert(user)
    .values({ id, name: id, email: `${id}@example.com` })
    .onConflictDoNothing();
}

/** Cria um contrato + a linha de participante do dono (espelha o fluxo de create). */
async function makeContract(ownerId: string, ownerRole: "buyer" | "seller") {
  const rows = await db
    .insert(contract)
    .values({
      ownerId,
      title: "T",
      ownerRole,
      totalAmountCents: 1000,
      installmentsCount: 1,
    })
    .returning();
  const inserted = rows[0];
  if (!inserted) {
    throw new Error("insert did not return a row");
  }
  await db.insert(participant).values({
    contractId: inserted.id,
    displayName: ownerId,
    role: ownerRole,
    linkedUserId: ownerId,
  });
  return inserted.id;
}

describe("getContractRole", () => {
  it("devolve a vaga real + isOwner para o dono", async () => {
    const uid = `owner-${Date.now()}`;
    await makeUser(uid);
    const cId = await makeContract(uid, "buyer");
    expect(await getContractRole(uid, cId)).toEqual({
      role: "buyer",
      isOwner: true,
    });
  });

  it("lança NotFound para estranho (não vaza existência)", async () => {
    const owner = `o2-${Date.now()}`;
    const stranger = `s2-${Date.now()}`;
    await makeUser(owner);
    await makeUser(stranger);
    const cId = await makeContract(owner, "seller");
    await expect(getContractRole(stranger, cId)).rejects.toThrow(
      naoEncontradoRe
    );
  });
});

describe("getCapabilities", () => {
  it("contrato solo: dono acumula pagador e aprovador", async () => {
    const uid = `solo-${Date.now()}`;
    await makeUser(uid);
    const cId = await makeContract(uid, "buyer");
    const caps = await getCapabilities(uid, cId);
    expect(caps.isPayer).toBe(true);
    expect(caps.isApprover).toBe(true);
    expect(caps.isOwner).toBe(true);
  });

  it("dono+comprador com vendedor VINCULADO: dono só é pagador", async () => {
    const owner = `ob-${Date.now()}`;
    const seller = `sv-${Date.now()}`;
    await makeUser(owner);
    await makeUser(seller);
    const cId = await makeContract(owner, "buyer");
    await db.insert(participant).values({
      contractId: cId,
      displayName: "Vendedor",
      role: "seller",
      linkedUserId: seller,
    });
    const caps = await getCapabilities(owner, cId);
    expect(caps.isPayer).toBe(true);
    expect(caps.isApprover).toBe(false);
  });

  it("dono+comprador com vendedor só CONVIDADO (sem conta): dono ainda aprova", async () => {
    const owner = `oc-${Date.now()}`;
    await makeUser(owner);
    const cId = await makeContract(owner, "buyer");
    await db.insert(participant).values({
      contractId: cId,
      displayName: "Convidado",
      role: "seller",
      linkedUserId: null,
    });
    const caps = await getCapabilities(owner, cId);
    expect(caps.isApprover).toBe(true);
  });

  it("vendedor vinculado (não-dono): é aprovador, não pagador", async () => {
    const owner = `op-${Date.now()}`;
    const seller = `sp-${Date.now()}`;
    await makeUser(owner);
    await makeUser(seller);
    const cId = await makeContract(owner, "buyer");
    await db.insert(participant).values({
      contractId: cId,
      displayName: "Vendedor",
      role: "seller",
      linkedUserId: seller,
    });
    const caps = await getCapabilities(seller, cId);
    expect(caps.role).toBe("seller");
    expect(caps.isOwner).toBe(false);
    expect(caps.isApprover).toBe(true);
    expect(caps.isPayer).toBe(false);
  });

  it("viewer não é pagador nem aprovador", async () => {
    const owner = `ov-${Date.now()}`;
    const viewer = `vv-${Date.now()}`;
    await makeUser(owner);
    await makeUser(viewer);
    const cId = await makeContract(owner, "buyer");
    await db.insert(participant).values({
      contractId: cId,
      displayName: "Convidado",
      role: "viewer",
      linkedUserId: viewer,
    });
    const caps = await getCapabilities(viewer, cId);
    expect(caps.isPayer).toBe(false);
    expect(caps.isApprover).toBe(false);
  });
});

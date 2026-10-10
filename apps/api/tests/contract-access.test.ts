import { describe, expect, it } from "bun:test";
import { db } from "../src/db/client";
import { contract, participant, user } from "../src/db/schema";
import {
  type Capabilities,
  capabilitiesFromRows,
  getCapabilities,
  getContractRole,
  type ParticipantRow,
} from "../src/lib/contract-access";

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

/** Contrato sem nenhuma linha de participante (dado legado). */
async function makeBareContract(
  ownerId: string,
  ownerRole: "buyer" | "seller" | "neutral"
) {
  const rows = await db
    .insert(contract)
    .values({
      ownerId,
      title: "T-bare",
      ownerRole,
      totalAmountCents: 1000,
      installmentsCount: 1,
    })
    .returning();
  const id = rows[0]?.id;
  if (!id) {
    throw new Error("insert did not return a row");
  }
  return id;
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

  it("dono com ownerRole neutral e sem linha de participante → 404", async () => {
    const uid = `neutral-${Date.now()}`;
    await makeUser(uid);
    const cId = await makeBareContract(uid, "neutral");
    await expect(getContractRole(uid, cId)).rejects.toThrow(naoEncontradoRe);
  });

  it("dono sem linha de participante (legado) cai no ownerRole", async () => {
    const uid = `legacy-seller-${Date.now()}`;
    await makeUser(uid);
    const cId = await makeBareContract(uid, "seller");
    expect(await getContractRole(uid, cId)).toEqual({
      role: "seller",
      isOwner: true,
    });
  });

  it("linha legada 'owner' não esconde a vaga real: as duas portas dão a mesma vaga", async () => {
    const uid = `legacy-owner-${Date.now()}`;
    await makeUser(uid);
    const cId = await makeBareContract(uid, "neutral");
    await db.insert(participant).values({
      contractId: cId,
      displayName: uid,
      role: "owner",
      linkedUserId: uid,
    });
    await db.insert(participant).values({
      contractId: cId,
      displayName: uid,
      role: "buyer",
      linkedUserId: uid,
    });
    expect(await getContractRole(uid, cId)).toEqual({
      role: "buyer",
      isOwner: true,
    });
    expect(await getCapabilities(uid, cId)).toMatchObject({
      role: "buyer",
      isOwner: true,
    });
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

describe("capabilitiesFromRows (regra pura)", () => {
  const ME = "u-me";
  const OTHER = "u-other";
  const row = (role: string, linkedUserId: string | null): ParticipantRow => ({
    role,
    linkedUserId,
  });
  const cases: {
    name: string;
    owned: { ownerId: string; ownerRole: string };
    people: ParticipantRow[];
    expected: Capabilities | null;
  }[] = [
    {
      name: "estranho (sem vaga e não dono) → null",
      owned: { ownerId: OTHER, ownerRole: "buyer" },
      people: [row("buyer", OTHER), row("seller", null)],
      expected: null,
    },
    {
      name: "comprador vinculado, não dono: só pagador",
      owned: { ownerId: OTHER, ownerRole: "seller" },
      people: [row("seller", OTHER), row("buyer", ME)],
      expected: {
        role: "buyer",
        isOwner: false,
        isPayer: true,
        isApprover: false,
      },
    },
    {
      name: "vendedor vinculado, não dono: só aprovador",
      owned: { ownerId: OTHER, ownerRole: "buyer" },
      people: [row("buyer", OTHER), row("seller", ME)],
      expected: {
        role: "seller",
        isOwner: false,
        isPayer: false,
        isApprover: true,
      },
    },
    {
      name: "espectador: nem pagador nem aprovador",
      owned: { ownerId: OTHER, ownerRole: "buyer" },
      people: [row("buyer", OTHER), row("viewer", ME)],
      expected: {
        role: "viewer",
        isOwner: false,
        isPayer: false,
        isApprover: false,
      },
    },
    {
      name: "dono comprador, vendedor sem conta: herda a aprovação",
      owned: { ownerId: ME, ownerRole: "buyer" },
      people: [row("buyer", ME), row("seller", null)],
      expected: {
        role: "buyer",
        isOwner: true,
        isPayer: true,
        isApprover: true,
      },
    },
    {
      name: "dono comprador, vendedor vinculado: só pagador",
      owned: { ownerId: ME, ownerRole: "buyer" },
      people: [row("buyer", ME), row("seller", OTHER)],
      expected: {
        role: "buyer",
        isOwner: true,
        isPayer: true,
        isApprover: false,
      },
    },
    {
      name: "dono vendedor, comprador sem conta: herda o pagamento",
      owned: { ownerId: ME, ownerRole: "seller" },
      people: [row("seller", ME), row("buyer", null)],
      expected: {
        role: "seller",
        isOwner: true,
        isPayer: true,
        isApprover: true,
      },
    },
    {
      name: "dono vendedor, comprador vinculado: só aprovador",
      owned: { ownerId: ME, ownerRole: "seller" },
      people: [row("seller", ME), row("buyer", OTHER)],
      expected: {
        role: "seller",
        isOwner: true,
        isPayer: false,
        isApprover: true,
      },
    },
    {
      name: "dono sem linha (legado) cai no ownerRole",
      owned: { ownerId: ME, ownerRole: "seller" },
      people: [row("buyer", OTHER)],
      expected: {
        role: "seller",
        isOwner: true,
        isPayer: false,
        isApprover: true,
      },
    },
    {
      name: "dono neutral só com a linha legada 'owner' → null",
      owned: { ownerId: ME, ownerRole: "neutral" },
      people: [row("owner", ME)],
      expected: null,
    },
    {
      name: "linha legada 'owner' não esconde a vaga real",
      owned: { ownerId: ME, ownerRole: "neutral" },
      people: [row("owner", ME), row("buyer", ME)],
      expected: {
        role: "buyer",
        isOwner: true,
        isPayer: true,
        isApprover: true,
      },
    },
  ];
  for (const c of cases) {
    it(c.name, () => {
      expect(capabilitiesFromRows(ME, c.owned, c.people)).toEqual(c.expected);
    });
  }
});

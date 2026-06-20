import { describe, expect, it } from "bun:test";
import { and, eq } from "drizzle-orm";
import { app } from "../src/app";
import { db } from "../src/db/client";
import { contract, participant } from "../src/db/schema";
import { buildUserExport, type ExportInput } from "../src/lib/account-export";
import { signUpCookie } from "./helpers/auth";

let seq = 0;
function uniqueEmail(tag: string): string {
  seq += 1;
  return `${tag}-${Date.now()}-${seq}@e.com`;
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

async function meId(cookie: string): Promise<string> {
  const res = await app.handle(
    new Request("http://localhost/api/me", { headers: { cookie } })
  );
  return (await res.json()).id as string;
}

const input: ExportInput = {
  exportedAt: "2026-07-15T00:00:00.000Z",
  profile: { id: "u1", name: "Eu", email: "eu@e.com" },
  ownedContracts: [
    {
      contract: { id: "c1", title: "Aluguel" },
      installments: [
        {
          sequence: 1,
          amountCents: 1000,
          dueDate: "2026-07-10",
          status: "pending",
        },
      ],
      participants: [{ displayName: "Eu", role: "buyer" }],
      auditEvents: [
        { type: "proof_submitted", createdAt: "2026-07-01T00:00:00.000Z" },
      ],
      proofs: [{ fileName: "c.pdf", createdAt: "2026-07-01T00:00:00.000Z" }],
    },
  ],
  participatingContracts: [
    {
      contract: { id: "c2", title: "Venda" },
      mySlot: "seller",
      installments: [
        {
          sequence: 1,
          amountCents: 2000,
          dueDate: "2026-08-10",
          status: "paid",
        },
      ],
    },
  ],
  notifications: [
    {
      type: "payment_confirmed",
      contractId: "c1",
      installmentId: "i1",
      readAt: null,
      createdAt: "2026-07-02T00:00:00.000Z",
    },
  ],
};

describe("buildUserExport", () => {
  it("assembles the export object with all sections", () => {
    const out = buildUserExport(input);
    expect(out.profile.email).toBe("eu@e.com");
    expect(out.ownedContracts).toHaveLength(1);
    expect(out.ownedContracts[0]?.contract.title).toBe("Aluguel");
    expect(out.participatingContracts[0]?.mySlot).toBe("seller");
    expect(out.notifications).toHaveLength(1);
    expect(out.exportedAt).toBe("2026-07-15T00:00:00.000Z");
  });
});

describe("GET /api/me/export", () => {
  it("requires auth", async () => {
    const res = await app.handle(new Request("http://localhost/api/me/export"));
    expect(res.status).toBe(401);
  });

  it("returns the caller's data as a JSON attachment", async () => {
    const cookie = await signUpCookie(uniqueEmail("exp"));
    await createContract(cookie, false);
    const res = await app.handle(
      new Request("http://localhost/api/me/export", { headers: { cookie } })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    const body = await res.json();
    expect(body.ownedContracts.length).toBe(1);
    expect(body.profile).toBeDefined();
  });

  it("exports contracts where the caller is a linked participant (not owner)", async () => {
    const ownerCookie = await signUpCookie(uniqueEmail("exp-owner"));
    const ownedContract = await createContract(ownerCookie, false);
    const linkedCookie = await signUpCookie(uniqueEmail("exp-linked"));
    const linkedId = await meId(linkedCookie);
    await db.insert(participant).values({
      contractId: ownedContract,
      displayName: "Vinculado",
      role: "seller",
      linkedUserId: linkedId,
    });

    const res = await app.handle(
      new Request("http://localhost/api/me/export", {
        headers: { cookie: linkedCookie },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.participatingContracts.length).toBe(1);
    expect(body.participatingContracts[0].mySlot).toBe("seller");
    expect(body.participatingContracts[0].contract.title).toBe("C");
    expect(body.ownedContracts.length).toBe(0);
  });
});

describe("DELETE /api/me", () => {
  it("requires auth", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/me", { method: "DELETE" })
    );
    expect(res.status).toBe(401);
  });

  it("deletes own contracts but preserves a third party's contract (slot unlinked)", async () => {
    // contrato de um terceiro, onde o 'mortal' participa como vendedor vinculado
    const ownerCookie = await signUpCookie(uniqueEmail("del-owner"));
    const thirdContract = await createContract(ownerCookie, false);
    const mortalCookie = await signUpCookie(uniqueEmail("del-mortal"));
    const mortalId = await meId(mortalCookie);
    await db.insert(participant).values({
      contractId: thirdContract,
      displayName: "Mortal",
      role: "seller",
      linkedUserId: mortalId,
    });
    // contrato próprio do 'mortal'
    const ownContract = await createContract(mortalCookie, false);

    const res = await app.handle(
      new Request("http://localhost/api/me", {
        method: "DELETE",
        headers: { cookie: mortalCookie },
      })
    );
    expect(res.status).toBe(200);

    // contrato próprio sumiu
    const own = await db
      .select()
      .from(contract)
      .where(eq(contract.id, ownContract));
    expect(own).toHaveLength(0);
    // contrato do terceiro sobrevive; o slot do mortal foi desvinculado
    const third = await db
      .select()
      .from(contract)
      .where(eq(contract.id, thirdContract));
    expect(third).toHaveLength(1);
    const slot = await db
      .select()
      .from(participant)
      .where(
        and(
          eq(participant.contractId, thirdContract),
          eq(participant.role, "seller")
        )
      );
    expect(slot[0]?.linkedUserId).toBeNull();
  });
});

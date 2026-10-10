import { describe, expect, it } from "bun:test";
import { todayISO } from "@quitto/shared";
import { app } from "../src/app";
import { addDays } from "../src/lib/dates";
import { signUpCookie, uniqueEmail } from "./helpers/auth";

function post(cookie: string, path: string, body?: unknown) {
  return app.handle(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  );
}

async function get<T>(cookie: string, path: string): Promise<T> {
  const res = await app.handle(
    new Request(`http://localhost${path}`, { headers: { cookie } })
  );
  expect(res.status).toBe(200);
  return (await res.json()) as T;
}

async function inviteTo(
  ownerCookie: string,
  contractId: string,
  email: string,
  role: "seller" | "viewer"
): Promise<string> {
  const added = await post(
    ownerCookie,
    `/api/contracts/${contractId}/participants`,
    { displayName: "Convidado", role, email: "convidado@exemplo.com" }
  );
  const { id } = (await added.json()) as { id: string };
  const inv = await post(
    ownerCookie,
    `/api/contracts/${contractId}/participants/${id}/invite`,
    { email }
  );
  return ((await inv.json()) as { token: string }).token;
}

/** What the contract list and the home each say about one contract. */
async function sees(cookie: string, contractId: string) {
  const list = await get<{ id: string }[]>(cookie, "/api/contracts");
  const home = await get<{ activeContractsCount: number }>(cookie, "/api/home");
  return {
    inList: list.some((c) => c.id === contractId),
    activeContractsCount: home.activeContractsCount,
  };
}

describe("quem vê o contrato (a lista e o home usam a mesma regra)", () => {
  it("dono e vinculado em qualquer papel veem; convidado que não aceitou e estranho não", async () => {
    const owner = await signUpCookie(uniqueEmail("vis-owner"));
    const created = await post(owner, "/api/contracts", {
      title: "Visível",
      ownerRole: "buyer",
      requiresConfirmation: false,
      schedule: {
        mode: "auto",
        totalAmountCents: 3000,
        installmentsCount: 3,
        firstDueDate: addDays(todayISO(), 10),
      },
    });
    const { id } = (await created.json()) as { id: string };

    const sellerEmail = uniqueEmail("vis-seller");
    const seller = await signUpCookie(sellerEmail);
    const viewerEmail = uniqueEmail("vis-viewer");
    const viewer = await signUpCookie(viewerEmail);
    const pendingEmail = uniqueEmail("vis-pending");
    const pending = await signUpCookie(pendingEmail);
    const stranger = await signUpCookie(uniqueEmail("vis-stranger"));

    for (const [cookie, email, role] of [
      [seller, sellerEmail, "seller"],
      [viewer, viewerEmail, "viewer"],
    ] as const) {
      const token = await inviteTo(owner, id, email, role);
      expect((await post(cookie, `/api/invites/${token}/accept`)).status).toBe(
        200
      );
    }
    await inviteTo(owner, id, pendingEmail, "viewer");

    const visible = { inList: true, activeContractsCount: 1 };
    const hidden = { inList: false, activeContractsCount: 0 };
    expect(await sees(owner, id)).toEqual(visible);
    expect(await sees(seller, id)).toEqual(visible);
    expect(await sees(viewer, id)).toEqual(visible);
    expect(await sees(pending, id)).toEqual(hidden);
    expect(await sees(stranger, id)).toEqual(hidden);
  });
});

import { app } from "../../src/app";
import { signUpCookie, uniqueEmail } from "./auth";

export function call(
  cookie: string,
  path: string,
  method = "GET",
  body?: unknown
) {
  return app.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers: { "content-type": "application/json", cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  );
}

/** Invites `email` to a new slot of the contract and accepts it with `cookie`. */
export async function linkSlot(
  owner: string,
  contractId: string,
  slot: { displayName: string; role: "buyer" | "seller" | "viewer" },
  email: string,
  cookie: string
) {
  const p = await (
    await call(owner, `/api/contracts/${contractId}/participants`, "POST", {
      ...slot,
      ...(slot.role === "viewer" ? { email } : {}),
    })
  ).json();
  const { token } = await (
    await call(
      owner,
      `/api/contracts/${contractId}/participants/${p.id}/invite`,
      "POST",
      { email }
    )
  ).json();
  await call(cookie, `/api/invites/${token}/accept`, "POST");
  return p.id as string;
}

/**
 * The owner receives (seller). A payer account is linked as buyer, a viewer
 * account follows, and an outsider has nothing to do with the contract.
 * Installments: 3 × R$ 300,00, first due 2026-08-30 (past, so overdue).
 */
export async function partyScenario(title = "Moto do Rafa") {
  const owner = await signUpCookie(uniqueEmail("party-owner"));
  const created = await call(owner, "/api/contracts", "POST", {
    title,
    ownerRole: "seller",
    requiresConfirmation: true,
    schedule: {
      mode: "auto",
      totalAmountCents: 90_000,
      installmentsCount: 3,
      firstDueDate: "2026-08-30",
    },
  });
  const { id } = (await created.json()) as { id: string };
  const payerEmail = uniqueEmail("party-payer");
  const payer = await signUpCookie(payerEmail);
  await linkSlot(
    owner,
    id,
    { displayName: "Rafael Prado", role: "buyer" },
    payerEmail,
    payer
  );
  const viewerEmail = uniqueEmail("party-viewer");
  const viewer = await signUpCookie(viewerEmail);
  await linkSlot(
    owner,
    id,
    { displayName: "Marcos Prado", role: "viewer" },
    viewerEmail,
    viewer
  );
  const outsider = await signUpCookie(uniqueEmail("party-outsider"));
  return { id, owner, payer, payerEmail, viewer, viewerEmail, outsider };
}

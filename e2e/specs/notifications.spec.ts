import type { Browser } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  getContract,
  newUser,
  PROOF_PDF,
  seedContract,
  seedInvite,
} from "../fixtures";

const ACCEPT_INVITE = /Aceitar convite/i;
const BELL_UNREAD = /Notificações, \d+ não lidas/i;
const PROOF_NOTIF = "Novo comprovante para confirmar";

interface NotifSetup {
  a: Awaited<ReturnType<typeof newUser>>;
  b: Awaited<ReturnType<typeof newUser>>;
  id: string;
  installmentId: string;
}

// A=buyer+owner submits a proof; B=seller linked receives a proof_submitted notification.
async function setupWithProof(browser: Browser): Promise<NotifSetup> {
  const a = await newUser(browser);
  const { id } = await seedContract(a.page.request, {
    title: "Notif E2E",
    ownerRole: "buyer",
    requiresConfirmation: true,
  });
  const b = await newUser(browser);
  const { token } = await seedInvite(a.page.request, id, {
    displayName: "Vendedor",
    role: "seller",
    email: b.email,
  });
  await b.page.goto(`/invites/${token}`);
  await b.page.getByRole("button", { name: ACCEPT_INVITE }).click();
  await b.page.waitForURL(`**/contracts/${id}`);
  const detail = await getContract(a.page.request, id);
  const installmentId = detail.installments[0].id as string;
  // A envia comprovante (gera a notificação para B)
  await a.page.goto(`/contracts/${id}?installment=${installmentId}`);
  await a.page.getByLabel("Comprovante").setInputFiles(PROOF_PDF);
  await a.page.getByRole("button", { name: "Enviar comprovante" }).click();
  await expect(
    a.page.getByLabel("Parcela").getByText("aguardando")
  ).toBeVisible();
  return { a, b, id, installmentId };
}

test("comprovante gera notificação com deep-link para a parcela", async ({
  browser,
}) => {
  const { a, b, installmentId } = await setupWithProof(browser);
  try {
    await b.page.goto("/");
    await expect(
      b.page.getByRole("button", { name: BELL_UNREAD })
    ).toBeVisible();

    await b.page.goto("/notifications");
    await expect(b.page.getByText(PROOF_NOTIF)).toBeVisible();

    const res = await b.page.request.get("/api/notifications");
    const list = (await res.json()) as Array<{ id: string }>;
    const notifId = list[0].id;

    await b.page.getByTestId(`notification-${notifId}`).click();
    await expect(b.page).toHaveURL(new RegExp(`installment=${installmentId}`));
    await expect(b.page.getByLabel("Parcela")).toBeVisible();
  } finally {
    await a.close();
    await b.close();
  }
});

test("marcar todas como lidas zera o contador", async ({ browser }) => {
  const { a, b } = await setupWithProof(browser);
  try {
    await b.page.goto("/notifications");
    await expect(b.page.getByText(PROOF_NOTIF)).toBeVisible();
    await b.page
      .getByRole("button", { name: "Marcar todas como lidas" })
      .click();
    await expect(b.page.getByRole("button", { name: BELL_UNREAD })).toHaveCount(
      0
    );
    await expect(
      b.page.getByRole("button", { name: "Notificações", exact: true })
    ).toBeVisible();
  } finally {
    await a.close();
    await b.close();
  }
});

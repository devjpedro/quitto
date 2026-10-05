import type { Browser } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  getContract,
  newUser,
  openNotifications,
  PROOF_PDF,
  seedContract,
  seedInvite,
  sheetAtRest,
  signup,
} from "../fixtures";

const ACCEPT_INVITE = /Aceitar convite/i;
const BELL_ONE_UNREAD = "Notificações, 1 não lida";
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

test("comprovante gera notificação no painel do sino, com deep-link para a parcela", async ({
  browser,
}) => {
  const { a, b, installmentId } = await setupWithProof(browser);
  try {
    await b.page.goto("/");
    await expect(
      b.page
        .getByRole("button", { name: BELL_ONE_UNREAD })
        .filter({ visible: true })
    ).toBeVisible();
    const panel = await openNotifications(b.page);
    await panel.getByRole("button", { name: PROOF_NOTIF }).click();
    await expect(b.page).toHaveURL(new RegExp(`installment=${installmentId}`));
    const drawer = b.page.getByLabel("Parcela");
    await expect(drawer).toBeVisible();
    // The installment drawer is modal (the shell is hidden from the tree
    // meanwhile): close it, then the bell no longer counts the read one. Esc
    // only once it has loaded and rests: a press while it mounts is lost.
    await expect(drawer.getByText("aguardando")).toBeVisible();
    await sheetAtRest(drawer);
    await b.page.keyboard.press("Escape");
    await expect(b.page.getByLabel("Parcela")).toBeHidden();
    await expect(
      b.page
        .getByRole("button", { name: "Notificações", exact: true })
        .filter({ visible: true })
    ).toBeVisible();
  } finally {
    await a.close();
    await b.close();
  }
});

test("marcar todas como lidas zera o contador", async ({ browser }) => {
  const { a, b } = await setupWithProof(browser);
  try {
    await b.page.goto("/");
    const panel = await openNotifications(b.page);
    await expect(panel.getByText(PROOF_NOTIF)).toBeVisible();
    // The unread one carries the tag before "mark all as read" takes it away.
    await expect(panel.getByText("Nova", { exact: true })).toHaveCount(1);
    await panel
      .getByRole("button", { name: "Marcar todas como lidas" })
      .click();
    await expect(panel.getByText("Nova", { exact: true })).toHaveCount(0);
    await b.page.keyboard.press("Escape");
    await expect(
      b.page
        .getByRole("button", { name: "Notificações", exact: true })
        .filter({ visible: true })
    ).toBeVisible();
  } finally {
    await a.close();
    await b.close();
  }
});

test("o endereço antigo /notifications leva ao Agora", async ({ page }) => {
  await signup(page);
  await page.goto("/notifications");
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

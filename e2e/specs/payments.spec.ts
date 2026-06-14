import type { Browser, Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  getContract,
  newUser,
  PROOF_PDF,
  seedContract,
  seedInvite,
} from "../fixtures";

const ACCEPT_INVITE = /Aceitar convite/i;
const PAID_OR_CONFIRMED = /^(?:paga|confirmada)$/;

// The installment drawer (SheetContent titled "Parcela N") — status text and the
// proof/receipt UI live here. Scope assertions to it so they don't collide with
// the installment list rows behind the drawer or the dialog button/heading text.
function drawer(page: Page): Locator {
  return page.getByLabel("Parcela");
}

interface ConfirmSetup {
  a: Awaited<ReturnType<typeof newUser>>;
  b: Awaited<ReturnType<typeof newUser>>;
  id: string;
  installmentId: string;
}

// A = buyer+owner (payer); B = seller linked (approver). Contract requires confirmation.
async function setupConfirmContract(browser: Browser): Promise<ConfirmSetup> {
  const a = await newUser(browser);
  const { id } = await seedContract(a.page.request, {
    title: "Pagamento E2E",
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
  return { a, b, id, installmentId };
}

test("comprovante fica aguardando; vendedor confirma; recibo aparece", async ({
  browser,
}) => {
  const { a, b, id, installmentId } = await setupConfirmContract(browser);
  try {
    await a.page.goto(`/contracts/${id}?installment=${installmentId}`);
    await a.page.getByLabel("Comprovante").setInputFiles(PROOF_PDF);
    await a.page.getByRole("button", { name: "Enviar comprovante" }).click();
    await expect(
      drawer(a.page).getByText("aguardando", { exact: true })
    ).toBeVisible();

    await b.page.goto(`/contracts/${id}?installment=${installmentId}`);
    await b.page.getByRole("button", { name: "Confirmar pagamento" }).click();
    await b.page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirmar", exact: true })
      .click();
    await expect(drawer(b.page).getByText(PAID_OR_CONFIRMED)).toBeVisible();
    await expect(
      b.page.getByRole("link", { name: "Baixar recibo" })
    ).toBeVisible();
  } finally {
    await a.close();
    await b.close();
  }
});

test("vendedor contesta com motivo; comprador reenvia", async ({ browser }) => {
  const { a, b, id, installmentId } = await setupConfirmContract(browser);
  try {
    await a.page.goto(`/contracts/${id}?installment=${installmentId}`);
    await a.page.getByLabel("Comprovante").setInputFiles(PROOF_PDF);
    await a.page.getByRole("button", { name: "Enviar comprovante" }).click();
    await expect(
      drawer(a.page).getByText("aguardando", { exact: true })
    ).toBeVisible();

    await b.page.goto(`/contracts/${id}?installment=${installmentId}`);
    await b.page.getByRole("button", { name: "Contestar" }).click();
    await b.page.locator("#dispute-reason").fill("Comprovante ilegível");
    await b.page.getByRole("button", { name: "Enviar contestação" }).click();
    await expect(
      drawer(b.page).getByText("contestada", { exact: true })
    ).toBeVisible();

    await a.page.goto(`/contracts/${id}?installment=${installmentId}`);
    await expect(
      drawer(a.page).getByText("contestada", { exact: true })
    ).toBeVisible();
    await a.page.getByLabel("Comprovante").setInputFiles(PROOF_PDF);
    await a.page.getByRole("button", { name: "Enviar comprovante" }).click();
    await expect(
      drawer(a.page).getByText("aguardando", { exact: true })
    ).toBeVisible();
  } finally {
    await a.close();
    await b.close();
  }
});

test("sem confirmação, pagador marca como paga", async ({ browser }) => {
  const a = await newUser(browser);
  try {
    const { id } = await seedContract(a.page.request, {
      title: "Sem confirmação",
      ownerRole: "buyer",
      requiresConfirmation: false,
    });
    const detail = await getContract(a.page.request, id);
    const installmentId = detail.installments[0].id as string;
    await a.page.goto(`/contracts/${id}?installment=${installmentId}`);
    await a.page.getByRole("button", { name: "Marcar como paga" }).click();
    await a.page
      .getByRole("dialog")
      .getByRole("button", { name: "Marcar como paga" })
      .click();
    await expect(
      drawer(a.page).getByText("paga", { exact: true })
    ).toBeVisible();
  } finally {
    await a.close();
  }
});

test("parcela pendente não mostra link de recibo", async ({ browser }) => {
  const a = await newUser(browser);
  try {
    const { id } = await seedContract(a.page.request, {
      title: "Recibo ausente",
      ownerRole: "buyer",
      requiresConfirmation: false,
    });
    const detail = await getContract(a.page.request, id);
    const installmentId = detail.installments[0].id as string;
    await a.page.goto(`/contracts/${id}?installment=${installmentId}`);
    await expect(
      drawer(a.page).getByText("pendente", { exact: true })
    ).toBeVisible();
    await expect(
      drawer(a.page).getByRole("link", { name: "Baixar recibo" })
    ).toHaveCount(0);
  } finally {
    await a.close();
  }
});

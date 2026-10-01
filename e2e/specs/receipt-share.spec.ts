import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import {
  getContract,
  seedContract,
  signup,
  waitForHydrated,
} from "../fixtures";

const TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const TITLE = "Aluguel do apê";
const SHARE_BUTTON = /compartilhar recibo/i;
const COPY_LINK = /copiar link/i;
const PUBLIC_URL = /\/r\/[A-Za-z0-9_-]{43}$/;
const RECEIPT_HEADING = /recibo de pagamento/i;
const INSTALLMENT_1_OF_3 = /parcela 1 de 3/i;
const DOWNLOAD_PDF = /baixar pdf/i;
const REVOKE_LINK = /revogar link/i;
const REVOKE_DIALOG = /revogar link do recibo/i;
const REVOKE_CONFIRM = /^revogar$/i;
const ACTIVE_LINK = /link público ativo/i;
const UNAVAILABLE = /este recibo não está disponível/i;

async function paidInstallmentDrawer(page: Page) {
  await signup(page);
  const { id } = await seedContract(page.request, { title: TITLE });
  const detail = await getContract(page.request, id);
  const installmentId = detail.installments[0].id as string;
  const paid = await page.request.post(
    `/api/installments/${installmentId}/mark-paid`
  );
  expect(paid.ok()).toBeTruthy();
  await page.goto(`/contracts/${id}?installment=${installmentId}`);
  await waitForHydrated(page);
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  await drawer.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished))
  );
  return { drawer, installmentId };
}

test("dono compartilha o recibo, anônimo abre, dono revoga", async ({
  browser,
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const { drawer } = await paidInstallmentDrawer(page);

  await drawer.getByRole("button", { name: SHARE_BUTTON }).click();
  await page.getByRole("menuitem", { name: COPY_LINK }).click();
  await expect(page.getByText("Link copiado")).toBeVisible();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(url).toMatch(PUBLIC_URL);

  const anon = await browser.newContext();
  const visitor = await anon.newPage();
  const res = await visitor.goto(url);
  expect(res?.status()).toBe(200);
  await expect(
    visitor.getByRole("heading", { name: RECEIPT_HEADING })
  ).toBeVisible();
  await expect(visitor.getByText(TITLE)).toBeVisible();
  await expect(visitor.getByText(INSTALLMENT_1_OF_3)).toBeVisible();
  const pdfHref = await visitor
    .getByRole("link", { name: DOWNLOAD_PDF })
    .getAttribute("href");
  const pdf = await visitor.request.get(pdfHref as string);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");

  await drawer.getByRole("button", { name: REVOKE_LINK }).click();
  const confirm = page.getByRole("dialog", { name: REVOKE_DIALOG });
  await confirm.getByRole("button", { name: REVOKE_CONFIRM }).click();
  // O diálogo só fecha depois do DELETE concluir. Enquanto ele está aberto, o
  // Radix marca a gaveta como aria-hidden e `drawer.getByText(...)` vem vazio
  // trivialmente — por isso espera o fechamento antes de checar o bloco.
  await expect(confirm).toBeHidden();
  await expect(drawer.getByText(ACTIVE_LINK)).toHaveCount(0);

  const after = await visitor.goto(url);
  expect(after?.status()).toBe(404);
  await expect(visitor.getByText(UNAVAILABLE)).toBeVisible();
  await anon.close();
});

for (const scheme of ["light", "dark"] as const) {
  test(`recibo público e bloco na gaveta sem violações de a11y (${scheme})`, async ({
    browser,
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    const { drawer, installmentId } = await paidInstallmentDrawer(page);
    await expect(
      drawer.getByRole("button", { name: SHARE_BUTTON })
    ).toBeVisible();
    const drawerScan = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(drawerScan.violations).toEqual([]);

    const share = await page.request.post(
      `/api/installments/${installmentId}/receipt-share`
    );
    const { token } = (await share.json()) as { token: string };

    const anon = await browser.newContext({ colorScheme: scheme });
    const visitor = await anon.newPage();
    await visitor.goto(`/r/${token}`);
    await waitForHydrated(visitor);
    const pageScan = await new AxeBuilder({ page: visitor })
      .withTags(TAGS)
      .analyze();
    expect(pageScan.violations).toEqual([]);
    await anon.close();
  });
}

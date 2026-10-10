import { type Browser, expect, test } from "@playwright/test";
import {
  getContract,
  scan,
  seedContract,
  signup,
  waitForHydrated,
} from "../fixtures";

const RECEIPT_FILE = /^recibo-.*-parcela-1\.pdf$/;
const REVOKED = /revogad/i;

/** A paid installment with a public link, made by the owner; returns the link's token. */
async function sharedReceipt(browser: Browser): Promise<string> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await signup(page);
    const { id } = await seedContract(page.request, { ownerRole: "seller" });
    const detail = await getContract(page.request, id);
    const first = (detail.installments as { id: string; sequence: number }[])
      .filter((installment) => installment.sequence === 1)
      .map((installment) => installment.id)[0] as string;
    const marked = await page.request.post(
      `/api/installments/${first}/mark-received`
    );
    expect(marked.ok()).toBeTruthy();
    const shared = await page.request.post(
      `/api/installments/${first}/receipt-share`
    );
    expect(shared.ok()).toBeTruthy();
    return ((await shared.json()) as { token: string }).token;
  } finally {
    await context.close();
  }
}

test("o recibo mostra o valor, a parcela e quem recebeu, e o PDF baixa", async ({
  browser,
}) => {
  const token = await sharedReceipt(browser);
  const visitor = await browser.newContext();
  const page = await visitor.newPage();
  await page.goto(`/r/${token}`);
  await waitForHydrated(page);
  const receipt = page.getByTestId("public-receipt");
  await expect(receipt).toContainText("Recibo de pagamento");
  await expect(receipt).toContainText("R$ 1.000,00");
  await expect(receipt).toContainText("Parcela 1 de 3");
  await expect(receipt).toContainText("Quem recebeu");
  await expect(receipt).not.toContainText("Quem pagou");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Baixar PDF" }).click();
  expect((await download).suggestedFilename()).toMatch(RECEIPT_FILE);
  await visitor.close();
});

test("um token que não existe: 404 e a frase", async ({ page }) => {
  const response = await page.goto("/r/token-que-nao-existe");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Este recibo não está disponível" })
  ).toBeVisible();
  await expect(page.getByText(REVOKED)).toHaveCount(0);
});

test("the receipt in en-US", async ({ browser }) => {
  const token = await sharedReceipt(browser);
  const visitor = await browser.newContext({ locale: "en-US" });
  const page = await visitor.newPage();
  await page.goto(`/r/${token}`);
  await expect(page.getByTestId("public-receipt")).toContainText(
    "Payment receipt"
  );
  await visitor.close();
});

for (const scheme of ["light", "dark"] as const) {
  test(`axe (${scheme}): o recibo e o indisponível`, async ({ browser }) => {
    const token = await sharedReceipt(browser);
    const visitor = await browser.newContext();
    await visitor.addCookies([
      { name: "theme", value: scheme, url: "http://localhost:3001" },
    ]);
    const page = await visitor.newPage();
    await page.goto(`/r/${token}`);
    await waitForHydrated(page);
    await scan(page);
    await page.goto("/r/token-que-nao-existe");
    await waitForHydrated(page);
    await scan(page);
    await visitor.close();
  });
}

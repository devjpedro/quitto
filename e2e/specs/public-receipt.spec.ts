import { type Browser, expect, type Page, test } from "@playwright/test";
import {
  getContract,
  newUser,
  scan,
  seedContract,
  twoParties,
  uploadProofApi,
  waitForHydrated,
} from "../fixtures";

const RECEIPT_FILE = /^recibo-.*-parcela-1\.pdf$/;
const REVOKED = /revogad/i;

/**
 * A paid installment with a public link, made by the owner (who stays signed
 * in in `context`, for the tests that visit it signed in); `proof` adds a
 * proof sent before the payment, which is the receipt's "comprovante" line.
 */
async function sharedReceiptSession(
  browser: Browser,
  { proof = false }: { proof?: boolean } = {}
) {
  if (!proof) {
    const user = await newUser(browser);
    const { id } = await seedContract(user.page.request, {
      ownerRole: "seller",
    });
    const detail = await getContract(user.page.request, id);
    const first = (detail.installments as { id: string; sequence: number }[])
      .filter((installment) => installment.sequence === 1)
      .map((installment) => installment.id)[0] as string;
    return { ...(await payAndShare(user.page, first)), close: user.close };
  }
  // With a proof, the other side is the payer who sends it; the owner confirms.
  const parties = await twoParties(browser, {
    ownerRole: "seller",
    requiresConfirmation: true,
    firstDueDaysFromToday: -10,
    count: 3,
  });
  const first = parties.installments.find((i) => i.sequence === 1)
    ?.id as string;
  await uploadProofApi(parties.other.page.request, first);
  const confirmed = await parties.owner.page.request.post(
    `/api/installments/${first}/confirm`
  );
  expect(confirmed.ok()).toBeTruthy();
  const shared = await parties.owner.page.request.post(
    `/api/installments/${first}/receipt-share`
  );
  expect(shared.ok()).toBeTruthy();
  return {
    close: async () => {
      await parties.owner.close();
      await parties.other.close();
    },
    page: parties.owner.page,
    token: ((await shared.json()) as { token: string }).token,
  };
}

/** The receiver marks the installment received and shares its receipt. */
async function payAndShare(page: Page, installmentId: string) {
  const marked = await page.request.post(
    `/api/installments/${installmentId}/mark-received`
  );
  expect(marked.ok()).toBeTruthy();
  const shared = await page.request.post(
    `/api/installments/${installmentId}/receipt-share`
  );
  expect(shared.ok()).toBeTruthy();
  return { page, token: ((await shared.json()) as { token: string }).token };
}

/** The link only, with the owner's session closed. */
async function sharedReceipt(browser: Browser): Promise<string> {
  const { close, token } = await sharedReceiptSession(browser);
  await close();
  return token;
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

test("Compartilhar copia o link no computador, Imprimir é só ícone e o recibo não tem Voltar", async ({
  browser,
}) => {
  const token = await sharedReceipt(browser);
  const visitor = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await visitor.newPage();
  await page.goto(`/r/${token}`);
  await waitForHydrated(page);
  await expect(page.getByRole("button", { name: "Voltar" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Imprimir" })).toHaveText("");
  await page.getByRole("button", { name: "Compartilhar" }).click();
  await expect(page.getByText("Link copiado").first()).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
    new RegExp(`/r/${token}$`)
  );
  await visitor.close();
});

const SIZES = [
  { height: 740, width: 390 },
  { height: 720, width: 1280 },
];

test("o recibo cabe na tela sem rolar a 390×740 e a 1280×720, e o cartão não gruda nos botões: deslogado e logado, com e sem o comprovante", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  for (const proof of [false, true]) {
    const owner = await sharedReceiptSession(browser, { proof });
    const visitor = await browser.newContext();
    try {
      const signedOut = await visitor.newPage();
      for (const [who, page] of [
        ["deslogado", signedOut],
        ["logado", owner.page],
      ] as const) {
        for (const size of SIZES) {
          const where = `${who}, ${size.width}×${size.height}, comprovante: ${proof}`;
          await page.setViewportSize(size);
          await page.goto(`/r/${owner.token}`);
          await waitForHydrated(page);
          const card = page.getByTestId("public-receipt");
          await expect(card).toBeVisible();
          if (proof) {
            await expect(page.getByTestId("receipt-proof")).toBeVisible();
          }
          // The card rises in: measure where it rests, not mid-animation.
          await page.evaluate(() =>
            Promise.all(
              document
                .getAnimations()
                .filter(
                  (animation) =>
                    animation.effect?.getTiming().iterations !==
                    Number.POSITIVE_INFINITY
                )
                .map((animation) => animation.finished)
            )
          );
          const { scrollHeight, innerHeight } = await page.evaluate(() => ({
            scrollHeight: document.documentElement.scrollHeight,
            innerHeight: window.innerHeight,
          }));
          expect(scrollHeight, where).toBeLessThanOrEqual(innerHeight);
          const cardBox = await card.boundingBox();
          const buttonBox = await page
            .getByRole("link", { name: "Baixar PDF" })
            .boundingBox();
          expect(
            (buttonBox?.y ?? 0) - ((cardBox?.y ?? 0) + (cardBox?.height ?? 0)),
            where
          ).toBeGreaterThanOrEqual(24);
        }
      }
    } finally {
      await visitor.close();
      await owner.close();
    }
  }
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

test("Baixar PDF e os dois ícones têm a mesma altura (os ícones são quadrados)", async ({
  browser,
}) => {
  const token = await sharedReceipt(browser);
  const visitor = await browser.newContext();
  const page = await visitor.newPage();
  await page.goto(`/r/${token}`);
  await waitForHydrated(page);
  const boxes = await Promise.all(
    [
      page.getByRole("link", { name: "Baixar PDF" }),
      page.getByRole("button", { name: "Compartilhar" }),
      page.getByRole("button", { name: "Imprimir" }),
    ].map((locator) => locator.boundingBox())
  );
  const [pdf, share, print] = boxes as NonNullable<(typeof boxes)[number]>[];
  expect(share?.height).toBe(pdf?.height);
  expect(print?.height).toBe(pdf?.height);
  expect(share?.width).toBe(share?.height);
  expect(print?.width).toBe(print?.height);
  await visitor.close();
});

test("Imprimir manda o PDF do recibo para a impressão (não a página)", async ({
  browser,
}) => {
  const token = await sharedReceipt(browser);
  const visitor = await browser.newContext();
  const page = await visitor.newPage();
  await page.goto(`/r/${token}`);
  await waitForHydrated(page);
  const pdf = page.waitForResponse((res) =>
    res.url().endsWith(`/api/public/receipts/${token}/receipt.pdf`)
  );
  await page.getByRole("button", { name: "Imprimir" }).click();
  expect((await pdf).headers()["content-type"]).toBe("application/pdf");
  await expect(page.locator('iframe[aria-hidden="true"]')).toHaveCount(1);
  await visitor.close();
});

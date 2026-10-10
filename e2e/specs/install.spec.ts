import { expect, type Page, test } from "@playwright/test";
import { openAccountMenu, signup, waitForHydrated } from "../fixtures";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";

const CARD = "install-card";

/** Chrome's `beforeinstallprompt`, synthetic: `prompt` is a stub that counts. */
async function fireInstallPrompt(page: Page) {
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, {
      prompt: () => {
        (window as unknown as { __prompted: number }).__prompted =
          ((window as unknown as { __prompted?: number }).__prompted ?? 0) + 1;
        return Promise.resolve();
      },
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    window.dispatchEvent(event);
  });
}

test.describe("instalar o app · celular Android", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    userAgent: ANDROID_UA,
  });

  test("o card só aparece com o beforeinstallprompt e o Instalar chama o prompt()", async ({
    page,
  }) => {
    await signup(page);
    await waitForHydrated(page);
    await expect(page.getByTestId(CARD)).toHaveCount(0);
    await fireInstallPrompt(page);
    const card = page.getByTestId(CARD);
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Instalar" }).click();
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { __prompted?: number }).__prompted
        )
      )
      .toBe(1);
  });

  test("o appinstalled esconde o card e marca a conta", async ({ page }) => {
    await signup(page);
    await waitForHydrated(page);
    await fireInstallPrompt(page);
    await expect(page.getByTestId(CARD)).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
    await expect(page.getByTestId(CARD)).toHaveCount(0);
    await expect
      .poll(async () => {
        const res = await page.request.get("/api/me");
        return (await res.json()).appInstalledAt;
      })
      .not.toBeNull();
  });

  test("o ✕ esconde o card, e ele continua escondido depois do reload", async ({
    page,
  }) => {
    await signup(page);
    await waitForHydrated(page);
    await fireInstallPrompt(page);
    await page
      .getByTestId(CARD)
      .getByRole("button", { name: "Agora não" })
      .click();
    await expect(page.getByTestId(CARD)).toHaveCount(0);
    await page.reload();
    await waitForHydrated(page);
    await fireInstallPrompt(page);
    // The menu item only shows with `me` loaded and the event captured: from here on, the card's absence is the ✕.
    await openAccountMenu(page);
    await expect(
      page.getByRole("menuitem", { name: "Instalar app" })
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId(CARD)).toHaveCount(0);
  });

  test("dentro do app instalado (standalone) o card não aparece", async ({
    page,
  }) => {
    await signup(page);
    await page.addInitScript(() => {
      const real = window.matchMedia.bind(window);
      window.matchMedia = (query: string) =>
        query.includes("display-mode: standalone")
          ? ({
              matches: true,
              media: query,
              addEventListener: () => undefined,
              removeEventListener: () => undefined,
            } as unknown as MediaQueryList)
          : real(query);
    });
    await page.reload();
    await waitForHydrated(page);
    await fireInstallPrompt(page);
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId(CARD)).toHaveCount(0);
    await openAccountMenu(page);
    await expect(
      page.getByRole("menuitem", { name: "Instalar app" })
    ).toHaveCount(0);
  });

  test("abrir em standalone marca a conta, e o card some em outro navegador", async ({
    page,
    browser,
  }) => {
    const email = await signup(page);
    await page.addInitScript(() => {
      const real = window.matchMedia.bind(window);
      window.matchMedia = (query: string) =>
        query.includes("display-mode: standalone")
          ? ({
              matches: true,
              media: query,
              addEventListener: () => undefined,
              removeEventListener: () => undefined,
            } as unknown as MediaQueryList)
          : real(query);
    });
    await page.reload();
    await waitForHydrated(page);
    await expect
      .poll(async () => {
        const res = await page.request.get("/api/me");
        return (await res.json()).appInstalledAt;
      })
      .not.toBeNull();
    // Another browser of the same account: the card stays away.
    const other = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: ANDROID_UA,
      storageState: await page.context().storageState(),
    });
    const second = await other.newPage();
    await second.goto("/");
    await waitForHydrated(second);
    await fireInstallPrompt(second);
    await second.waitForLoadState("networkidle");
    await expect(second.getByTestId(CARD)).toHaveCount(0);
    await openAccountMenu(second);
    await expect(
      second.getByRole("menuitem", { name: "Instalar app" })
    ).toHaveCount(0);
    await other.close();
    expect(email).toBeTruthy();
  });
});

test.describe("instalar o app · iPhone", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    userAgent: IPHONE_UA,
  });

  test("o item do menu da conta abre o sheet de 3 passos", async ({ page }) => {
    await signup(page);
    await waitForHydrated(page);
    await openAccountMenu(page);
    await page.getByRole("menuitem", { name: "Instalar app" }).click();
    const sheet = page.getByRole("dialog", { name: "Instalar no iPhone" });
    await expect(sheet).toBeVisible();
    await expect(
      sheet.getByText("Toque em “Adicionar à Tela de Início”")
    ).toBeVisible();
  });

  test("o card mostra 'Como instalar' e abre o sheet", async ({ page }) => {
    await signup(page);
    await waitForHydrated(page);
    await page
      .getByTestId(CARD)
      .getByRole("button", { name: "Como instalar" })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Instalar no iPhone" })
    ).toBeVisible();
  });
});

test.describe("instalar o app · navegador interno", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    userAgent: `${IPHONE_UA} Instagram 350.0`,
  });

  test("no Instagram nunca aparece", async ({ page }) => {
    await signup(page);
    await waitForHydrated(page);
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId(CARD)).toHaveCount(0);
    await openAccountMenu(page);
    await expect(
      page.getByRole("menuitem", { name: "Instalar app" })
    ).toHaveCount(0);
  });
});

test.describe("instalar o app · desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("no desktop o card não aparece", async ({ page }) => {
    await signup(page);
    await waitForHydrated(page);
    await fireInstallPrompt(page);
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId(CARD)).toHaveCount(0);
  });
});

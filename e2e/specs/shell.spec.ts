import { expect, test } from "@playwright/test";
import { openAccountMenu, signup, waitForHydrated } from "../fixtures";

const PT_BR_HTML = /<html[^>]*lang="pt-BR"/;
const IDENTITY_COOKIE = "quitto_identity";

test("o shell aparece na hora mesmo com a API lenta (sem bloquear no cliente)", async ({
  page,
}, testInfo) => {
  await signup(page);
  // From now on every browser→API call takes 4s: only the SSR can make the shell appear fast.
  await page.route("**/api/**", async (route) => {
    await new Promise((r) => setTimeout(r, 4000));
    await route.continue();
  });
  const started = Date.now();
  await page.goto("/contracts", { waitUntil: "commit" });
  await expect(
    page
      .getByRole("navigation", { name: "Navegação principal" })
      .filter({ visible: true })
  ).toBeVisible({ timeout: 2500 });
  // The desktop sidebar shows the name; the mobile top bar only the avatar initials.
  const identity = testInfo.project.name === "mobile" ? "UE" : "Usuário E2E";
  await expect(
    page
      .getByRole("button", { name: "Conta" })
      .filter({ visible: true })
      .getByText(identity)
  ).toBeVisible({ timeout: 2500 });
  expect(Date.now() - started).toBeLessThan(3500);
});

test("o SSR mostra o nome a partir do cookie de identidade, sem perguntar à API", async ({
  page,
  context,
  request,
}) => {
  await signup(page);
  // One more navigation so /me loads and the client writes the identity cookie.
  await page.goto("/contracts");
  await waitForHydrated(page);
  await expect
    .poll(() =>
      context.cookies().then((cs) => cs.some((c) => c.name === IDENTITY_COOKIE))
    )
    .toBe(true);
  const cookies = await context.cookies();
  const identity = cookies.find((c) => c.name === IDENTITY_COOKIE);
  const sessionToken = cookies.find((c) => c.name.endsWith("session_token"));
  expect(sessionToken).toBeDefined();

  // The token is bogus, so /api/me would answer 401: only the identity cookie
  // can still name the user here. The request fixture is a clean client that
  // talks to the web SSR directly, so the Playwright browser never intervenes.
  const bogusToken = `${sessionToken?.name}=bogus`;

  // Control: only the bogus token. The SSR falls back to /api/me, gets 401
  // and redirects. This is what makes the next assertion meaningful.
  const withoutIdentity = await request.get("/contracts", {
    headers: { cookie: `${bogusToken}; locale=pt-BR` },
    maxRedirects: 0,
  });
  expect(withoutIdentity.status()).toBeGreaterThanOrEqual(300);
  expect(withoutIdentity.status()).toBeLessThan(400);
  expect(withoutIdentity.headers().location).toContain("/login");

  const res = await request.get("/contracts", {
    headers: {
      cookie: [
        `${IDENTITY_COOKIE}=${identity?.value}`,
        bogusToken,
        "locale=pt-BR",
      ].join("; "),
    },
    maxRedirects: 0,
  });
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toContain("Navegação principal");
  expect(html).toContain("Usuário E2E");
});

test("idioma: en-US pelo menu persiste no cookie e no SSR", async ({
  page,
  context,
}) => {
  await signup(page);
  await openAccountMenu(page);
  await page.getByRole("menuitemradio", { name: "English (US)" }).click();
  await page.waitForLoadState("load");
  await waitForHydrated(page);
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .filter({ visible: true })
  ).toBeVisible();
  await expect
    .poll(() =>
      context.cookies().then((cs) => cs.find((c) => c.name === "locale")?.value)
    )
    .toBe("en-US");

  // Cookie and account agree, so a fresh load (SSR) stays in English.
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
});

test("cookie de idioma inválido cai no pt-BR no SSR", async ({ request }) => {
  // Neither the cookie nor Accept-Language names a supported locale, so the
  // server falls back to the base locale. Signed out on purpose: a signed-in
  // account language would win over the cookie.
  const res = await request.get("/login", {
    headers: { cookie: "locale=fr", "accept-language": "de-DE" },
  });
  expect(res.ok()).toBeTruthy();
  expect(await res.text()).toMatch(PT_BR_HTML);
});

test("celular: o fim da página não fica escondido atrás da tab bar", async ({
  page,
}, testInfo) => {
  // biome-ignore lint/suspicious/noSkippedTests: runs only in the mobile project
  test.skip(testInfo.project.name !== "mobile", "só no viewport de celular");
  await signup(page);
  const tabBar = page
    .getByRole("navigation", { name: "Navegação principal" })
    .filter({ visible: true });
  await expect(tabBar).toBeVisible();
  const barBox = await tabBar.boundingBox();
  expect(barBox).not.toBeNull();
  const barHeight = barBox?.height ?? 0;
  const main = page.locator("#conteudo");

  // (a) the CSS contract: main reserves at least the bar's height at the bottom.
  const paddingBottom = await main.evaluate((el) =>
    Number.parseFloat(getComputedStyle(el).paddingBottom)
  );
  expect(paddingBottom).toBeGreaterThanOrEqual(barHeight);

  // (b) the geometry, with real overflow: a new account's page is short, so
  // append a tall spacer as main's last child. Without it the scroll would be
  // a no-op and the check would pass vacuously.
  await main.evaluate((el) => {
    const spacer = document.createElement("div");
    spacer.id = "e2e-spacer";
    spacer.style.height = "2000px";
    el.append(spacer);
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight
    )
  ).toBe(true);
  await page.evaluate(() =>
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "instant",
    })
  );
  const spacerBox = await page.locator("#e2e-spacer").boundingBox();
  const barBoxAtBottom = await tabBar.boundingBox();
  expect(spacerBox).not.toBeNull();
  expect(barBoxAtBottom).not.toBeNull();
  expect((spacerBox?.y ?? 0) + (spacerBox?.height ?? 0)).toBeLessThanOrEqual(
    barBoxAtBottom?.y ?? 0
  );
});

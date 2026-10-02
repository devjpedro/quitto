import { expect, test } from "@playwright/test";
import { openAccountMenu, signup, waitForHydrated } from "../fixtures";

const PT_BR_HTML = /<html[^>]*lang="pt-BR"/;

test("o shell aparece com o nome do usuário mesmo com a API lenta (cookie cache no SSR)", async ({
  page,
}, testInfo) => {
  // biome-ignore lint/suspicious/noSkippedTests: runtime precondition, not a disabled test
  test.skip(
    !process.env.BETTER_AUTH_SECRET,
    "precisa do BETTER_AUTH_SECRET no SSR do web"
  );
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
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const mainBox = await page.locator("#conteudo").boundingBox();
  const barBox = await tabBar.boundingBox();
  // the last pixel of real content must sit above the bar: main's bottom padding ≥ bar height
  const lastChild = page.locator("#conteudo > *").last();
  const lastBox = await lastChild.boundingBox();
  expect(mainBox && barBox && lastBox).toBeTruthy();
  expect((lastBox?.y ?? 0) + (lastBox?.height ?? 0)).toBeLessThanOrEqual(
    barBox?.y ?? 0
  );
});

import { expect, type Page, type Request, test } from "@playwright/test";
import {
  advanceDateNow,
  GREETING,
  openNotifications,
  seedContract,
  signup,
  waitForHydrated,
} from "../fixtures";

const LOGIN_URL = /\/login/;
/** The identity hint the client writes (`apps/web/src/lib/identity-cookie.ts`). */
const IDENTITY_COOKIE = "quitto_identity";

/**
 * Coleta as chamadas de server function (`/_serverFn/*`). Em produção cada uma
 * é um round-trip browser → função da Vercel → API — elas não podem acontecer
 * a cada hover/clique dentro do app.
 */
function collectServerFnCalls(page: Page): string[] {
  const calls: string[] = [];
  page.on("request", (req) => {
    if (new URL(req.url()).pathname.startsWith("/_serverFn")) {
      calls.push(req.url());
    }
  });
  return calls;
}

/** After the expected reads have answered: long enough for a repeated one (a remount, a refetch) to show. */
const REPEAT_WINDOW_MS = 1500;

/**
 * A full SSR load of `url`, and the reads the browser made from the API
 * (`GET /api/*`) for it, by path and sorted. The network, not a timer, says
 * when the expected reads are done: it waits for the answer to each one, then
 * keeps watching a short window in which a repeated or extra read would show.
 */
async function apiReadsOfSsrLoad(
  page: Page,
  url: string,
  expected: string[]
): Promise<string[]> {
  const reads: string[] = [];
  const onRequest = (req: Request) => {
    const { pathname } = new URL(req.url());
    if (req.method() === "GET" && pathname.startsWith("/api/")) {
      reads.push(pathname);
    }
  };
  page.on("request", onRequest);
  const answered = expected.map((path) =>
    page.waitForResponse(
      (res) =>
        res.request().method() === "GET" && new URL(res.url()).pathname === path
    )
  );
  await page.goto(url);
  await waitForHydrated(page);
  await Promise.all(answered);
  await page.waitForTimeout(REPEAT_WINDOW_MS);
  page.off("request", onRequest);
  return reads.toSorted();
}

test("carregamento SSR: o navegador lê só o que o SSR não trouxe, uma vez cada", async ({
  page,
}) => {
  await signup(page);
  // A returning user has the identity hint cookie. With it the SSR draws the
  // shell from the hint and never waits on the API (a cold API included), so
  // `me` is not in the payload: the layout reads /api/me once, on its first
  // mount, and that read is the session check and the full profile (locale,
  // PIX key).
  const cookies = await page.context().cookies();
  expect(cookies.map((cookie) => cookie.name)).toContain(IDENTITY_COOKIE);

  // The home streams in the HTML: no /api/home from the browser.
  const homeReads = await apiReadsOfSsrLoad(page, "/", ["/api/me"]);
  await expect(
    page.getByRole("heading", { level: 1, name: GREETING })
  ).toBeVisible();
  expect(homeReads).toEqual(["/api/me"]);

  // The contracts list has a loader: it streams in the HTML, and the browser
  // reads only what the shell asks for (the home that feeds the sidebar's counters).
  const contractsReads = await apiReadsOfSsrLoad(page, "/contracts", [
    "/api/home",
    "/api/me",
  ]);
  await expect(
    page.getByRole("heading", { level: 1, name: "Contratos" })
  ).toBeVisible();
  expect(contractsReads).toEqual(["/api/home", "/api/me"]);

  // Without the hint the SSR reads /me itself and seeds it, so the browser
  // reads nothing at all. Not an empty pass: the loads above show the reads.
  await page.context().clearCookies({ name: IDENTITY_COOKIE });
  const noHintReads = await apiReadsOfSsrLoad(page, "/", []);
  await expect(
    page.getByRole("heading", { level: 1, name: GREETING })
  ).toBeVisible();
  expect(noHintReads).toEqual([]);
});

test("hover e navegação dentro do app não chamam server functions", async ({
  page,
}) => {
  await page.clock.install();
  await signup(page);
  const { id } = await seedContract(page.request);
  const calls = collectServerFnCalls(page);
  const nav = page.locator("#app-shell nav").first();

  // hover dispara o preload por intent do router
  for (const name of ["Contratos", "Agora"]) {
    await nav.getByRole("link", { name }).hover();
  }
  await nav.getByRole("link", { name: "Contratos" }).click();
  await expect(page.getByRole("heading", { name: "Contratos" })).toBeVisible();
  // uso real: o preloadStaleTime (30s) expira e o preload reexecuta os loaders.
  // Only Date.now moves: what ages is what the router and the queries compare
  // with it. A fastForward would also fire, inside the jump, the 15 s timeout
  // of every read started meanwhile, which no real wait aborts.
  await advanceDateNow(page, 60_000);
  await page.getByRole("link", { name: "Novo contrato" }).hover();
  const row = page.locator(`a[href="/contracts/${id}"]`).first();
  await row.hover();
  await row.click();
  await expect(page).toHaveURL(new RegExp(`/contracts/${id}`));
  // The bell opens a panel in place: no route, no loader, no server function.
  await openNotifications(page);
  await page.keyboard.press("Escape");
  await nav.getByRole("link", { name: "Agora" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: GREETING })
  ).toBeVisible();

  // preload antigo (stale) reaproveitado no clique reexecuta loaders do root/_app
  for (const name of ["Contratos", "Agora"]) {
    await nav.getByRole("link", { name }).hover();
  }
  // The hover preload of the list reads it now (it has a loader): let that
  // read settle first, so the 60 s age data that is already in the cache.
  await page.waitForLoadState("networkidle");
  await advanceDateNow(page, 60_000);
  const contractsReads: string[] = [];
  page.on("request", (req) => {
    if (
      req.method() === "GET" &&
      new URL(req.url()).pathname === "/api/contracts"
    ) {
      contractsReads.push(req.url());
    }
  });
  await nav.getByRole("link", { name: "Contratos" }).click();
  await expect(page.getByRole("heading", { name: "Contratos" })).toBeVisible();
  // The 60 s did age the data: going back reads the list again, through the
  // API and never through a server function.
  await expect.poll(() => contractsReads.length).toBeGreaterThan(0);

  expect(calls).toEqual([]);
});

test("sessão perdida no meio do uso: a próxima request 401 leva ao login", async ({
  page,
}) => {
  await signup(page);
  await page.context().clearCookies();

  // navegação client-side para uma tela ainda não carregada → API responde 401
  await page
    .locator("#app-shell nav")
    .first()
    .getByRole("link", { name: "Contratos" })
    .click();
  await page.waitForURL(LOGIN_URL);
  await expect(page).toHaveURL(LOGIN_URL);
});

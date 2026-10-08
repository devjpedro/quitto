import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import type {
  APIRequestContext,
  Browser,
  Locator,
  Page,
} from "@playwright/test";
import { expect } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
export const PROOF_PDF = path.join(here, "fixtures", "comprovante.pdf");

const CREATE_ACCOUNT = /^Criar conta$/;
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

/** The "Agora" greeting for the account signup creates ("Usuário E2E"). */
export const GREETING = /^(Bom dia|Boa tarde|Boa noite), Usuário$/;

/** A 500 the way the API sends it, for page.route(...).fulfill. */
export const API_FAILURE = {
  status: 500,
  contentType: "application/json",
  body: JSON.stringify({
    error: { code: "INTERNAL", message: "falha simulada" },
  }),
};

export function randomEmail(): string {
  return `e2e-${randomUUID()}@e2e.test`;
}

/**
 * Espera o cliente hidratar. O app marca `data-hydrated` no <html> pós-hidratação;
 * clicar antes disso (numa página SSR) é no-op porque o handler ainda não anexou.
 */
export async function waitForHydrated(page: Page): Promise<void> {
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
}

/** Registra um usuário novo pela UI e espera cair no Agora. Retorna o e-mail. */
export async function signup(
  page: Page,
  email = randomEmail(),
  { skipTour = true }: { skipTour?: boolean } = {}
): Promise<string> {
  // The mode is in the URL (?mode=signup), so the form is right before hydration;
  // typing waits for it, since a controlled field filled early is lost to hydration.
  await page.goto("/login?mode=signup");
  await waitForHydrated(page);
  await page.locator("#name").fill("Usuário E2E");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("password123");
  await page.getByRole("button", { name: CREATE_ACCOUNT }).click();
  await page.waitForURL("**/"); // Agora
  await waitForHydrated(page); // Agora hidratado antes de qualquer clique
  // A conta nova abre o tour guiado: pular grava como visto e libera a tela.
  if (skipTour) {
    // Espera o PATCH que grava o "visto": uma navegação logo depois o cancelaria.
    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.request().method() === "PATCH" && res.url().endsWith("/api/me")
      ),
      page.getByRole("button", { name: "Pular o tour" }).click(),
    ]);
    await page.getByRole("dialog").waitFor({ state: "detached" });
  }
  return email;
}

/** ISO date (YYYY-MM-DD) relative to today in America/Sao_Paulo; keeps seeds from aging. */
export function isoDaysFromToday(days: number): string {
  const today = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
  today.setDate(today.getDate() + days);
  const y = today.getFullYear();
  const mo = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

/** isoDaysFromToday typed the way the date fields expect it (dd/mm/yyyy). */
export function brDaysFromToday(days: number): string {
  const [year, month, day] = isoDaysFromToday(days).split("-");
  return `${day}/${month}/${year}`;
}

/** Opens the notifications panel from the bell (mobile top bar) or the sidebar row (desktop). */
export async function openNotifications(page: Page): Promise<Locator> {
  // A click before hydration lands on the server HTML and is lost.
  await waitForHydrated(page);
  await page
    .getByRole("button", { name: "Notificações" })
    .filter({ visible: true })
    .first()
    .click();
  const panel = page.getByRole("dialog", { name: "Notificações" });
  await expect(panel).toBeVisible();
  await sheetAtRest(panel);
  return panel;
}

/**
 * The sheet slides in on a spring: wait until it rests, so axe and clicks see
 * the final frame. Radix also only takes Escape once the dialog's layer is
 * registered, a few ms after it mounts: a press in that instant is lost.
 */
export async function sheetAtRest(panel: Locator): Promise<void> {
  await expect
    .poll(() =>
      panel.evaluate((el) => {
        const transform = getComputedStyle(el).transform;
        return transform === "none" || transform === "matrix(1, 0, 0, 1, 0, 0)";
      })
    )
    .toBe(true);
}

/** The "Agora" link of the visible navigation (desktop sidebar or mobile tab bar). */
export function nowLink(page: Page): Locator {
  return page
    .locator("#app-shell nav")
    .filter({ visible: true })
    .first()
    .getByRole("link", { name: "Agora" });
}

/** axe with the WCAG 2.2 AA tags: no violation on the page as it is now. */
export async function scan(page: Page): Promise<void> {
  // A fade still running reads as low contrast (the wizard rail fades in): wait out the finite ones.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== "running" ||
          animation.effect?.getComputedTiming().iterations ===
            Number.POSITIVE_INFINITY
      )
  );
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(results.violations).toEqual([]);
}

/**
 * Moves the page's Date.now ahead without firing timers (needs
 * page.clock.install()). Unlike fastForward, a read in flight keeps its 15 s
 * timeout, which no real wait would abort.
 */
export async function advanceDateNow(page: Page, ms: number): Promise<void> {
  const now = await page.evaluate(() => Date.now());
  await page.clock.setSystemTime(now + ms);
}

/** Opens the account menu (desktop sidebar or mobile top bar — whichever is visible). */
export async function openAccountMenu(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: "Conta" })
    .filter({ visible: true })
    .first()
    .click();
}

/** Cria um usuário isolado em seu próprio contexto (cookies próprios). */
export async function newUser(
  browser: Browser
): Promise<{ page: Page; email: string; close: () => Promise<void> }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = await signup(page);
  return { page, email, close: () => context.close() };
}

interface SeedSchedule {
  firstDueDate?: string;
  installments?: { amountCents: number; dueDate: string }[];
  installmentsCount?: number;
  mode: "auto" | "custom" | "monthly";
  monthlyAmountCents?: number;
  months?: number;
  totalAmountCents?: number;
}

/** Cria um contrato via API real (cookie da sessão). Retorna { id }. */
export async function seedContract(
  request: APIRequestContext,
  opts: {
    title?: string;
    ownerRole?: "buyer" | "seller";
    requiresConfirmation?: boolean;
    schedule?: SeedSchedule;
  } = {}
): Promise<{ id: string }> {
  const res = await request.post("/api/contracts", {
    data: {
      title: opts.title ?? "Contrato E2E",
      ownerRole: opts.ownerRole ?? "buyer",
      requiresConfirmation: opts.requiresConfirmation ?? false,
      schedule:
        opts.schedule ??
        ({
          mode: "auto",
          totalAmountCents: 300_000,
          installmentsCount: 3,
          firstDueDate: isoDaysFromToday(-21),
        } satisfies SeedSchedule),
    },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as { id: string };
}

/** Lê o detalhe do contrato (parcelas, participantes) via API. */
export async function getContract(request: APIRequestContext, id: string) {
  const res = await request.get(`/api/contracts/${id}`);
  expect(res.ok()).toBeTruthy();
  return res.json();
}

/** Adiciona participante e gera convite travado por e-mail. Retorna { token, participantId }. */
export async function seedInvite(
  request: APIRequestContext,
  contractId: string,
  opts: {
    displayName: string;
    role: "buyer" | "seller" | "viewer";
    email: string;
  }
): Promise<{ token: string; participantId: string }> {
  const add = await request.post(`/api/contracts/${contractId}/participants`, {
    data: { displayName: opts.displayName, role: opts.role },
  });
  expect(add.ok()).toBeTruthy();
  const participant = (await add.json()) as { id: string };
  const inv = await request.post(
    `/api/contracts/${contractId}/participants/${participant.id}/invite`,
    { data: { email: opts.email } }
  );
  expect(inv.ok()).toBeTruthy();
  const body = (await inv.json()) as { token: string };
  return { token: body.token, participantId: participant.id };
}

/** Aceita um convite pela API (sem a tela de convite, que a Fase 3 refaz). */
export async function acceptInvite(
  request: APIRequestContext,
  token: string
): Promise<void> {
  const res = await request.post(`/api/invites/${token}/accept`);
  expect(res.ok()).toBeTruthy();
}

/** O pagador envia o comprovante de teste pela API: presign, PUT direto no storage e o registro. */
export async function uploadProofApi(
  request: APIRequestContext,
  installmentId: string
): Promise<void> {
  const presign = await request.post(
    `/api/installments/${installmentId}/proofs/presign`,
    { data: { fileName: "comprovante.pdf", mimeType: "application/pdf" } }
  );
  expect(presign.ok()).toBeTruthy();
  const { uploadUrl, objectKey } = (await presign.json()) as {
    objectKey: string;
    uploadUrl: string;
  };
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "content-type": "application/pdf" },
    body: readFileSync(PROOF_PDF),
  });
  expect(put.ok).toBeTruthy();
  const done = await request.post(`/api/installments/${installmentId}/proofs`, {
    data: {
      objectKey,
      fileName: "comprovante.pdf",
      mimeType: "application/pdf",
    },
  });
  expect(done.ok()).toBeTruthy();
}

/** Duas contas num contrato: o dono de um lado, a outra conta do outro (convite aceito pela API). */
export async function twoParties(
  browser: Browser,
  opts: {
    count: number;
    firstDueDaysFromToday: number;
    ownerRole: "buyer" | "seller";
    requiresConfirmation: boolean;
  }
) {
  const owner = await newUser(browser);
  const other = await newUser(browser);
  const { id } = await seedContract(owner.page.request, {
    title: "Moto do Rafa",
    ownerRole: opts.ownerRole,
    requiresConfirmation: opts.requiresConfirmation,
    schedule: {
      mode: "monthly",
      monthlyAmountCents: 48_000,
      months: opts.count,
      firstDueDate: isoDaysFromToday(opts.firstDueDaysFromToday),
    },
  });
  const { token } = await seedInvite(owner.page.request, id, {
    displayName: "Rafael Prado",
    role: opts.ownerRole === "buyer" ? "seller" : "buyer",
    email: other.email,
  });
  await acceptInvite(other.page.request, token);
  const detail = await getContract(owner.page.request, id);
  const installments = (
    detail.installments as { id: string; sequence: number }[]
  ).map(({ id: iid, sequence }) => ({ id: iid, sequence }));
  return { owner, other, id, installments };
}

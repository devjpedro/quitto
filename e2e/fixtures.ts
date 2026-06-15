import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { APIRequestContext, Browser, Page } from "@playwright/test";
import { expect } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
export const PROOF_PDF = path.join(here, "fixtures", "comprovante.pdf");

const SIGNUP_TOGGLE = /Alternar para criar conta/i;
const CREATE_ACCOUNT = /^Criar conta$/;

export function randomEmail(): string {
  return `e2e-${randomUUID()}@e2e.test`;
}

/** Registra um usuário novo pela UI e espera cair no dashboard. Retorna o e-mail. */
export async function signup(
  page: Page,
  email = randomEmail()
): Promise<string> {
  await page.goto("/login");
  await page.getByRole("button", { name: SIGNUP_TOGGLE }).click();
  await page.locator("#name").fill("Usuário E2E");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("password123");
  await page.getByRole("button", { name: CREATE_ACCOUNT }).click();
  await page.waitForURL("**/"); // dashboard
  return email;
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
  mode: "auto" | "custom";
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
          firstDueDate: "2026-09-10",
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

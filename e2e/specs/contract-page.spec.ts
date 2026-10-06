import { type Browser, expect, type Page, test } from "@playwright/test";
import {
  newUser,
  scan,
  seedContract,
  sheetAtRest,
  signup,
  twoParties,
  uploadProofApi,
  waitForHydrated,
} from "../fixtures";
import { collectHydrationErrors, expectNoPageScrollX } from "../home-helpers";

// Top-level regex literals (lint/performance/useTopLevelRegex).
const ROW_ACTION = /^(Cobrar|Conferir|Pagar)/;
const PEOPLE_TAB = /^Pessoas/;
const HISTORY_TAB = /^Histórico/;
const TAB_PEOPLE = /[?&]tab=people/;
const TAB_HISTORY = /[?&]tab=history/;
const IN_DAYS = /em \d+ dias/;
const BELL = /^Notificações/;
const PANEL_2 = "Parcela 2 de 4";
const MOBILE_MENU = "Exportar e ações do contrato";

type Parties = Awaited<ReturnType<typeof twoParties>>;

function idOf(parties: Parties, sequence: number): string {
  const found = parties.installments.find((i) => i.sequence === sequence);
  expect(found).toBeDefined();
  return (found as { id: string }).id;
}

/**
 * "Moto do Rafa", four installments of R$ 480,00 that the owner receives:
 * the 1st overdue, the 2nd with Rafael's proof waiting for the owner, the
 * 3rd and the 4th ahead.
 */
async function receiveWithProof(browser: Browser): Promise<Parties> {
  const parties = await twoParties(browser, {
    ownerRole: "seller",
    requiresConfirmation: true,
    firstDueDaysFromToday: -40,
    count: 4,
  });
  await uploadProofApi(parties.other.page.request, idOf(parties, 2));
  return parties;
}

async function closeBoth(parties: Parties): Promise<void> {
  await parties.owner.close();
  await parties.other.close();
}

/** The sheet of installment 2, at rest (a spring brings it in). */
async function sheetOf2(page: Page) {
  const sheet = page.getByRole("dialog", { name: PANEL_2 });
  await expect(sheet).toBeVisible();
  await sheetAtRest(sheet);
  return sheet;
}

test("o topo diz o que falta, a legenda conta cada estado e a lista não tem botão", async ({
  browser,
}) => {
  const parties = await receiveWithProof(browser);
  const { page } = parties.owner;
  try {
    await page.goto(`/contracts/${parties.id}`);
    await waitForHydrated(page);

    const hero = page.getByTestId("contract-hero");
    await expect(hero).toContainText("Falta receber");
    await expect(hero).toContainText("R$ 1.920,00");
    await expect(hero).toContainText("de R$ 1.920,00");
    await expect(hero).toContainText("1 atrasada");
    await expect(hero).toContainText("1 para conferir");
    await expect(hero).toContainText("2 a receber");

    const next = page.getByTestId("next-action-card");
    await expect(next).toContainText("Faça primeiro · atrasada");
    await expect(next).toContainText("Parcela 1");

    const list = page.getByTestId("installment-list");
    await expect(list.locator("[data-installment-row]")).toHaveCount(4);
    // Every line is a button that opens the panel; none holds an action.
    await expect(list.getByRole("button", { name: ROW_ACTION })).toHaveCount(0);
    await expect(
      page.locator(`[data-installment-row="${idOf(parties, 3)}"]`)
    ).toContainText(IN_DAYS);
  } finally {
    await closeBoth(parties);
  }
});

test("as abas ficam na URL e o voltar do navegador volta a aba", async ({
  browser,
}) => {
  const parties = await receiveWithProof(browser);
  const { page } = parties.owner;
  try {
    await page.goto(`/contracts/${parties.id}`);
    await waitForHydrated(page);

    await page.getByRole("radio", { name: PEOPLE_TAB }).click();
    await expect(page).toHaveURL(TAB_PEOPLE);
    const rafael = page
      .getByTestId("people-list")
      .locator("li")
      .filter({ hasText: "Rafael Prado" });
    await expect(rafael).toContainText("no contrato desde");

    await page.getByRole("radio", { name: HISTORY_TAB }).click();
    await expect(page).toHaveURL(TAB_HISTORY);
    await expect(page.getByTestId("history")).toContainText(
      "enviou o comprovante da parcela 2"
    );

    await page.goBack();
    await expect(page).toHaveURL(TAB_PEOPLE);
    await expect(page.getByRole("radio", { name: PEOPLE_TAB })).toBeChecked();
    await expect(rafael).toContainText("no contrato desde");
  } finally {
    await closeBoth(parties);
  }
});

test("deep link do painel por largura, sem erro de hidratação", async ({
  browser,
}, testInfo) => {
  const parties = await receiveWithProof(browser);
  const { page } = parties.owner;
  const errors = collectHydrationErrors(page);
  const url = `/contracts/${parties.id}?installment=${idOf(parties, 2)}`;
  try {
    if (testInfo.project.name === "mobile") {
      // The phone's menu waits for the hydration (useHydrated, review I5);
      // the bar sits behind the modal sheet, hence includeHidden.
      const menu = page.getByRole("button", {
        name: MOBILE_MENU,
        includeHidden: true,
      });
      await page.goto(url);
      await waitForHydrated(page);
      await sheetOf2(page);
      await expect(menu).toBeEnabled();
      // With the contract in the browser's cache the stream tends to land
      // before the hydration: the case of review I5.
      await page.reload();
      await waitForHydrated(page);
      await sheetOf2(page);
      await expect(menu).toBeEnabled();
    } else {
      await page.setViewportSize({ width: 1512, height: 860 });
      await page.goto(url);
      await waitForHydrated(page);
      await expect(page.getByTestId("installment-panel-docked")).toBeVisible();
      await expect(page.getByTestId("installment-panel-docked")).toContainText(
        PANEL_2
      );
      await expect(page.getByRole("dialog")).toHaveCount(0);

      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(url);
      await waitForHydrated(page);
      await sheetOf2(page);
    }
    expect(errors).toEqual([]);
  } finally {
    await closeBoth(parties);
  }
});

test("no celular, o bottom sheet e a barra de cima do detalhe", async ({
  browser,
}, testInfo) => {
  // biome-ignore lint/suspicious/noSkippedTests: the phone's top bar and bottom sheet exist only in the mobile project
  test.skip(testInfo.project.name !== "mobile", "só no celular");
  const parties = await receiveWithProof(browser);
  const { page } = parties.owner;
  try {
    await page.goto(`/contracts/${parties.id}`);
    await waitForHydrated(page);

    const bar = page.getByRole("banner").filter({ visible: true });
    await expect(bar.getByRole("link", { name: "Contratos" })).toBeVisible();
    await expect(bar.getByRole("button", { name: BELL })).toBeVisible();
    await expect(bar.getByRole("button", { name: MOBILE_MENU })).toBeEnabled();
    await expect(bar.getByRole("button", { name: "Buscar" })).toHaveCount(0);

    await page.locator(`[data-installment-row="${idOf(parties, 2)}"]`).click();
    const sheet = await sheetOf2(page);
    // The main action is pinned to the sheet's foot, at the screen's bottom.
    const confirm = sheet.getByRole("button", {
      name: "Confirmar recebimento",
    });
    await expect(confirm).toBeVisible();
    const viewport = page.viewportSize();
    const at = await confirm.boundingBox();
    expect(viewport).not.toBeNull();
    expect(at).not.toBeNull();
    const height = (viewport as { height: number }).height;
    const { y, height: tall } = at as { y: number; height: number };
    expect(y + tall).toBeGreaterThan(height - 72);
    expect(y + tall).toBeLessThanOrEqual(height);
    await expectNoPageScrollX(page);
  } finally {
    await closeBoth(parties);
  }
});

test("contrato de outra pessoa: 'Contrato não encontrado', e o link volta aos contratos", async ({
  browser,
  page,
}) => {
  const owner = await newUser(browser);
  try {
    const { id } = await seedContract(owner.page.request, {
      title: "Moto do Rafa",
    });
    await signup(page);
    await page.goto(`/contracts/${id}`);
    await waitForHydrated(page);
    const missing = page.getByTestId("contract-not-found");
    await expect(missing).toContainText("Contrato não encontrado");
    await missing.getByRole("link", { name: "Contratos" }).click();
    await page.waitForURL((at) => at.pathname === "/contracts");
  } finally {
    await owner.close();
  }
});

test("axe em claro e escuro, com o painel aberto", async ({ browser }) => {
  const parties = await receiveWithProof(browser);
  const { page } = parties.owner;
  const url = `/contracts/${parties.id}?installment=${idOf(parties, 2)}`;
  try {
    for (const theme of ["light", "dark"] as const) {
      await page
        .context()
        .addCookies([
          { name: "theme", value: theme, url: "http://localhost:3001" },
        ]);
      await page.goto(url);
      await waitForHydrated(page);
      await expect(
        page.locator(theme === "dark" ? "html.dark" : "html:not(.dark)")
      ).toBeVisible();
      await sheetOf2(page);
      await expect(page.getByTestId("proof-preview")).toBeVisible();
      await scan(page);
    }
  } finally {
    await closeBoth(parties);
  }
});

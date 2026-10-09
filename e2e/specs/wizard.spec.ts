import { expect, type Page, test } from "@playwright/test";
import {
  brDaysFromToday,
  getContract,
  isoDaysFromToday,
  randomEmail,
  scan,
  signup,
  waitForHydrated,
} from "../fixtures";

const SPLIT = /valor total/i;
const MONTHLY = /valor fixo/i;
const OTHER = /Adicionar a outra parte/;
const SOLO = /Só eu acompanho/;
const ADJUST = /Ajustar uma a uma/;
const CONTRACT_URL = /[/]contracts[/][0-9a-f-]{36}$/;
/** From here the preview is beside the form and step 4 shows only what it does not (decision 27). */
const STAGE_PX = 1140;

async function openWizard(page: Page) {
  await page.goto("/contracts/new");
  await waitForHydrated(page);
}

async function next(page: Page) {
  await page.getByTestId("wizard-footer").getByRole("button").last().click();
}

/**
 * The step is in place and done fading: axe measures text halfway through
 * the 160 ms fade as low contrast (the same false alarm a11y.spec.ts waits out).
 */
async function settled(page: Page, heading: string) {
  await expect(
    page.getByRole("heading", { level: 1, name: heading })
  ).toBeVisible();
  await expect(page.getByTestId("wizard-step")).toHaveCSS("opacity", "1");
}

async function about(page: Page, title = "Notebook da Renata") {
  await page.getByRole("radio", { name: "Eu recebo" }).click();
  await page.getByLabel("Nome do contrato").fill(title);
  await next(page);
}

async function split(page: Page, total = "6000,00", count = "12") {
  await page.getByRole("radio", { name: SPLIT }).click();
  await page.getByLabel("Valor total", { exact: true }).fill(total);
  await page.getByLabel("Parcelas", { exact: true }).fill(count);
  await page.getByLabel("1º vencimento").fill(brDaysFromToday(36));
}

test("valor total com a outra parte e convite: cria e abre o contrato com o toast", async ({
  page,
}) => {
  await signup(page);
  await openWizard(page);
  await about(page);
  await split(page);
  await next(page);
  const guest = randomEmail();
  await page.getByRole("radio", { name: OTHER }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Renata Campos");
  await page.getByLabel("E-mail para o convite").fill(guest);
  await page
    .getByRole("checkbox", { name: "Quero confirmar cada pagamento" })
    .click();
  await next(page);
  await expect(
    page.getByRole("heading", { name: "Confira antes de criar" })
  ).toBeVisible();
  // Step 4 by width (decision 27): beside the preview only the extras; below 1140 the whole list.
  const wide = (page.viewportSize()?.width ?? 0) >= STAGE_PX;
  await expect(
    page.getByTestId(wide ? "review-extras" : "review-full")
  ).toBeVisible();
  await expect(
    page.getByTestId(wide ? "review-full" : "review-extras")
  ).toBeHidden();
  await next(page);
  await expect(page).toHaveURL(CONTRACT_URL);
  await expect(page.getByText("Contrato criado")).toBeVisible();
  await expect(page.getByText(`Convite enviado para ${guest}.`)).toBeVisible();
  const id = page.url().split("/").at(-1) as string;
  const detail = await getContract(page.request, id);
  expect(detail.installments).toHaveLength(12);
  expect(detail.contract.requiresConfirmation).toBe(true);
});

test("valor fixo por mês, só eu: cria sem convite", async ({ page }) => {
  await signup(page);
  await openWizard(page);
  await about(page, "Aluguel da sala");
  await page.getByRole("radio", { name: MONTHLY }).click();
  await page.getByLabel("Valor por mês").fill("1250,00");
  await page.getByLabel("Meses", { exact: true }).fill("12");
  await page.getByLabel("1º vencimento").fill(brDaysFromToday(20));
  await next(page);
  await page.getByRole("radio", { name: SOLO }).click();
  await next(page);
  await next(page);
  await expect(page).toHaveURL(CONTRACT_URL);
  await expect(page.getByText("Contrato criado")).toBeVisible();
  await expect(page.getByText("Convite enviado")).toHaveCount(0);
});

test("uma a uma: a soma que passa vira o total, sem bloquear, e cria", async ({
  page,
}) => {
  await signup(page);
  await openWizard(page);
  await about(page);
  await split(page);
  await page.getByRole("button", { name: ADJUST }).click();
  await page.getByLabel("Valor da parcela 1", { exact: true }).fill("1600,00");
  await page.getByLabel("Valor da parcela 1", { exact: true }).blur();
  await expect(page.getByText("Total agora · soma das 12")).toBeVisible();
  await expect(page.locator("s")).toHaveText("R$ 6.000,00");
  await next(page);
  await next(page);
  await next(page);
  await expect(page).toHaveURL(CONTRACT_URL);
  const id = page.url().split("/").at(-1) as string;
  const detail = await getContract(page.request, id);
  expect(detail.installments[0].amountCents).toBe(160_000);
  expect(detail.installments[1].amountCents).toBe(50_000);
  expect(
    detail.installments.reduce(
      (sum: number, row: { amountCents: number }) => sum + row.amountCents,
      0
    )
  ).toBe(710_000);
});

test("uma a uma: 'Manter R$ 6.000,00' tira das outras e cria com o total combinado", async ({
  page,
}) => {
  await signup(page);
  await openWizard(page);
  await about(page);
  await split(page);
  await page.getByRole("button", { name: ADJUST }).click();
  await page.getByLabel("Valor da parcela 1", { exact: true }).fill("1600,00");
  await page.getByLabel("Valor da parcela 1", { exact: true }).blur();
  await page.getByRole("button", { name: "Manter R$ 6.000,00" }).click();
  await expect(page.getByText("Soma das 12 parcelas")).toBeVisible();
  await next(page);
  await next(page);
  await next(page);
  await next(page);
  await expect(page).toHaveURL(CONTRACT_URL);
  const id = page.url().split("/").at(-1) as string;
  const detail = await getContract(page.request, id);
  expect(detail.installments[0].amountCents).toBe(160_000);
  expect(detail.installments[1].amountCents).toBe(40_000);
});

test("a data do 1º vencimento se escolhe no calendário", async ({ page }) => {
  await signup(page);
  await openWizard(page);
  await about(page);
  await page.getByRole("radio", { name: SPLIT }).click();
  await page.getByRole("button", { name: "Abrir o calendário" }).click();
  await expect(page.getByRole("grid")).toBeVisible();
  await page.getByRole("button", { name: "Hoje", exact: true }).click();
  await expect(page.getByRole("grid")).toHaveCount(0);
  await expect(page.getByLabel("1º vencimento")).toHaveValue(
    brDaysFromToday(0)
  );
});

test("passo 1 vazio: as frases do produto e nada avança", async ({ page }) => {
  await signup(page);
  await openWizard(page);
  await next(page);
  await expect(page.getByText("Escolha se você paga ou recebe.")).toBeVisible();
  await expect(
    page.getByText("Dê um nome ao contrato, como “Notebook da Renata”.")
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Nesse acordo, você paga ou recebe?" })
  ).toBeVisible();
});

test("o ✕ com algo preenchido pergunta; 'Continuar editando' fica", async ({
  page,
}) => {
  await signup(page);
  await openWizard(page);
  await page.getByLabel("Nome do contrato").fill("Moto");
  await page.getByRole("button", { name: "Fechar" }).click();
  const dialog = page.getByRole("dialog", { name: "Descartar este contrato?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Continuar editando" }).click();
  await expect(page.getByLabel("Nome do contrato")).toHaveValue("Moto");
});

test("a11y do wizard em claro e escuro: passos 1, 2 com erro, uma a uma e 4", async ({
  page,
}) => {
  await signup(page);
  for (const theme of ["light", "dark"] as const) {
    await page
      .context()
      .addCookies([{ name: "theme", value: theme, url: page.url() }]);
    await openWizard(page);
    await scan(page);
    await about(page);
    await page.getByRole("radio", { name: SPLIT }).click();
    await page.getByLabel("Valor total", { exact: true }).fill("0");
    await next(page);
    await settled(page, "Como o pagamento foi combinado?");
    await scan(page);
    await split(page);
    await page.getByRole("button", { name: ADJUST }).click();
    await settled(page, "Ajustar uma a uma");
    await scan(page);
    await next(page);
    await next(page);
    await settled(page, "Confira antes de criar");
    await scan(page);
  }
});

test("celular: nada transborda e a barra de ação fica à vista", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signup(page);
  await openWizard(page);
  await about(page);
  await split(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  expect(overflow).toBe(false);
  await expect(
    page.getByTestId("wizard-footer").getByRole("button")
  ).toBeInViewport();
});

test("celular: no uma a uma, a última parcela rola para cima da barra", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signup(page);
  await openWizard(page);
  await about(page);
  await split(page);
  await page.getByRole("button", { name: ADJUST }).click();
  await page.getByLabel("Valor da parcela 1", { exact: true }).fill("1600,00");
  await page.getByLabel("Valor da parcela 1", { exact: true }).blur();
  // The total moved: the bar is at its tallest (the new total, "era" and "Manter").
  await expect(page.getByText("Total agora · soma das 12")).toBeVisible();
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight)
  );
  const last = await page
    .getByLabel("Valor da parcela 12", { exact: true })
    .boundingBox();
  const bar = await page.getByTestId("wizard-footer").boundingBox();
  expect(last).not.toBeNull();
  expect(bar).not.toBeNull();
  expect((last?.y ?? 0) + (last?.height ?? 0)).toBeLessThanOrEqual(bar?.y ?? 0);
});

for (const height of [844, 664]) {
  test(`celular ${height}: o último campo rola inteiro 16 px acima da barra, e o campo focado não fica atrás do resumo nem da barra`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height });
    await signup(page);
    await openWizard(page);
    const description = page.getByLabel("Descrição opcional");
    await page.getByLabel("Nome do contrato").fill("Notebook da Renata");
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight)
    );
    const bar = await page.getByTestId("wizard-footer").boundingBox();
    const last = await description.boundingBox();
    expect((last?.y ?? 0) + (last?.height ?? 0) + 16).toBeLessThanOrEqual(
      (bar?.y ?? 0) + 1
    );
    // A focused field goes between the held summary and the bar.
    await page.evaluate(() => window.scrollTo(0, 0));
    await description.focus();
    await page.waitForTimeout(400);
    const summary = await page.getByTestId("wizard-summary").boundingBox();
    const field = await description.boundingBox();
    const barNow = await page.getByTestId("wizard-footer").boundingBox();
    expect(field?.y ?? 0).toBeGreaterThanOrEqual(
      (summary?.y ?? 0) + (summary?.height ?? 0)
    );
    expect((field?.y ?? 0) + (field?.height ?? 0)).toBeLessThanOrEqual(
      barNow?.y ?? 0
    );
  });
}

test("passo 3: a sugestão preenche o nome da pessoa de outro contrato", async ({
  page,
}) => {
  await signup(page);
  const guest = randomEmail();
  const created = await page.request.post("/api/contracts", {
    data: {
      title: "Moto do Rafa",
      ownerRole: "seller",
      requiresConfirmation: false,
      counterparty: { name: "Rafael Prado", email: guest },
      schedule: {
        mode: "auto",
        totalAmountCents: 120_000,
        installmentsCount: 3,
        firstDueDate: isoDaysFromToday(10),
      },
    },
  });
  expect(created.ok()).toBeTruthy();

  await openWizard(page);
  await about(page);
  await split(page);
  await next(page);
  await page.getByRole("radio", { name: OTHER }).click();
  const suggestions = page.getByTestId("party-suggestions");
  await expect(suggestions).toBeVisible();
  await suggestions.getByRole("button", { name: "Usar Rafael Prado" }).click();
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue(
    "Rafael Prado"
  );
  await expect(page.getByLabel("E-mail para o convite")).toHaveValue(guest);
  // The name now is the suggestion's: the line has nothing left to offer.
  await expect(suggestions).toHaveCount(0);
});

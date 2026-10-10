import { expect, type Page, test } from "@playwright/test";
import {
  brDaysFromToday,
  getContract,
  isoDaysFromToday,
  signup,
  waitForHydrated,
} from "../fixtures";

const SPLIT = /valor total/i;
const SOLO = /Só eu acompanho/;
const CONTRACT_URL = /[/]contracts[/][0-9a-f-]{36}$/;
const PAID_COUNT = /[0-9]+ já pagas|[0-9]+ de 6 pagas/;
const OVERDUE_WORD = /atrasad/i;
const FIRST_ROW = /^Parcela 1 de 6/;
const QUESTION = "As parcelas antes de hoje já foram pagas?";

async function next(page: Page) {
  await page.getByTestId("wizard-footer").getByRole("button").last().click();
}

test("1º vencimento três meses atrás e 'Todas': nasce com as vencidas pagas e sem atrasadas", async ({
  page,
}) => {
  await signup(page);
  await page.goto("/contracts/new");
  await waitForHydrated(page);
  await page.getByRole("radio", { name: "Eu pago" }).click();
  await page.getByLabel("Nome do contrato").fill("Acordo em andamento");
  await next(page);
  await page.getByRole("radio", { name: SPLIT }).click();
  await page.getByLabel("Valor total", { exact: true }).fill("6000,00");
  await page.getByLabel("Parcelas", { exact: true }).fill("6");
  await expect(page.getByText(QUESTION)).toHaveCount(0);
  await page.getByLabel("1º vencimento").fill(brDaysFromToday(-95));
  await expect(page.getByText(QUESTION)).toBeVisible();
  await expect(page.getByRole("radio", { name: "Todas" })).toBeChecked();
  await next(page);
  await page.getByRole("radio", { name: SOLO }).click();
  await next(page);
  // The count: in the review line below 1140, on the preview's legend beside it.
  await expect(
    page.getByText(PAID_COUNT).locator("visible=true").first()
  ).toBeVisible();
  await next(page);
  await expect(page).toHaveURL(CONTRACT_URL);

  const id = page.url().split("/").at(-1) as string;
  const detail = await getContract(page.request, id);
  const today = isoDaysFromToday(0);
  const past = detail.installments.filter(
    (row: { dueDate: string }) => row.dueDate < today
  );
  expect(past.length).toBeGreaterThanOrEqual(3);
  for (const row of past) {
    expect(row.status).toBe("paid");
    expect(row.registeredOnCreate).toBe(true);
  }
  expect(detail.progress.overdueCount).toBe(0);

  // The home shows nothing overdue from it, and the contract's list counts the paid ones.
  await expect(page.getByText(`${past.length} pagas`).first()).toBeVisible();
  await page.goto("/");
  await waitForHydrated(page);
  await expect(page.getByText(OVERDUE_WORD)).toHaveCount(0);
});

test("'Algumas': marca só as escolhidas; as outras vencidas ficam atrasadas", async ({
  page,
}) => {
  await signup(page);
  await page.goto("/contracts/new");
  await waitForHydrated(page);
  await page.getByRole("radio", { name: "Eu pago" }).click();
  await page.getByLabel("Nome do contrato").fill("Acordo em andamento");
  await next(page);
  await page.getByRole("radio", { name: SPLIT }).click();
  await page.getByLabel("Valor total", { exact: true }).fill("6000,00");
  await page.getByLabel("Parcelas", { exact: true }).fill("6");
  await page.getByLabel("1º vencimento").fill(brDaysFromToday(-95));
  await page.getByRole("radio", { name: "Algumas" }).click();
  await page.getByRole("checkbox", { name: FIRST_ROW }).click();
  await next(page);
  await page.getByRole("radio", { name: SOLO }).click();
  await next(page);
  await next(page);
  await expect(page).toHaveURL(CONTRACT_URL);
  const id = page.url().split("/").at(-1) as string;
  const detail = await getContract(page.request, id);
  const [first, second] = detail.installments;
  expect(first.status).toBe("paid");
  expect(second.status).toBe("pending");
  expect(detail.progress.overdueCount).toBeGreaterThanOrEqual(2);
});

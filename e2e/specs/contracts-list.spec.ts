import { expect, test } from "@playwright/test";
import {
  getContract,
  isoDaysFromToday,
  scan,
  seedContract,
  signup,
  waitForHydrated,
} from "../fixtures";
import { expectNoPageScrollX } from "../home-helpers";

const DONE_SEGMENT = /^Concluídos/;
const ACTIVE_SEGMENT = /^Ativos/;
const SHOW_DONE = /show=done/;
const SIDE_RECEIVE = /side=receive/;

const ONE_INSTALLMENT = (daysFromToday: number, amountCents: number) => ({
  mode: "custom" as const,
  installments: [{ amountCents, dueDate: isoDaysFromToday(daysFromToday) }],
});

/** Three contracts: one you pay with an overdue installment, one you receive on time, one paid off. */
async function seedThree(page: import("@playwright/test").Page) {
  const overdue = await seedContract(page.request, {
    title: "Aluguel da sala",
    ownerRole: "buyer",
    schedule: ONE_INSTALLMENT(-12, 180_000),
  });
  const receive = await seedContract(page.request, {
    title: "Notebook da Marina",
    ownerRole: "seller",
    schedule: ONE_INSTALLMENT(20, 350_000),
  });
  const done = await seedContract(page.request, {
    title: "Geladeira do Carlos",
    ownerRole: "buyer",
    schedule: ONE_INSTALLMENT(-40, 120_000),
  });
  const detail = await getContract(page.request, done.id);
  const paid = await page.request.post(
    `/api/installments/${detail.installments[0].id}/mark-paid`
  );
  expect(paid.ok()).toBeTruthy();
  return { overdue, receive, done };
}

test("lista: o cartão com o %, a barra e o rodapé; Concluídos e Recebo filtram", async ({
  page,
}) => {
  await signup(page);
  const ids = await seedThree(page);
  await page.goto("/contracts");
  await waitForHydrated(page);

  const overdueCard = page.getByTestId(`contract-card-${ids.overdue.id}`);
  await expect(overdueCard).toContainText("Aluguel da sala");
  await expect(overdueCard).toContainText("Atrasada");
  await expect(overdueCard).toContainText("desde");
  await expect(overdueCard).toContainText("Você paga");
  const receiveCard = page.getByTestId(`contract-card-${ids.receive.id}`);
  await expect(receiveCard).toContainText("Em dia");
  await expect(page.getByTestId(`contract-card-${ids.done.id}`)).toHaveCount(0);

  await page.getByRole("radio", { name: DONE_SEGMENT }).click();
  await expect(page).toHaveURL(SHOW_DONE);
  const doneCard = page.getByTestId(`contract-card-${ids.done.id}`);
  await expect(doneCard).toContainText("Quitado");
  await expect(overdueCard).toHaveCount(0);

  await page.getByRole("radio", { name: ACTIVE_SEGMENT }).click();
  await page.getByRole("radio", { name: "Recebo" }).click();
  await expect(page).toHaveURL(SIDE_RECEIVE);
  await expect(receiveCard).toBeVisible();
  await expect(overdueCard).toHaveCount(0);
});

test("vazio: o palco sem cartão fantasma, Novo contrato e o tour", async ({
  page,
}) => {
  await signup(page);
  await page.goto("/contracts");
  await waitForHydrated(page);
  const empty = page.getByTestId("contracts-empty");
  await expect(empty).toContainText("Nenhum contrato ainda");
  await expect(
    empty.getByRole("link", { name: "Novo contrato" })
  ).toBeVisible();
  await expect(
    empty.getByRole("button", { name: "Fazer o tour" })
  ).toBeVisible();
});

test("celular: nada transborda", async ({ page }, testInfo) => {
  // biome-ignore lint/suspicious/noSkippedTests: nada transborda só importa no celular
  test.skip(testInfo.project.name !== "mobile", "só no projeto mobile");
  await signup(page);
  await seedThree(page);
  await page.goto("/contracts");
  await waitForHydrated(page);
  await expect(page.getByTestId("contracts-toolbar")).toBeVisible();
  await expectNoPageScrollX(page);
});

test("axe em claro e escuro", async ({ page, context }) => {
  await signup(page);
  await seedThree(page);
  await page.goto("/contracts");
  await waitForHydrated(page);
  await expect(page.getByTestId("contracts-toolbar")).toBeVisible();
  await scan(page);

  await context.addCookies([
    { name: "theme", value: "dark", url: "http://localhost:3001" },
  ]);
  await page.goto("/contracts");
  await expect(page.locator("html.dark")).toBeVisible();
  await expect(page.getByTestId("contracts-toolbar")).toBeVisible();
  await scan(page);
});

import { expect, type Page, test } from "@playwright/test";
import {
  isoDaysFromToday,
  scan,
  seedContract,
  sheetAtRest,
  signup,
  waitForHydrated,
} from "../fixtures";
import { expectNoPageScrollX } from "../home-helpers";

const ANY_INSTALLMENT = /[?&]installment=/;
const MONTH_PARAM = /[?&]month=/;
const AGO_10 = /há 10 dias/;

interface Ids {
  overdue: string;
  third: string;
  thirdInNextMonth: boolean;
  today: string;
}

function oneInstallment(daysFromToday: number, amountCents: number) {
  return {
    mode: "custom" as const,
    installments: [{ amountCents, dueDate: isoDaysFromToday(daysFromToday) }],
  };
}

/** Days left in the current month, counting from today. */
function daysLeftInMonth(): number {
  const today = isoDaysFromToday(0);
  const [year, month] = today.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return last - Number(today.slice(8, 10));
}

/** Overdue 10 days, due today, and a third one that is "later this month" when there is room for it. */
async function seedGroups(page: Page): Promise<Ids> {
  const overdue = await seedContract(page.request, {
    title: "Aluguel da sala",
    ownerRole: "buyer",
    schedule: oneInstallment(-10, 180_000),
  });
  const today = await seedContract(page.request, {
    title: "Empréstimo do Carlos",
    ownerRole: "buyer",
    schedule: oneInstallment(0, 50_000),
  });
  const left = daysLeftInMonth();
  const thirdInNextMonth = left < 7;
  const third = await seedContract(page.request, {
    title: "Celular da Ana",
    ownerRole: "seller",
    schedule: oneInstallment(thirdInNextMonth ? 20 : left, 32_000),
  });
  return {
    overdue: overdue.id,
    today: today.id,
    third: third.id,
    thirdInNextMonth,
  };
}

async function openParcelas(page: Page, query = "") {
  await page.goto(`/installments${query}`);
  await waitForHydrated(page);
  await expect(page.getByTestId("installments-month")).toBeVisible();
}

test("grupos: Atrasadas, Esta semana e Ainda em <mês>, com as somas", async ({
  page,
}) => {
  await signup(page);
  const ids = await seedGroups(page);
  await openParcelas(page);

  const overdue = page.getByTestId("installments-group-overdue");
  await expect(overdue).toContainText("Aluguel da sala");
  await expect(overdue).toContainText("R$ 1.800,00");
  await expect(overdue).toContainText(AGO_10);
  const week = page.getByTestId("installments-group-week");
  await expect(week).toContainText("Empréstimo do Carlos");
  await expect(week).toContainText("Vence hoje");

  if (ids.thirdInNextMonth) {
    await page.getByRole("button", { name: "Próximo mês" }).click();
    await expect(page.getByTestId("installments-group-month")).toContainText(
      "Celular da Ana"
    );
  } else {
    const rest = page.getByTestId("installments-group-month");
    await expect(rest).toContainText("Celular da Ana");
    await expect(rest).toContainText("+ R$ 320,00");
  }
});

test("tocar abre o painel; Esc fecha e devolve o foco à linha", async ({
  page,
}, testInfo) => {
  await signup(page);
  const ids = await seedGroups(page);
  await openParcelas(page);
  const row = page.locator("[data-installment-row]").filter({
    hasText: "Aluguel da sala",
  });
  await row.click();
  await expect(page).toHaveURL(ANY_INSTALLMENT);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await sheetAtRest(dialog);
  if (testInfo.project.name === "mobile") {
    await dialog.getByRole("button", { name: "Fechar" }).click();
  } else {
    await page.keyboard.press("Escape");
  }
  await expect(dialog).toBeHidden();
  await expect(row).toBeFocused();
  expect(ids.overdue).toBeTruthy();
});

test("marcar como recebida tira a linha das Atrasadas", async ({ page }) => {
  await signup(page);
  const receive = await seedContract(page.request, {
    title: "Notebook da Marina",
    ownerRole: "seller",
    schedule: oneInstallment(-10, 70_000),
  });
  expect(receive.id).toBeTruthy();
  await openParcelas(page);
  const overdue = page.getByTestId("installments-group-overdue");
  await overdue.getByText("Notebook da Marina").click();
  const dialog = page.getByRole("dialog");
  await sheetAtRest(dialog);
  await dialog.getByRole("button", { name: "Marcar como recebida" }).click();
  await expect(page.getByTestId("installments-group-overdue")).toHaveCount(0);
  const sameMonth =
    isoDaysFromToday(-10).slice(0, 7) === isoDaysFromToday(0).slice(0, 7);
  if (sameMonth) {
    await expect(page.getByTestId("installments-group-paid")).toContainText(
      "Notebook da Marina"
    );
  }
});

test("‹ › trocam o mês e Este mês volta", async ({ page }) => {
  await signup(page);
  await seedGroups(page);
  await openParcelas(page);
  await expect(page.getByRole("button", { name: "Este mês" })).toHaveCount(0);
  await page.getByRole("button", { name: "Próximo mês" }).click();
  await expect(page).toHaveURL(MONTH_PARAM);
  await page.getByRole("button", { name: "Este mês" }).click();
  await expect(page.getByRole("button", { name: "Este mês" })).toHaveCount(0);
  await expect(page.getByTestId("installments-group-overdue")).toBeVisible();
});

test("calendário: escolher o dia e abrir a parcela dele", async ({ page }) => {
  await signup(page);
  await seedGroups(page);
  await openParcelas(page, "?view=calendar");
  const todayIso = isoDaysFromToday(0);
  await page.getByTestId(`calendar-day-${todayIso}`).click();
  const list = page.getByTestId("installments-day");
  await expect(list).toContainText("Empréstimo do Carlos");
  await list.getByText("Empréstimo do Carlos").click();
  await expect(page).toHaveURL(ANY_INSTALLMENT);
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("celular: nada transborda (lista e calendário)", async ({
  page,
}, testInfo) => {
  // biome-ignore lint/suspicious/noSkippedTests: nada transborda só importa no celular
  test.skip(testInfo.project.name !== "mobile", "só no projeto mobile");
  await signup(page);
  await seedGroups(page);
  await openParcelas(page);
  await expectNoPageScrollX(page);
  await openParcelas(page, "?view=calendar");
  await expect(page.getByTestId("installments-calendar")).toBeVisible();
  await expectNoPageScrollX(page);
});

test("axe em claro e escuro (lista e calendário)", async ({
  page,
  context,
}) => {
  await signup(page);
  await seedGroups(page);
  await openParcelas(page);
  await scan(page);
  await openParcelas(page, "?view=calendar");
  await expect(page.getByTestId("installments-calendar")).toBeVisible();
  await scan(page);

  await context.addCookies([
    { name: "theme", value: "dark", url: "http://localhost:3001" },
  ]);
  await openParcelas(page);
  await expect(page.locator("html.dark")).toBeVisible();
  await scan(page);
  await openParcelas(page, "?view=calendar");
  await expect(page.getByTestId("installments-calendar")).toBeVisible();
  await scan(page);
});

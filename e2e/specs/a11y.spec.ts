import { expect, test } from "@playwright/test";
import {
  brDaysFromToday,
  isoDaysFromToday,
  openNotifications,
  scan,
  seedContract,
  signup,
  waitForHydrated,
} from "../fixtures";

test("login não tem violações de a11y", async ({ page }) => {
  await page.goto("/login");
  await scan(page);
});

test("rotas autenticadas não têm violações de a11y", async ({ page }) => {
  await signup(page);
  await scan(page); // Agora vazio

  const { id } = await seedContract(page.request);
  await page.goto("/contracts");
  await scan(page);
  await page.goto("/contracts/new");
  await scan(page);
  await page.goto(`/contracts/${id}`);
  await scan(page);

  await page.goto("/");
  await openNotifications(page);
  await scan(page);
  await page.keyboard.press("Escape");
  await page.goto("/settings");
  await scan(page);
  await page.goto("/"); // Agora com contrato
  await scan(page);
});

test("modo mensal (wizard + detalhe) não tem violações de a11y", async ({
  page,
}) => {
  await signup(page);

  // passo mensal do wizard
  await page.goto("/contracts/new");
  await waitForHydrated(page);
  await page.locator("#title").fill("Mensal A11y");
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.getByRole("button", { name: "Mensal" }).click();
  await page.locator("#monthly-amount").fill("800,00");
  await page.locator("#months").fill("12");
  await page.locator("#monthly-first").fill(brDaysFromToday(10));
  await scan(page);

  // detalhe com o selo da intenção
  const { id } = await seedContract(page.request, {
    title: "Mensal A11y Detalhe",
    schedule: {
      mode: "monthly",
      monthlyAmountCents: 80_000,
      months: 12,
      firstDueDate: isoDaysFromToday(-21),
    },
  });
  await page.goto(`/contracts/${id}`);
  await scan(page);
});

test("dark mode não tem violações de a11y", async ({ page, context }) => {
  await context.addCookies([
    { name: "theme", value: "dark", url: "http://localhost:3001" },
  ]);

  await page.goto("/login");
  await expect(page.locator("html.dark")).toBeVisible();
  await scan(page);

  await signup(page);
  await expect(page.locator("html.dark")).toBeVisible();
  await scan(page); // Agora vazio

  const { id } = await seedContract(page.request);
  await page.goto(`/contracts/${id}`);
  await scan(page);

  const monthly = await seedContract(page.request, {
    title: "Mensal Dark",
    schedule: {
      mode: "monthly",
      monthlyAmountCents: 80_000,
      months: 12,
      firstDueDate: isoDaysFromToday(-21),
    },
  });
  await page.goto(`/contracts/${monthly.id}`);
  await expect(page.locator("html.dark")).toBeVisible();
  await scan(page);
});

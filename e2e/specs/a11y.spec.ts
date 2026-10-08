import { expect, test } from "@playwright/test";
import {
  isoDaysFromToday,
  openNotifications,
  scan,
  seedContract,
  signup,
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
  await page.goto("/installments");
  await scan(page);
  await page.goto("/people");
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

test("detalhe do contrato mensal não tem violações de a11y", async ({
  page,
}) => {
  await signup(page);

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

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import {
  getContract,
  seedContract,
  signup,
  waitForHydrated,
} from "../fixtures";

const TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

async function scan(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations).toEqual([]);
}

test("login não tem violações de a11y", async ({ page }) => {
  await page.goto("/login");
  await scan(page);
});

test("rotas autenticadas não têm violações de a11y", async ({ page }) => {
  await signup(page);
  await scan(page); // dashboard vazio

  const { id } = await seedContract(page.request);
  await page.goto("/contracts");
  await scan(page);
  await page.goto("/contracts/new");
  await scan(page);
  await page.goto(`/contracts/${id}`);
  await scan(page);

  // drawer da parcela aberto
  const detail = await getContract(page.request, id);
  await page.goto(`/contracts/${id}?installment=${detail.installments[0].id}`);
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  // O drawer abre com fade/slide-in (tw-animate-css). Sem esperar a animação
  // terminar, o axe às vezes escaneia um frame intermediário: nesse instante,
  // texto e fundo estão ambos com opacidade parcial em relação ao body, o que
  // "esbate" a cor e derruba artificialmente o contraste medido — falso
  // positivo de color-contrast que não reflete o estado final renderizado.
  await drawer.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished))
  );
  await scan(page);

  await page.goto("/notifications");
  await scan(page);
  await page.goto("/settings");
  await scan(page);
  await page.goto("/"); // dashboard com contrato
  await scan(page);

  // PixBlock (QR + copia-e-cola) só renderiza com contrato seller + chave
  // resolvida; os scans acima usam contrato buyer sem chave, então o bloco
  // nunca aparece neles. Define a chave via API (rápido) e abre a gaveta.
  await page.request.patch("/api/me", { data: { pixKey: "joao@example.com" } });
  const pixContract = await seedContract(page.request, {
    ownerRole: "seller",
    title: "PIX A11y",
  });
  const pixDetail = await getContract(page.request, pixContract.id);
  await page.goto(
    `/contracts/${pixContract.id}?installment=${pixDetail.installments[0].id}`
  );
  const pixDrawer = page.getByRole("dialog");
  await expect(pixDrawer).toBeVisible();
  await pixDrawer.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished))
  );
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
  await page.locator("#monthly-first").fill("10/09/2026");
  await scan(page);

  // detalhe com o selo da intenção
  const { id } = await seedContract(page.request, {
    title: "Mensal A11y Detalhe",
    schedule: {
      mode: "monthly",
      monthlyAmountCents: 80_000,
      months: 12,
      firstDueDate: "2026-09-10",
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
  await scan(page); // dashboard vazio

  const { id } = await seedContract(page.request);
  await page.goto(`/contracts/${id}`);
  await scan(page);

  // drawer da parcela aberto
  const detail = await getContract(page.request, id);
  await page.goto(`/contracts/${id}?installment=${detail.installments[0].id}`);
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  // mesmo cuidado do bloco light: espera a animação de entrada terminar antes
  // de escanear, senão o axe pega um frame com opacidade parcial e reporta um
  // color-contrast falso-positivo.
  await drawer.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished))
  );
  await scan(page);

  const monthly = await seedContract(page.request, {
    title: "Mensal Dark",
    schedule: {
      mode: "monthly",
      monthlyAmountCents: 80_000,
      months: 12,
      firstDueDate: "2026-09-10",
    },
  });
  await page.goto(`/contracts/${monthly.id}`);
  await expect(page.locator("html.dark")).toBeVisible();
  await scan(page);

  // PixBlock (QR + copia-e-cola) em dark: contrato seller + chave via API.
  await page.request.patch("/api/me", { data: { pixKey: "joao@example.com" } });
  const pixContract = await seedContract(page.request, {
    ownerRole: "seller",
    title: "PIX A11y Dark",
  });
  const pixDetail = await getContract(page.request, pixContract.id);
  await page.goto(
    `/contracts/${pixContract.id}?installment=${pixDetail.installments[0].id}`
  );
  const pixDrawer = page.getByRole("dialog");
  await expect(pixDrawer).toBeVisible();
  await expect(page.locator("html.dark")).toBeVisible();
  await pixDrawer.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished))
  );
  await scan(page);
});

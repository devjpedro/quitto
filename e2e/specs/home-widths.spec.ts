import { expect, test } from "@playwright/test";
import { signup, waitForHydrated } from "../fixtures";
import {
  box,
  card,
  expectNoPageScrollX,
  seedOneEach,
  seedWide,
} from "../home-helpers";

test("muitas ações: carrossel com 1 de N no celular e Ver todas no desktop", async ({
  page,
}, testInfo) => {
  await signup(page);
  await seedOneEach(page.request, "Muitas E2E", [-40, -30, -20, -10, -5]);
  await page.goto("/");
  // A click before hydration lands on the server HTML and is lost.
  await waitForHydrated(page);
  await expect(card(page, "Muitas E2E 1 · parcela 1 de 1")).toBeVisible();
  if (testInfo.project.name === "mobile") {
    await expect(page.getByText("1 de 5")).toBeVisible();
    // the next card peeks at the edge, the last one is off screen
    await expect(card(page, "Muitas E2E 2 · parcela 1 de 1")).toBeInViewport();
    await expect(
      card(page, "Muitas E2E 5 · parcela 1 de 1")
    ).not.toBeInViewport();
    await expectNoPageScrollX(page);
    // keyboard reaches every card: focusing a button in an off-screen card scrolls it in
    await card(page, "Muitas E2E 5 · parcela 1 de 1")
      .getByRole("button", { name: "Já paguei" })
      .focus();
    await expect(card(page, "Muitas E2E 5 · parcela 1 de 1")).toBeInViewport();
    await page.getByRole("button", { name: "Ver todas", exact: true }).click();
    const last = card(page, "Muitas E2E 5 · parcela 1 de 1");
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    await expect(page.getByText("1 de 5")).toHaveCount(0);
    await expectNoPageScrollX(page);
  } else {
    await expect(card(page, "Muitas E2E 4 · parcela 1 de 1")).toBeHidden();
    await page.getByRole("button", { name: "Ver todas", exact: true }).click();
    await expect(card(page, "Muitas E2E 4 · parcela 1 de 1")).toBeVisible();
    await expect(card(page, "Muitas E2E 5 · parcela 1 de 1")).toBeVisible();
  }
});

test.describe("tablet a 800 px", () => {
  test.use({ viewport: { width: 800, height: 1000 } });

  test("o carrossel de 5 ações ao lado da sidebar não faz a página rolar de lado", async ({
    page,
  }, testInfo) => {
    // biome-ignore lint/suspicious/noSkippedTests: the mobile project has its own viewport
    test.skip(
      testInfo.project.name === "mobile",
      "o projeto mobile tem viewport própria"
    );
    await signup(page);
    await seedOneEach(page.request, "Tablet E2E", [-40, -30, -20, -10, -5]);
    await page.goto("/");
    await waitForHydrated(page);
    // Below lg it is still the carousel, now beside the sidebar.
    await expect(card(page, "Tablet E2E 1 · parcela 1 de 1")).toBeVisible();
    await expect(page.getByText("1 de 5")).toBeVisible();
    await expectNoPageScrollX(page);
  });
});

test.describe("desktop a 1024 px", () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test("a grade de 3 cartões cabe no painel ao lado da sidebar", async ({
    page,
  }, testInfo) => {
    // biome-ignore lint/suspicious/noSkippedTests: the mobile project has its own viewport
    test.skip(
      testInfo.project.name === "mobile",
      "o projeto mobile tem viewport própria"
    );
    await signup(page);
    await seedOneEach(page.request, "Grade E2E", [-30, -20, -10]);
    await page.goto("/");
    for (const n of [1, 2, 3]) {
      await expect(
        card(page, `Grade E2E ${n} · parcela 1 de 1`)
      ).toBeInViewport();
    }
    // From lg the cards are a grid: no carousel counter, nothing past the panel's edge.
    await expect(page.getByText("1 de 3")).toBeHidden();
    const overflows = await page
      .locator("#conteudo")
      .evaluate((main) => main.scrollWidth > main.clientWidth);
    expect(overflows).toBe(false);
  });
});

for (const { width, perRow } of [
  { width: 1440, perRow: 3 },
  { width: 1660, perRow: 4 },
  { width: 1920, perRow: 5 },
  { width: 2560, perRow: 5 },
]) {
  test.describe(`tela larga a ${width} px`, () => {
    test.use({ viewport: { width, height: 1000 } });

    test("a moldura acompanha a tela, a sidebar tem 232 px e as ações crescem por colunas", async ({
      page,
    }, testInfo) => {
      // biome-ignore lint/suspicious/noSkippedTests: the mobile project has its own viewport
      test.skip(
        testInfo.project.name === "mobile",
        "o projeto mobile tem viewport própria"
      );
      await seedWide(page, { withNotice: true });
      // Structure B: the sidebar on the canvas at the left edge, the panel up to 12 px from the right edge.
      const sidebar = await box(page.getByRole("complementary"));
      expect(sidebar.x).toBe(0);
      expect(sidebar.width).toBe(232);
      const viewportWidth = await page.evaluate(
        () => document.documentElement.clientWidth
      );
      const main = await box(page.locator("#conteudo"));
      expect(main.x).toBeCloseTo(232, 0);
      expect(main.x + main.width).toBeCloseTo(viewportWidth - 12, 0);
      // One row of cards, never wider ones: 3 up to 1535, 4 up to 1839, 5 from 1840.
      const row = page.getByRole("article").filter({ visible: true });
      await expect(row).toHaveCount(perRow);
      const tops = await row.evaluateAll((cards) =>
        cards.map((el) => Math.round(el.getBoundingClientRect().top))
      );
      expect(new Set(tops).size).toBe(1);
      await expect(
        page
          .getByRole("button", { name: "Ver todas", exact: true })
          .filter({ visible: true })
      ).toBeVisible();
      // The side column exists from 1440.
      await expect(
        page.getByRole("region", { name: "Notificações recentes" })
      ).toBeVisible();
      const overflows = await page
        .locator("#conteudo")
        .evaluate((el) => el.scrollWidth > el.clientWidth);
      expect(overflows).toBe(false);
    });
  });
}

test.describe("tela larga a 2560 px: o teto do conteúdo", () => {
  test.use({ viewport: { width: 2560, height: 1200 } });

  test("o conteúdo para em 1840 px, centralizado no painel", async ({
    page,
  }, testInfo) => {
    // biome-ignore lint/suspicious/noSkippedTests: the mobile project has its own viewport
    test.skip(
      testInfo.project.name === "mobile",
      "o projeto mobile tem viewport própria"
    );
    await seedWide(page);
    const main = await box(page.locator("#conteudo"));
    // The greeting row spans the content column: h1 on the left, "+ Novo contrato" on the right.
    const title = await box(page.getByRole("heading", { level: 1 }));
    const shortcut = await box(
      page.locator("#conteudo").getByRole("link", { name: "Novo contrato" })
    );
    const left = title.x;
    const right = shortcut.x + shortcut.width;
    expect(right - left).toBeCloseTo(1840, 0);
    expect(left - main.x).toBeCloseTo(main.x + main.width - right, 0);
  });
});

test.describe("Notificações recentes só a partir de 1440 px", () => {
  test.use({ viewport: { width: 1439, height: 900 } });

  test("abaixo não aparece nem busca; a partir de 1440 aparece, e Ver todas abre o painel", async ({
    page,
  }, testInfo) => {
    // biome-ignore lint/suspicious/noSkippedTests: the mobile project has its own viewport
    test.skip(
      testInfo.project.name === "mobile",
      "o projeto mobile tem viewport própria"
    );
    const calls: string[] = [];
    page.on("request", (req) => {
      if (new URL(req.url()).pathname === "/api/notifications") {
        calls.push(req.url());
      }
    });
    await seedWide(page, { withNotice: true });
    const recent = page.getByRole("region", { name: "Notificações recentes" });
    await expect(recent).toBeHidden();
    // Below lateral nothing is fetched for a block that is not on screen, not
    // even once the page settles (the shell refetches right after an SSR load).
    await page.waitForLoadState("networkidle");
    expect(calls).toEqual([]);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(recent).toBeVisible();
    await expect.poll(() => calls.length).toBeGreaterThan(0);
    await recent.getByRole("button", { name: "Ver todas" }).click();
    await expect(
      page.getByRole("dialog", { name: "Notificações" })
    ).toBeVisible();
  });
});

test("+ Novo contrato ao lado da saudação no desktop; no celular fica o ＋ da tab bar", async ({
  page,
}, testInfo) => {
  await signup(page);
  const shortcut = page
    .locator("#conteudo")
    .getByRole("link", { name: "Novo contrato" });
  if (testInfo.project.name === "mobile") {
    await expect(shortcut).toBeHidden();
    const tabBarPlus = page
      .getByRole("navigation", { name: "Navegação principal" })
      .filter({ visible: true })
      .getByRole("link", { name: "Novo contrato" });
    await expect(tabBarPlus).toBeVisible();
    await expect(tabBarPlus).toHaveAttribute("href", "/contracts/new");
  } else {
    await shortcut.click();
    await page.waitForURL("**/contracts/new");
  }
});

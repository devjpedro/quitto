import { expect, test } from "@playwright/test";
import { signup, waitForHydrated } from "../fixtures";
import {
  box,
  card,
  expectNoPageScrollX,
  seedOneEach,
  seedWide,
} from "../home-helpers";

test("muitas ações: um cartão em destaque e 'Na sequência' com 4 linhas e o '+ N'; sem carrossel", async ({
  page,
}) => {
  await signup(page);
  await seedOneEach(page.request, "Muitas E2E", [-40, -30, -20, -10, -5, -3]);
  await page.goto("/");
  // A click before hydration lands on the server HTML and is lost.
  await waitForHydrated(page);
  // Only the first action is a card; the others are lines with no button.
  await expect(card(page, "Muitas E2E 1 · parcela 1 de 1")).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(1);
  const next = page.getByRole("region", { name: "Na sequência" });
  await expect(next.getByRole("listitem")).toHaveCount(4);
  await expect(next.getByText("+ 1 em Parcelas")).toBeVisible();
  await expect(next.getByRole("button")).toHaveCount(0);
  // No carousel any more: nothing says "1 de N", nothing hides in a strip.
  await expect(page.getByText("1 de 6")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ver todas" })).toHaveCount(0);
  await expectNoPageScrollX(page);
});

test("a 1512 px o cartão verde e 'Na sequência' têm a mesma altura", async ({
  page,
}, testInfo) => {
  // biome-ignore lint/suspicious/noSkippedTests: o projeto mobile tem viewport própria
  test.skip(
    testInfo.project.name === "mobile",
    "o projeto mobile tem viewport própria"
  );
  await page.setViewportSize({ width: 1512, height: 900 });
  await signup(page);
  await seedOneEach(page.request, "Altura E2E", [-40, -30, -20]);
  await page.goto("/");
  await waitForHydrated(page);
  const hero = await box(page.getByRole("article"));
  const next = await box(page.getByRole("region", { name: "Na sequência" }));
  expect(Math.abs(hero.height - next.height)).toBeLessThanOrEqual(1);
});

for (const width of [800, 1024, 1440, 1920, 2560]) {
  test.describe(`tela a ${width} px`, () => {
    test.use({ viewport: { width, height: 1000 } });

    test("a moldura acompanha a tela, a sidebar tem 232 px e nada rola de lado", async ({
      page,
    }, testInfo) => {
      // biome-ignore lint/suspicious/noSkippedTests: the mobile project has its own viewport
      test.skip(
        testInfo.project.name === "mobile",
        "o projeto mobile tem viewport própria"
      );
      await seedWide(page);
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
      // From md the panel scrolls inside the screen, never the page (B3).
      await expectNoPageScrollX(page);
      const pageScrolls = await page.evaluate(
        () =>
          (document.scrollingElement?.scrollHeight ?? 0) >
          document.documentElement.clientHeight
      );
      expect(pageScrolls).toBe(false);
      const overflows = await page
        .locator("#conteudo")
        .evaluate((el) => el.scrollWidth > el.clientWidth);
      expect(overflows).toBe(false);
    });
  });
}

test.describe("tela larga: a ação e 'Na sequência' lado a lado", () => {
  test.use({ viewport: { width: 1512, height: 1000 } });

  test("a 1512 o cartão e a sequência dividem a linha, e Próximos 30 dias e Marcos a de baixo", async ({
    page,
  }, testInfo) => {
    // biome-ignore lint/suspicious/noSkippedTests: the mobile project has its own viewport
    test.skip(
      testInfo.project.name === "mobile",
      "o projeto mobile tem viewport própria"
    );
    await seedWide(page);
    const hero = await box(card(page, "Larga E2E 1 · parcela 1 de 1"));
    const next = await box(page.getByRole("region", { name: "Na sequência" }));
    expect(Math.abs(hero.y - next.y)).toBeLessThan(2);
    expect(next.x).toBeGreaterThan(hero.x + hero.width - 1);
  });
});

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
    const title = await box(page.getByRole("heading", { level: 1 }));
    const next = await box(page.getByRole("region", { name: "Na sequência" }));
    const left = title.x;
    const right = next.x + next.width;
    expect(right - left).toBeCloseTo(1840, 0);
    expect(left - main.x).toBeCloseTo(main.x + main.width - right, 0);
  });
});

test("'Novo contrato' vive na sidebar (desktop) (o ＋ na linha da logo) e no ＋ da tab bar (celular), não no cabeçalho da home", async ({
  page,
}, testInfo) => {
  await signup(page);
  await expect(
    page.locator("#conteudo").getByRole("link", { name: "Novo contrato" })
  ).toHaveCount(0);
  // Desktop: the "＋" on the logo's line; phone: the tab bar's.
  const shortcut = page
    .getByRole("link", { name: "Novo contrato" })
    .filter({ visible: true });
  await expect(shortcut).toBeVisible();
  await expect(shortcut).toHaveAttribute("href", "/contracts/new");
  if (testInfo.project.name !== "mobile") {
    await shortcut.click();
    await page.waitForURL("**/contracts/new");
  }
});

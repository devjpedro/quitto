import { expect, test } from "@playwright/test";
import {
  isoDaysFromToday,
  seedContract,
  signup,
  waitForHydrated,
} from "../fixtures";

// Mockup 20, B3 + rodada 3 (S4): from 768 px the page never scrolls. The
// sidebar and the white block scroll inside themselves. What used to break it
// was an absolutely positioned element (sr-only text) at the end of the
// block's content, whose containing block was the page.
for (const size of [
  { width: 1512, height: 860 },
  { width: 1280, height: 720 },
]) {
  test(`a página não rola a ${size.width} × ${size.height}: só o bloco rola, por dentro`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await signup(page);
    const { id } = await seedContract(page.request, {
      title: "Rolagem E2E",
      schedule: {
        mode: "auto",
        totalAmountCents: 600_000,
        installmentsCount: 12,
        firstDueDate: isoDaysFromToday(-60),
      },
    });
    for (const path of [
      "/",
      "/contracts",
      `/contracts/${id}`,
      "/installments",
      "/people",
      "/settings",
    ]) {
      await page.goto(path);
      await waitForHydrated(page);
      await expect(page.locator("#conteudo")).toBeVisible();
      // Scrolled to the end of the block: the end is where the stray box sat.
      await page.locator("#conteudo").evaluate((main) => {
        main.scrollTop = main.scrollHeight;
      });
      const measures = await page.evaluate(() => {
        const root = document.scrollingElement as HTMLElement;
        const main = document.getElementById("conteudo") as HTMLElement;
        return {
          page: root.scrollHeight,
          viewport: window.innerHeight,
          scrolledInside: main.scrollTop,
          mainBottom: main.getBoundingClientRect().bottom,
        };
      });
      expect(measures.page, `${path} faz a página rolar`).toBeLessThanOrEqual(
        measures.viewport
      );
      expect(measures.mainBottom).toBeLessThanOrEqual(measures.viewport);
      if (path === `/contracts/${id}`) {
        // The long contract is what scrolls, and inside the block.
        expect(measures.scrolledInside).toBeGreaterThan(0);
      }
    }
  });
}

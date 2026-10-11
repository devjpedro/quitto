import { expect, test } from "@playwright/test";
import {
  getContract,
  isoDaysFromToday,
  seedContract,
  signup,
  waitForHydrated,
} from "../fixtures";

// Mockup 20, B3 + rodada 3 (S4): from 768 px the page never scrolls. The
// sidebar and the white block scroll inside themselves. What used to break it
// was an absolutely positioned element (sr-only text) at the end of the
// block's content, whose containing block was the page.
const LATERAL = 1440;

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
        // Below the lateral layout the long contract scrolls, inside the block;
        // from it (1440) the block holds still and the list scrolls on its own.
        if (size.width >= LATERAL) {
          expect(measures.scrolledInside).toBe(0);
        } else {
          expect(measures.scrolledInside).toBeGreaterThan(0);
        }
      }
    }
  });
}

// Contracts of 60 installments (lateral layout): the list has its own scroll,
// the head and the panel stay, and ↑/↓ keep the selected line in view.
test("contrato de 60 parcelas a 1512: a lista rola por dentro, sem Voltar ao topo, e ↓ mantém a parcela à vista", async ({
  page,
}, testInfo) => {
  // biome-ignore lint/suspicious/noSkippedTests: the phone scrolls the page, as before
  test.skip(testInfo.project.name === "mobile", "no celular a página rola");
  await page.setViewportSize({ width: 1512, height: 860 });
  await signup(page);
  const { id } = await seedContract(page.request, {
    title: "Sessenta parcelas",
    schedule: {
      mode: "monthly",
      monthlyAmountCents: 20_000,
      months: 60,
      firstDueDate: isoDaysFromToday(5),
    },
  });
  const detail = await getContract(page.request, id);
  const first = (detail.installments as { id: string; sequence: number }[])
    .filter((i) => i.sequence === 1)
    .map((i) => i.id)[0] as string;
  await page.goto(`/contracts/${id}?installment=${first}`);
  await waitForHydrated(page);
  const body = page.getByTestId("tab-body");
  const main = page.locator("#conteudo");
  await expect(body).toBeVisible();
  const overflow = await body.evaluate((el) => ({
    scrollable: el.scrollHeight > el.clientHeight + 200,
    bottom: el.getBoundingClientRect().bottom,
  }));
  expect(overflow.scrollable).toBe(true);
  expect(overflow.bottom).toBeLessThanOrEqual(860);
  expect(await main.evaluate((el) => el.scrollHeight - el.clientHeight)).toBe(
    0
  );
  await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();

  // ↓ walks the selection, and the selected line stays inside the list's own scroll.
  // (the panel hears the arrows: the focus is on its title)
  await page
    .getByTestId("installment-panel-docked")
    .getByRole("heading")
    .first()
    .focus();
  for (let n = 0; n < 25; n++) {
    await page.keyboard.press("ArrowDown");
  }
  await expect
    .poll(() =>
      body.evaluate((el) => {
        const row = el.querySelector('[aria-current="true"]');
        if (!row) {
          return "none";
        }
        const area = el.getBoundingClientRect();
        const box = row.getBoundingClientRect();
        return box.top >= area.top - 1 && box.bottom <= area.bottom + 1
          ? "in view"
          : "out";
      })
    )
    .toBe("in view");
  expect(await body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect(await main.evaluate((el) => el.scrollTop)).toBe(0);
  await expect(
    page.getByRole("button", { name: "Voltar ao topo" })
  ).toHaveCount(0);
});

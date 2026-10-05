import { expect, type Page, test } from "@playwright/test";
import {
  isoDaysFromToday,
  seedContract,
  signup,
  waitForHydrated,
} from "../fixtures";

const WEB = "http://localhost:3001";
const SEE_ALL = /^(Ver todas|See all) \(\d+\)$/;
/** Desktop widths where a card's content crosses a pair's limit: 182 px at 1024 up to 336 at 1920. */
const DESKTOP_WIDTHS = [1024, 1280, 1512, 1536, 1920];

interface CardLayout {
  buttons: number[];
  content: number;
  legendOverflow: number;
  name: string;
  overflow: number;
  rows: number;
}

/**
 * Every rendered action card, measured. The legend is the line right after
 * the bar; the buttons are the card's last row. Cards past the desktop row
 * are display: none, so the caller opens "Ver todas" first.
 */
function cardLayouts(page: Page): Promise<CardLayout[]> {
  return page.getByRole("article").evaluateAll((cards) =>
    cards
      .filter((card) => card.checkVisibility())
      .map((card) => {
        const style = getComputedStyle(card);
        const legend =
          card.querySelector("[data-status]")?.parentElement
            ?.nextElementSibling ?? null;
        const buttons = [...(card.lastElementChild?.children ?? [])].map(
          (button) => button.getBoundingClientRect()
        );
        return {
          name: (card.textContent ?? "").slice(0, 60),
          content:
            card.clientWidth -
            Number.parseFloat(style.paddingLeft) -
            Number.parseFloat(style.paddingRight),
          overflow: card.scrollWidth - card.clientWidth,
          legendOverflow: legend ? legend.scrollWidth - legend.clientWidth : 0,
          rows: new Set(buttons.map((rect) => Math.round(rect.top))).size,
          buttons: buttons.map((rect) => rect.width),
        };
      })
  );
}

/**
 * Nothing spills out of a card, and two buttons that do not share a row
 * never leave one alone at its own width: each takes the whole row
 * (decision 16, review of Task 13).
 */
async function expectTidyCards(page: Page, label: string): Promise<void> {
  const layouts = await cardLayouts(page);
  expect(layouts.length, label).toBeGreaterThanOrEqual(4);
  for (const layout of layouts) {
    const where = `${label} · ${layout.name}`;
    expect(layout.overflow, where).toBeLessThanOrEqual(0);
    expect(layout.legendOverflow, where).toBeLessThanOrEqual(0);
    if (layout.rows > 1) {
      for (const width of layout.buttons) {
        expect(width, where).toBeGreaterThanOrEqual(layout.content - 1);
      }
    }
  }
}

/** Opens the hidden cards past the desktop row, when there are any. */
async function showEveryCard(page: Page): Promise<void> {
  const seeAll = page.getByRole("button", { name: SEE_ALL });
  if (await seeAll.isVisible()) {
    await seeAll.click();
  }
}

/**
 * One card of each pair that can wrap: a group you pay (Pagar a mais antiga
 * + Ver parcelas), a group you receive (Cobrar no WhatsApp + Ver parcelas),
 * one installment to receive (Cobrar no WhatsApp + Marcar como recebida) on
 * a 60-installment contract, whose legend is the longest ("0 de 60
 * recebidas · falta R$ 120.000,00"), and one to pay.
 */
async function seedEveryPair(page: Page): Promise<void> {
  const overdue = (days: number[], amountCents: number) => ({
    mode: "custom" as const,
    installments: [...days, 30, 60].map((offset) => ({
      amountCents,
      dueDate: isoDaysFromToday(offset),
    })),
  });
  await seedContract(page.request, {
    title: "Viagem E2E",
    schedule: overdue([-20, -12], 150_000),
  });
  await seedContract(page.request, {
    title: "Notebook E2E",
    ownerRole: "seller",
    schedule: overdue([-15, -8], 35_000),
  });
  await seedContract(page.request, {
    title: "Terreno E2E",
    ownerRole: "seller",
    schedule: {
      mode: "monthly",
      monthlyAmountCents: 200_000,
      months: 60,
      firstDueDate: isoDaysFromToday(2),
    },
  });
  await seedContract(page.request, {
    title: "Aluguel E2E",
    schedule: {
      mode: "custom",
      installments: [3, 33].map((offset) => ({
        amountCents: 125_000,
        dueDate: isoDaysFromToday(offset),
      })),
    },
  });
}

for (const locale of ["pt-BR", "en-US"]) {
  test(`cartões de ação (${locale}): nenhuma legenda vaza e nenhum botão fica sozinho numa linha`, async ({
    page,
  }, testInfo) => {
    await signup(page);
    await seedEveryPair(page);
    await page
      .context()
      .addCookies([{ name: "locale", value: locale, url: WEB }]);
    await page.goto("/");
    await waitForHydrated(page);
    await expect(page.getByRole("article").first()).toBeVisible();
    if (testInfo.project.name === "mobile") {
      // The carousel renders every card: off screen, still measured.
      await expectTidyCards(page, `390 ${locale}`);
      return;
    }
    await showEveryCard(page);
    for (const width of DESKTOP_WIDTHS) {
      await page.setViewportSize({ width, height: 1000 });
      await expectTidyCards(page, `${width} ${locale}`);
    }
  });
}

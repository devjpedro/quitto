import { expect, type Locator, type Page } from "@playwright/test";
import {
  isoDaysFromToday,
  seedContract,
  signup,
  waitForHydrated,
} from "./fixtures";

const HYDRATION = /hydrat/i;

/** An action card, named by its "Título · n/N" line. */
export function card(page: Page, name: string): Locator {
  return page.getByRole("article", { name });
}

/** Invite cards are named by their inviter line ("… te convidou como …"). */
export function inviteCard(page: Page, contractTitle: string): Locator {
  return page
    .getByRole("article")
    .filter({ hasText: contractTitle })
    .filter({ hasText: "te convidou" });
}

/** The element's box; it must be on screen. */
export async function box(locator: Locator) {
  const found = await locator.boundingBox();
  expect(found).not.toBeNull();
  return found as NonNullable<typeof found>;
}

/**
 * The page itself never scrolls sideways: the carousel scrolls inside its own
 * strip. Measured against the document's clientWidth, so a classic scrollbar
 * does not count as overflow.
 */
export async function expectNoPageScrollX(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    scroll: document.scrollingElement?.scrollWidth ?? 0,
    client: document.documentElement.clientWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
}

/**
 * Hydration mismatches the page reports from now on. React 19 logs an
 * attribute mismatch on the console, but a text or structure one (the tree is
 * rebuilt on the client) goes to window.reportError, which reaches Playwright
 * as a pageerror.
 */
export function collectHydrationErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (HYDRATION.test(msg.text())) {
      errors.push(msg.text());
    }
  });
  page.on("pageerror", (error) => {
    if (HYDRATION.test(error.message)) {
      errors.push(error.message);
    }
  });
  return errors;
}

// Tela larga (mockup 12, estrutura B; Desvio 21). Six overdue installments:
// more than any row holds, so "Ver todas (6)" stays at every width.
const WIDE_DAYS = [-50, -40, -30, -20, -10, -5];

/**
 * A new account with six overdue installments, on the hydrated home. The
 * server HTML is the same at every width, so no hydration mismatch either:
 * checked here, and the returned list keeps collecting for later reloads.
 */
export async function seedWide(
  page: Page
): Promise<{ hydrationErrors: string[]; id: string }> {
  const hydrationErrors = collectHydrationErrors(page);
  await signup(page);
  const { id } = await seedContract(page.request, {
    title: "Larga E2E",
    schedule: {
      mode: "custom",
      installments: WIDE_DAYS.map((days) => ({
        amountCents: 10_000,
        dueDate: isoDaysFromToday(days),
      })),
    },
  });
  await page.goto("/");
  await waitForHydrated(page);
  await expect(card(page, "Larga E2E · 1/6")).toBeVisible();
  expect(hydrationErrors).toEqual([]);
  return { hydrationErrors, id };
}

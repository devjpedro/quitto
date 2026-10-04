import {
  type APIRequestContext,
  expect,
  type Locator,
  type Page,
} from "@playwright/test";
import {
  isoDaysFromToday,
  seedContract,
  signup,
  waitForHydrated,
} from "./fixtures";

const HYDRATION = /hydrat/i;

/** An action card, named by its "Título · parcela n de N" line. */
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
 * The chips strip once the client has measured it: it takes a tab stop only
 * while it scrolls (useScrollsSideways), which the server HTML cannot know,
 * and the home streams in after the root hydrates. axe waits for this, or on
 * a phone it can see a strip that scrolls with no tab stop yet.
 */
export async function chipsMeasured(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page
        .getByRole("list", { name: "Resumo" })
        .evaluate((el) => el.scrollWidth <= el.clientWidth || el.tabIndex === 0)
    )
    .toBe(true);
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

/**
 * One contract per entry, each with a single installment due `days` from
 * today: N cards (the overdue installments of one contract are one card).
 */
export async function seedOneEach(
  request: APIRequestContext,
  prefix: string,
  days: number[],
  ownerRole: "buyer" | "seller" = "buyer"
): Promise<string[]> {
  const ids: string[] = [];
  for (const [index, offset] of days.entries()) {
    const { id } = await seedContract(request, {
      title: `${prefix} ${index + 1}`,
      ownerRole,
      schedule: {
        mode: "custom",
        installments: [
          { amountCents: 10_000, dueDate: isoDaysFromToday(offset) },
        ],
      },
    });
    ids.push(id);
  }
  return ids;
}

// Tela larga (mockup 12, estrutura B; Desvio 21). Six overdue installments in
// six contracts: six cards, more than any row holds, so "Ver todas (6)" stays
// at every width.
const WIDE_DAYS = [-50, -40, -30, -20, -10, -5];

/**
 * A new account with six overdue installments in six contracts (six cards),
 * on the hydrated home. The server HTML is the same at every width, so no
 * hydration mismatch either: checked here, and the returned list keeps
 * collecting for later reloads.
 */
export async function seedWide(
  page: Page
): Promise<{ hydrationErrors: string[]; id: string }> {
  const hydrationErrors = collectHydrationErrors(page);
  await signup(page);
  const [id] = await seedOneEach(page.request, "Larga E2E", WIDE_DAYS);
  await page.goto("/");
  await waitForHydrated(page);
  await expect(card(page, "Larga E2E 1 · parcela 1 de 1")).toBeVisible();
  expect(hydrationErrors).toEqual([]);
  return { hydrationErrors, id };
}

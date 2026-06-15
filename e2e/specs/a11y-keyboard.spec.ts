import { expect, test } from "@playwright/test";
import { newUser, seedContract } from "../fixtures";

const ROW_TESTID = /^installment-row-/;

// WCAG 2.4.3 (Focus Order): closing the installment drawer must return keyboard
// focus to the row button that opened it, not drop it on <body>. Regression
// guard for the synchronous-unmount bug (drawer returned null on close before
// Radix could run its FocusScope close-restoration).
test("fechar o drawer da parcela devolve o foco ao gatilho", async ({
  browser,
}) => {
  const a = await newUser(browser);
  try {
    const { id } = await seedContract(a.page.request, {
      title: "Foco do teclado",
      ownerRole: "buyer",
      requiresConfirmation: false,
    });
    await a.page.goto(`/contracts/${id}`);

    const row = a.page.locator('[data-testid^="installment-row-"]').first();
    await expect(row).toBeVisible();
    const rowTestId = await row.getAttribute("data-testid");

    // Drive the open via the keyboard: focus the row and press Enter.
    await row.focus();
    await expect(row).toBeFocused();
    await a.page.keyboard.press("Enter");

    await expect(a.page.getByRole("dialog")).toBeVisible();

    // Close via Escape; Radix should restore focus to the triggering row.
    await a.page.keyboard.press("Escape");
    await expect(a.page.getByRole("dialog")).toBeHidden();

    await expect(row).toBeFocused();
    const activeTestId = await a.page.evaluate(() =>
      document.activeElement?.getAttribute("data-testid")
    );
    expect(activeTestId).toMatch(ROW_TESTID);
    expect(activeTestId).toBe(rowTestId);
  } finally {
    await a.close();
  }
});

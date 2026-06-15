import { expect, test } from "@playwright/test";
import { newUser, seedContract } from "../fixtures";

const ROW_TESTID = /^installment-row-/;
const MARK_PAID = /^Marcar como paga$/;

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

// WCAG 2.4.3 (Focus Order): the payment confirm/dispute dialogs are nested INSIDE
// the installment drawer. Closing one (Escape) must return focus to the trigger
// button that opened it ("Marcar como paga"), not drop it on <body>, and the
// drawer must stay open. Regression guard for controlled Radix dialogs with no
// real Trigger (onCloseAutoFocus has nothing to restore to).
test("fechar o diálogo de pagamento devolve o foco ao gatilho", async ({
  browser,
}) => {
  const a = await newUser(browser);
  try {
    const { id } = await seedContract(a.page.request, {
      title: "Foco do diálogo",
      ownerRole: "buyer",
      requiresConfirmation: false,
    });
    await a.page.goto(`/contracts/${id}`);

    // Open the installment drawer via the keyboard.
    const row = a.page.locator('[data-testid^="installment-row-"]').first();
    await expect(row).toBeVisible();
    await row.focus();
    await a.page.keyboard.press("Enter");
    await expect(a.page.getByRole("dialog")).toBeVisible();

    // Focus the payment trigger and open the confirm dialog via the keyboard.
    const trigger = a.page.getByRole("button", { name: MARK_PAID }).first();
    await trigger.focus();
    await expect(trigger).toBeFocused();
    await a.page.keyboard.press("Enter");

    // The confirm dialog (its own title "Marcar como paga") is now visible and
    // focus moved into it (off the trigger).
    const confirmDialog = a.page.getByRole("dialog", {
      name: MARK_PAID,
    });
    await expect(confirmDialog).toBeVisible();
    await expect(trigger).not.toBeFocused();

    // Close via Escape: dialog closes, drawer stays, focus returns to trigger.
    await a.page.keyboard.press("Escape");
    await expect(confirmDialog).toBeHidden();
    // The drawer dialog must remain open.
    await expect(a.page.getByRole("dialog")).toBeVisible();
    await expect(trigger).toBeFocused();
  } finally {
    await a.close();
  }
});

import { expect, test } from "@playwright/test";
import { newUser, seedContract, signup, waitForHydrated } from "../fixtures";

const ROW_TESTID = /^installment-row-/;
const MARK_PAID = /^Marcar como paga$/;
const DELETE_ACCOUNT = /^Excluir conta$/;
const CONTRACT_ACTIONS = /^Ações do contrato$/;
const DELETE_CONTRACT = /^Excluir contrato$/;

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
    // O gatilho e o botão de confirmar dividem o mesmo nome acessível, e o Radix
    // aria-esconde o fundo enquanto o diálogo está aberto — então `trigger`
    // re-resolve para o botão DE DENTRO do diálogo aqui, e `not.toBeFocused()`
    // passava só porque o foco estava no "Fechar" do cabeçalho. Asserta por
    // escopo, como os outros testes deste arquivo já fazem.
    const focusInConfirm = await confirmDialog.evaluate((el) =>
      el.contains(document.activeElement)
    );
    expect(focusInConfirm).toBe(true);

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

// WCAG 2.4.3 (Focus Order): the delete-account dialog on /settings is controlled
// (opened from a plain button, no Radix Trigger). Opening it via the keyboard
// and closing with Escape must return focus to the "Excluir conta" trigger
// button, not drop it on <body>. Regression guard for the shared controlled-
// dialog focus-restoration fix. We never confirm the deletion — just open/close.
test("fechar o diálogo de excluir conta devolve o foco ao gatilho", async ({
  page,
}) => {
  await signup(page);
  await page.goto("/settings");
  await waitForHydrated(page);

  // The trigger button shares its label with the dialog title, but only the
  // trigger is a button, so the role query resolves to it.
  const trigger = page.getByRole("button", { name: DELETE_ACCOUNT });
  await expect(trigger).toBeVisible();

  // Open via the keyboard: focus the trigger and press Enter.
  await trigger.focus();
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Enter");

  // The dialog is visible and focus moved into it (off the trigger). Radix
  // marks the background aria-hidden while the dialog is open, so the trigger
  // button leaves the a11y tree — assert focus landed inside the dialog instead.
  const dialog = page.getByRole("dialog", { name: DELETE_ACCOUNT });
  await expect(dialog).toBeVisible();
  const focusInDialog = await dialog.evaluate((el) =>
    el.contains(document.activeElement)
  );
  expect(focusInDialog).toBe(true);

  // Close via Escape: dialog closes and focus returns to the trigger.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

// WCAG 2.4.3 (Focus Order): the contract-actions confirm dialog is opened from a
// Radix DropdownMenuItem. The item unmounts on close and Radix Menu restores
// focus to its own trigger asynchronously, so capturing document.activeElement
// synchronously is unreliable. The fix holds a stable ref to the always-mounted
// dropdown trigger button (kebab/"Ações do contrato") and restores focus to it
// in onCloseAutoFocus. Opening the confirm dialog via the keyboard and closing
// with Escape must return focus to that trigger, not drop it on <body>. We never
// confirm the deletion — just open/close.
test("fechar o diálogo de excluir contrato devolve o foco ao gatilho do menu", async ({
  browser,
}) => {
  const a = await newUser(browser);
  try {
    const { id } = await seedContract(a.page.request, {
      title: "Foco do menu de ações",
      ownerRole: "buyer",
      requiresConfirmation: false,
    });
    await a.page.goto(`/contracts/${id}`);

    // Open the actions dropdown via the keyboard: focus the kebab trigger and
    // press Enter.
    const trigger = a.page.getByRole("button", { name: CONTRACT_ACTIONS });
    await expect(trigger).toBeVisible();
    await trigger.focus();
    await expect(trigger).toBeFocused();
    await a.page.keyboard.press("Enter");

    // Select the destructive item via the keyboard (first item is highlighted
    // when the menu opens; Enter activates it).
    const deleteItem = a.page.getByRole("menuitem", { name: DELETE_CONTRACT });
    await expect(deleteItem).toBeVisible();
    await a.page.keyboard.press("Enter");

    // The confirm dialog (its own title "Excluir contrato") is now visible and
    // focus moved into it. Radix aria-hides the background while the dialog is
    // open, so the trigger leaves the a11y tree — assert focus landed inside the
    // dialog instead of asserting on the (now hidden) trigger.
    const confirmDialog = a.page.getByRole("dialog", { name: DELETE_CONTRACT });
    await expect(confirmDialog).toBeVisible();
    const focusInDialog = await confirmDialog.evaluate((el) =>
      el.contains(document.activeElement)
    );
    expect(focusInDialog).toBe(true);

    // Close via Escape: dialog closes and focus returns to the dropdown trigger.
    await a.page.keyboard.press("Escape");
    await expect(confirmDialog).toBeHidden();
    await expect(trigger).toBeFocused();
  } finally {
    await a.close();
  }
});

// WCAG 3.2.1 / 2.4.3: o Radix foca o PRIMEIRO tabbable do content ao montar.
// Enquanto o "Fechar" do cabeçalho era o primeiro tabbable, todo diálogo cujo
// conteúdo começa por campo de texto abria com o foco no X — e o que o usuário
// digitasse logo em seguida se perdia. A paleta ⌘K foi só onde doeu primeiro.
// Este teste prova a classe num diálogo QUE NÃO É a paleta: o "Excluir conta"
// abre com o cursor no campo da frase de confirmação.
//
// Digita pelo teclado de propósito: `fill()` foca o campo antes de escrever e
// mascararia o defeito por completo (foi o que o lgpd.spec fez passar verde).
test("o diálogo de excluir conta abre com o cursor no campo da frase", async ({
  page,
}) => {
  await signup(page);
  await page.goto("/settings");
  await waitForHydrated(page);

  await page.getByRole("button", { name: DELETE_ACCOUNT }).click();
  const dialog = page.getByRole("dialog", { name: DELETE_ACCOUNT });
  await expect(dialog).toBeVisible();

  // O campo da frase é o primeiro tabbable DENTRO do `{children}` — é nele que
  // o foco tem de cair, não no "Fechar" do cabeçalho.
  const field = page.locator("#confirm-phrase");
  await expect(field).toBeFocused();

  // Sem `fill()`: digita como um humano digitaria e confere que o texto entrou
  // no campo em vez de se perder num botão focado.
  await page.keyboard.type("EXCLUIR");
  await expect(field).toHaveValue("EXCLUIR");
  await expect(
    page.getByRole("button", { name: "Excluir definitivamente" })
  ).toBeEnabled();
});

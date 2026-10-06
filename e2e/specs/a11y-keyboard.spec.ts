import { expect, test } from "@playwright/test";
import { newUser, seedContract, signup, waitForHydrated } from "../fixtures";

const DELETE_ACCOUNT = /^Excluir conta$/;
const CONTRACT_ACTIONS = /^Ações do contrato$/;
const DELETE_CONTRACT = /^Excluir contrato$/;

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
    // The page streams in by SSR: a key pressed before hydration does nothing.
    await waitForHydrated(a.page);

    // Open the actions dropdown via the keyboard: focus the kebab trigger and
    // press Enter.
    const trigger = a.page.getByRole("button", { name: CONTRACT_ACTIONS });
    await expect(trigger).toBeVisible();
    await trigger.focus();
    await expect(trigger).toBeFocused();
    await a.page.keyboard.press("Enter");

    // Select the destructive item via the keyboard: the owner's menu opens on
    // "Editar título e descrição", and "Excluir contrato" is the last item
    // (End moves there; Enter activates it).
    const deleteItem = a.page.getByRole("menuitem", { name: DELETE_CONTRACT });
    await expect(deleteItem).toBeVisible();
    await a.page.keyboard.press("End");
    await expect(deleteItem).toBeFocused();
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

// ARIA APG (alertdialog): um diálogo de confirmação abre com o foco na opção
// MENOS destrutiva. Os quatro diálogos de confirmação do app são só botões, e
// em todos o destrutivo vem PRIMEIRO no DOM — então, com o "Fechar" fora do
// começo da ordem de tab, o Radix passaria a focar justamente o botão que apaga
// dados, e um Enter solto logo depois de abrir executaria a ação irreversível.
// O `autoFocus` no Cancelar de cada um é o que segura isso.
//
// Nenhum teste pegava este comportamento: as suítes existentes clicam nos botões
// (o clique foca o alvo) e só verificavam que o foco estava DENTRO do diálogo —
// e o botão destrutivo está dentro. Falseável: tire o `autoFocus` de qualquer um
// dos quatro Cancelar e o caso correspondente fica vermelho.
const CANCELAR = /^Cancelar$/;
const EXCLUIR = /^Excluir$/;

async function assertCancelFocado(
  dialog: import("@playwright/test").Locator,
  destrutivo: RegExp
) {
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: CANCELAR })).toBeFocused();
  await expect(
    dialog.getByRole("button", { name: destrutivo })
  ).not.toBeFocused();
}

test("excluir contrato abre com o foco no Cancelar, não no Excluir", async ({
  browser,
}) => {
  const a = await newUser(browser);
  try {
    const { id } = await seedContract(a.page.request, {
      title: "Foco do Cancelar no excluir",
      ownerRole: "buyer",
      requiresConfirmation: false,
    });
    await a.page.goto(`/contracts/${id}`);
    await waitForHydrated(a.page);

    await a.page.getByRole("button", { name: CONTRACT_ACTIONS }).click();
    await a.page.getByRole("menuitem", { name: DELETE_CONTRACT }).click();
    await assertCancelFocado(
      a.page.getByRole("dialog", { name: DELETE_CONTRACT }),
      EXCLUIR
    );
  } finally {
    await a.close();
  }
});

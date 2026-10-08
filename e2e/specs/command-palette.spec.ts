import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { seedContract, signup, waitForHydrated } from "../fixtures";

const TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const PHONE_WIDTH = 768;
const CONTRACT_URL = /\/contracts\/[0-9a-f-]{36}$/;
const NEW_CONTRACT_URL = /\/contracts\/new\?title=/;
const CONTRACT_TITLE = "Aluguel do apê";
const CONTRACT_OPTION = /^Aluguel do apê/;
const LOAN_OPTION = /^Empréstimo/;
const SETTINGS_URL = /\/settings$/;
/**
 * `signup` cria o usuário como "Usuário E2E" (`fixtures.ts`) e o dono entra
 * como participante do contrato com esse mesmo `displayName`. A busca é
 * normalizada (NFD sem diacrítico), então "usuario" tem que achar "Usuário".
 */
const OWNER_NAME_UNACCENTED = "usuario";

/**
 * Abre a paleta pelo atalho global e devolve o diálogo, já com o cursor no
 * campo. Duas coisas frágeis moram aqui:
 *
 * - o `⌘K`/`Ctrl+K` é um listener único registrado no `_app.tsx`; um segundo
 *   `useCommandPalette()` faria o toggle se anular e a paleta não abriria;
 * - o foco tem que nascer no campo. O Radix foca o 1º tabbable do content (o
 *   "Fechar" do cabeçalho), então a paleta cancela o auto-focus dele. Por isso
 *   os testes digitam com `keyboard.type` e nunca com `fill`: `fill` foca o
 *   elemento antes de escrever e passaria verde com o foco no lugar errado.
 */
async function openPaletteByShortcut(page: Page): Promise<Locator> {
  // sem isso o atalho pode sair antes de o `_app` registrar o listener (o
  // `data-hydrated` do __root chega primeiro) e o ⌘K se perde.
  await page
    .locator("html[data-shortcuts-ready]")
    .waitFor({ state: "attached" });
  // No celular não há teclado: a lupa do topo abre a mesma paleta.
  const phone = (page.viewportSize()?.width ?? 1280) < PHONE_WIDTH;
  if (phone) {
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
  } else {
    await page.keyboard.press("ControlOrMeta+k");
  }
  const palette = page.getByRole("dialog");
  await expect(palette.getByRole("combobox")).toBeFocused();
  return palette;
}

/**
 * Espera a animação de entrada terminar antes de escanear. Mesmo cuidado da
 * gaveta em `a11y.spec.ts`: num frame intermediário overlay e conteúdo estão
 * com opacidade parcial, o que derruba o contraste medido e gera um
 * `color-contrast` falso-positivo que não existe no estado final.
 */
async function settle(overlay: Locator): Promise<void> {
  await overlay.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished))
  );
}

test("⌘K acha contrato por título e navega", async ({ page }) => {
  await signup(page);
  await seedContract(page.request, { title: CONTRACT_TITLE });
  // recarrega para invalidar o cache do Query (staleTime 60s) semeado antes de
  // o contrato existir.
  await page.reload();
  await waitForHydrated(page);

  const palette = await openPaletteByShortcut(page);
  // digita imediatamente, como um usuário faz: nesse instante o
  // `GET /contracts` (que só sai quando a paleta abre) ainda está no ar, e os
  // itens montam com a busca já preenchida.
  await page.keyboard.type("aluguel");

  const found = palette.getByRole("option", { name: CONTRACT_OPTION });
  await expect(found).toBeVisible();
  // o item precisa estar SELECIONADO, senão o Enter é no-op.
  await expect(found).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(CONTRACT_URL);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("acha contrato pelo nome do participante, sem acento", async ({
  page,
}) => {
  await signup(page);
  await seedContract(page.request, { title: "Empréstimo" });
  await page.reload();
  await waitForHydrated(page);

  const palette = await openPaletteByShortcut(page);
  const emprestimo = palette.getByRole("option", { name: LOAN_OPTION });

  // "usuario" não aparece no título: só casa via `participantNames`.
  await page.keyboard.type(OWNER_NAME_UNACCENTED);
  await expect(emprestimo).toBeVisible();

  // contraprova de que é filtro de verdade, e não "tudo sempre visível".
  await palette.getByRole("combobox").fill("zzzz");
  await expect(emprestimo).toBeHidden();
});

test("sem resultado, cria contrato com o texto digitado", async ({ page }) => {
  await signup(page);

  const palette = await openPaletteByShortcut(page);
  await page.keyboard.type("consórcio da moto");

  await expect(
    palette.getByRole("option", { name: "Criar contrato “consórcio da moto”" })
  ).toBeVisible();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(NEW_CONTRACT_URL);
  await expect(page.getByLabel("Nome do contrato")).toHaveValue(
    "consórcio da moto"
  );
});

test("Ajustes pela paleta", async ({ page }) => {
  await signup(page);
  const palette = await openPaletteByShortcut(page);
  await page.keyboard.type("ajustes");
  await palette.getByRole("option", { name: "Ajustes", exact: true }).click();
  await expect(page).toHaveURL(SETTINGS_URL);
  await expect(
    page.getByRole("heading", { level: 1, name: "Ajustes" })
  ).toBeVisible();
});

for (const scheme of ["light", "dark"] as const) {
  test(`paleta aberta não tem violações de a11y (${scheme})`, async ({
    page,
  }) => {
    // Sem cookie `theme`, o script inline do <head> segue o
    // prefers-color-scheme — é o que o emulateMedia controla aqui.
    await page.emulateMedia({ colorScheme: scheme });
    await signup(page);
    await seedContract(page.request, { title: CONTRACT_TITLE });
    await page.reload();
    await waitForHydrated(page);
    // prova que o tema aplicou: sem isso o caso "dark" escanearia o light.
    await expect(page.locator("html.dark")).toHaveCount(
      scheme === "dark" ? 1 : 0
    );

    const palette = await openPaletteByShortcut(page);
    await expect(
      palette.getByRole("option", { name: CONTRACT_OPTION })
    ).toBeVisible();
    await settle(palette);

    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(results.violations).toEqual([]);
  });
}

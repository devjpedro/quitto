import {
  type Browser,
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";
import {
  getContract,
  isoDaysFromToday,
  openNotifications,
  PROOF_PDF,
  scan,
  seedContract,
  sheetAtRest,
  signup,
  twoParties,
  uploadProofApi,
  waitForHydrated,
} from "../fixtures";

// Top-level regex literals (lint/performance/useTopLevelRegex).
const WHATSAPP_HREF = /^https:\/\/wa\.me\/\?text=/;
const ANY_INSTALLMENT = /[?&]installment=/;
const REASON = "O valor que chegou foi R$ 240,00.";
const WEB = "http://localhost:3001";

type Parties = Awaited<ReturnType<typeof twoParties>>;

function idOf(parties: Parties, sequence: number): string {
  const found = parties.installments.find((i) => i.sequence === sequence);
  expect(found).toBeDefined();
  return (found as { id: string }).id;
}

async function closeBoth(parties: Parties): Promise<void> {
  await parties.owner.close();
  await parties.other.close();
}

/** The owner pays Rafael three installments of R$ 480,00, the 1st in 5 days; Rafael confirms each one. */
function ownerPays(browser: Browser): Promise<Parties> {
  return twoParties(browser, {
    ownerRole: "buyer",
    requiresConfirmation: true,
    firstDueDaysFromToday: 5,
    count: 3,
  });
}

/** The open panel: the sheet (a dialog below 1440) or the docked column. */
function panelOf(page: Page): Locator {
  return page
    .getByRole("dialog")
    .or(page.getByTestId("installment-panel-docked"))
    .filter({ visible: true });
}

/** Waits for the panel to settle: a sheet comes in on a spring. */
async function panelAtRest(page: Page): Promise<Locator> {
  const panel = panelOf(page);
  await expect(panel.getByTestId("status-trail")).toBeVisible();
  if ((await panel.getAttribute("role")) === "dialog") {
    await sheetAtRest(panel);
  }
  return panel;
}

/** Opens the contract with the installment's panel (the deep link). */
async function openPanel(
  page: Page,
  contractId: string,
  installmentId: string
): Promise<Locator> {
  await page.goto(`/contracts/${contractId}?installment=${installmentId}`);
  await waitForHydrated(page);
  return panelAtRest(page);
}

/** The step of the trail the installment is at (aria-current="step"). */
function currentStep(panel: Locator): Locator {
  return panel.getByTestId("status-trail").locator('[aria-current="step"]');
}

function toast(page: Page, text: string): Locator {
  return page.locator("[data-sonner-toast]").filter({ hasText: text });
}

async function setTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  await page.context().addCookies([{ name: "theme", value: theme, url: WEB }]);
}

async function expectTheme(page: Page, theme: "light" | "dark") {
  await expect(
    page.locator(theme === "dark" ? "html.dark" : "html:not(.dark)")
  ).toBeVisible();
}

test("pagador envia o comprovante e o aprovador confirma", async ({
  browser,
}) => {
  const parties = await ownerPays(browser);
  const first = idOf(parties, 1);
  try {
    const payer = parties.owner.page;
    const mine = await openPanel(payer, parties.id, first);
    await payer.locator('input[type="file"]').setInputFiles(PROOF_PDF);
    await expect(toast(payer, "Comprovante enviado")).toBeVisible();
    await expect(currentStep(mine)).toContainText("Comprovante");

    const approver = parties.other.page;
    const review = await openPanel(approver, parties.id, first);
    await expect(review.getByTestId("proof-preview")).toBeVisible();
    await review.getByRole("button", { name: "Confirmar recebimento" }).click();
    // The last step is done, with who confirmed: no step is current anymore.
    const confirmed = review.getByTestId("status-trail").locator("li").last();
    await expect(confirmed).toContainText("Confirmada");
    await expect(confirmed).toContainText("por você");
    await expect(currentStep(review)).toHaveCount(0);
    await expect(review.getByTestId("receipt-block")).toBeVisible();
    await expect(
      review.getByRole("link", { name: "Recibo em PDF" })
    ).toBeVisible();
    // Only the owner creates the public link (decision 7).
    await expect(
      review.getByRole("button", { name: "Compartilhar recibo" })
    ).toHaveCount(0);
  } finally {
    await closeBoth(parties);
  }
});

test("o aprovador contesta com motivo; o pagador vê o motivo e reenvia", async ({
  browser,
}, testInfo) => {
  const isPhone = testInfo.project.name === "mobile";
  const parties = await ownerPays(browser);
  const first = idOf(parties, 1);
  try {
    await uploadProofApi(parties.owner.page.request, first);

    const approver = parties.other.page;
    const review = await openPanel(approver, parties.id, first);
    await review.getByRole("button", { name: "Contestar" }).click();
    await review
      .getByLabel("Por que você está contestando?")
      .pressSequentially(REASON);
    await review.getByRole("button", { name: "Enviar contestação" }).click();
    await expect(toast(approver, "Contestação enviada")).toBeVisible();

    const payer = parties.owner.page;
    const mine = await openPanel(payer, parties.id, first);
    await expect(mine.getByTestId("dispute-block")).toContainText(
      `“${REASON}”`
    );
    // The desktop titles the drop area; the phone pins the send to the
    // sheet's foot (mockup 14, frame E).
    await expect(
      isPhone
        ? mine.getByRole("button", { name: "Enviar comprovante" })
        : mine.getByText("Reenviar comprovante")
    ).toBeVisible();
    await payer.locator('input[type="file"]').setInputFiles(PROOF_PDF);
    await expect(toast(payer, "Comprovante enviado")).toBeVisible();
    await expect(currentStep(mine)).toContainText("Comprovante");
  } finally {
    await closeBoth(parties);
  }
});

test("o recebedor marca como recebida, na hora", async ({ browser }) => {
  const parties = await twoParties(browser, {
    ownerRole: "seller",
    requiresConfirmation: true,
    firstDueDaysFromToday: -10,
    count: 3,
  });
  const first = idOf(parties, 1);
  const page = parties.owner.page;
  try {
    const panel = await openPanel(page, parties.id, first);
    await expect(panel.getByTestId("charge-block")).toContainText(
      "Mensagem para Rafael"
    );
    await expect(
      panel.getByRole("link", { name: "Cobrar no WhatsApp" }).first()
    ).toHaveAttribute("href", WHATSAPP_HREF);

    // The answer is held until the line has changed: the line changes on the
    // tap, before the API answers (deterministic, where a fixed delay races).
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/installments/*/mark-received", async (route) => {
      await held;
      await route.continue();
    });
    const answered = page.waitForResponse((response) =>
      response.url().endsWith("/mark-received")
    );
    const row = page.locator(`[data-installment-row="${first}"]`);
    await expect(row).not.toContainText("Confirmada");
    await panel.getByRole("button", { name: "Marcar como recebida" }).click();
    await expect(row).toContainText("Confirmada");
    release();
    expect((await answered).ok()).toBe(true);

    await page.unrouteAll();
    await page.reload();
    await waitForHydrated(page);
    await expect(row).toContainText("Confirmada");
  } finally {
    await closeBoth(parties);
  }
});

test("compartilhar o recibo: o dono cria o link, e o link abre o recibo público", async ({
  browser,
  context,
  page,
}) => {
  await signup(page);
  const { id } = await seedContract(page.request, {
    title: "Moto do Rafa",
    ownerRole: "seller",
    requiresConfirmation: false,
    schedule: {
      mode: "monthly",
      monthlyAmountCents: 48_000,
      months: 3,
      firstDueDate: isoDaysFromToday(-10),
    },
  });
  const detail = await getContract(page.request, id);
  const first = (detail.installments as { id: string; sequence: number }[])
    .filter((i) => i.sequence === 1)
    .map((i) => i.id)[0] as string;
  const marked = await page.request.post(
    `/api/installments/${first}/mark-received`
  );
  expect(marked.ok()).toBeTruthy();
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: WEB,
  });

  const panel = await openPanel(page, id, first);
  await panel.getByRole("button", { name: "Compartilhar recibo" }).click();
  // The link's line shows up in the block, and its copy goes to the
  // clipboard (with no share sheet, as here, sharing copies it too).
  const block = panel.getByTestId("receipt-block");
  await block.getByRole("button", { name: "Copiar o link do recibo" }).click();
  await expect(toast(page, "Link copiado").first()).toBeVisible();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(url).toContain("/r/");

  const stranger = await browser.newContext();
  try {
    const visitor = await stranger.newPage();
    await visitor.goto(url);
    await expect(
      visitor.getByRole("heading", { name: "Recibo de pagamento" })
    ).toBeVisible();
    await expect(visitor.getByText("R$ 480,00").first()).toBeVisible();
  } finally {
    await stranger.close();
  }
});

test("Esc devolve o foco à linha", async ({ page }, testInfo) => {
  // biome-ignore lint/suspicious/noSkippedTests: the 1512 column and the 1280 sheet are desktop widths
  test.skip(testInfo.project.name !== "chromium", "só no desktop");
  await signup(page);
  const { id } = await seedContract(page.request, {
    title: "Moto do Rafa",
    ownerRole: "seller",
    schedule: {
      mode: "monthly",
      monthlyAmountCents: 48_000,
      months: 3,
      firstDueDate: isoDaysFromToday(5),
    },
  });
  const detail = await getContract(page.request, id);
  const second = (detail.installments as { id: string; sequence: number }[])
    .filter((i) => i.sequence === 2)
    .map((i) => i.id)[0] as string;
  const row = page.locator(`[data-installment-row="${second}"]`);

  for (const size of [
    { width: 1512, height: 860 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(size);
    await page.goto(`/contracts/${id}`);
    await waitForHydrated(page);
    await row.click();
    await expect(page).toHaveURL(ANY_INSTALLMENT);
    await panelAtRest(page);
    await expect(row).not.toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(ANY_INSTALLMENT);
    await expect(row).toBeFocused();
  }
});

test("a notificação do comprovante abre o painel na parcela", async ({
  browser,
}) => {
  const parties = await twoParties(browser, {
    ownerRole: "seller",
    requiresConfirmation: true,
    firstDueDaysFromToday: 5,
    count: 3,
  });
  const first = idOf(parties, 1);
  const page = parties.owner.page;
  try {
    await uploadProofApi(parties.other.page.request, first);
    await page.goto("/");
    const notifications = await openNotifications(page);
    await notifications.getByText("Novo comprovante para confirmar").click();
    await page.waitForURL(
      (at) =>
        at.pathname === `/contracts/${parties.id}` &&
        at.searchParams.get("installment") === first
    );
    await expect(
      page.getByRole("dialog", { name: "Parcela 1 de 3" })
    ).toBeVisible();
  } finally {
    await closeBoth(parties);
  }
});

test("axe em claro e escuro: P1 (quem paga) e P4 (quem confere)", async ({
  browser,
}) => {
  const parties = await ownerPays(browser);
  const first = idOf(parties, 1);
  try {
    // Rafael receives with an account and a key: the payer sees the PIX (P1).
    const key = await parties.other.page.request.patch("/api/me", {
      data: { pixKey: "rafael.prado@exemplo.com" },
    });
    expect(key.ok()).toBeTruthy();

    const payer = parties.owner.page;
    for (const theme of ["light", "dark"] as const) {
      await setTheme(payer, theme);
      const p1 = await openPanel(payer, parties.id, first);
      await expectTheme(payer, theme);
      await expect(
        p1.getByTestId("pix-block").filter({ visible: true }).first()
      ).toBeVisible();
      await scan(payer);
    }

    await uploadProofApi(payer.request, first);
    const approver = parties.other.page;
    for (const theme of ["light", "dark"] as const) {
      await setTheme(approver, theme);
      const p4 = await openPanel(approver, parties.id, first);
      await expectTheme(approver, theme);
      await expect(p4.getByTestId("proof-preview")).toBeVisible();
      await scan(approver);
    }
  } finally {
    await closeBoth(parties);
  }
});

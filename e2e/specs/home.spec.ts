import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  getContract,
  isoDaysFromToday,
  newUser,
  openAccountMenu,
  openNotifications,
  PROOF_PDF,
  seedContract,
  seedInvite,
  signup,
  waitForHydrated,
} from "../fixtures";

const GREETING = /^(Bom dia|Boa tarde|Boa noite), Usuário$/;
const GREETING_EN = /^(Good morning|Good afternoon|Good evening), Usuário$/;
const ACCEPT_INVITE = /Aceitar convite/i;
const AGENDA_ROW = /Agenda E2E/;
const FAR_ROW = /Longe E2E/;
const INSTALLMENT_PARAM = /installment=/;
const HYDRATION = /hydrat/i;
const TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const WA_PREFIX = "https://wa.me/?text=";

function card(page: Page, name: string) {
  return page.getByRole("article", { name });
}

/** Invite cards are named by their inviter line ("… te convidou como …"). */
function inviteCard(page: Page, contractTitle: string) {
  return page
    .getByRole("article")
    .filter({ hasText: contractTitle })
    .filter({ hasText: "te convidou" });
}

function nowLink(page: Page) {
  return page
    .locator("#app-shell nav")
    .filter({ visible: true })
    .first()
    .getByRole("link", { name: "Agora" });
}

async function scan(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations).toEqual([]);
}

/**
 * Waits for the sheet's spring to settle, like openNotifications. Radix only
 * takes Escape once the dialog's layer is registered, a few ms after it
 * mounts: a press in that instant (no person is that fast) is lost.
 */
async function sheetAtRest(panel: Locator) {
  await expect
    .poll(() =>
      panel.evaluate((el) => {
        const transform = getComputedStyle(el).transform;
        return transform === "none" || transform === "matrix(1, 0, 0, 1, 0, 0)";
      })
    )
    .toBe(true);
}

/** The page itself never scrolls sideways: the carousel scrolls inside its own strip. */
async function expectNoPageScrollX(page: Page) {
  const widths = await page.evaluate(() => ({
    scroll: document.scrollingElement?.scrollWidth ?? 0,
    viewport: window.innerWidth,
  }));
  expect(widths.scroll).toBe(widths.viewport);
}

test("primeiro acesso: o guia mostra o próximo passo e dispensar fica guardado", async ({
  page,
}) => {
  await signup(page);
  await expect(
    page.getByRole("heading", { level: 1, name: GREETING })
  ).toBeVisible();
  // The desktop sidebar's moment card says it too; on a phone it is hidden.
  await expect(
    page.getByText("Comece por aqui").filter({ visible: true }).first()
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Criar meu primeiro contrato" })
  ).toHaveAttribute("href", "/contracts/new");
  await page.getByRole("button", { name: "dispensar guia" }).click();
  await expect(
    page.getByRole("heading", { name: "Suas pendências aparecem aqui" })
  ).toBeVisible();
  await page.reload();
  await waitForHydrated(page);
  await expect(
    page.getByRole("heading", { name: "Suas pendências aparecem aqui" })
  ).toBeVisible();
  await expect(page.getByText("Comece por aqui")).toHaveCount(0);
});

test("pagador: Já paguei tira a parcela do Agora na hora e fica assim depois de recarregar", async ({
  page,
}, testInfo) => {
  await signup(page);
  await seedContract(page.request, {
    title: "Aluguel E2E",
    schedule: {
      mode: "auto",
      totalAmountCents: 300_000,
      installmentsCount: 3,
      firstDueDate: isoDaysFromToday(-3),
    },
  });
  // A payer past the guide: while it shows, the green guide card takes the
  // place of "Nada pendente agora" (next test).
  const dismissed = await page.request.post("/api/me/onboarding/dismiss");
  expect(dismissed.ok()).toBe(true);
  await page.goto("/");
  // A click before hydration lands on the server HTML and is lost.
  await waitForHydrated(page);
  const first = card(page, "Aluguel E2E · 1/3");
  await expect(first.getByText("Faça primeiro · atrasada")).toBeVisible();
  await first.getByRole("button", { name: "Já paguei" }).click();
  await expect(
    page.getByText("Parcela marcada como paga", { exact: true })
  ).toBeVisible();
  await expect(first).toHaveCount(0);
  await expect(
    page.getByText("Nada pendente agora", { exact: true })
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: GREETING })
  ).toBeVisible();
  await expect(
    page.getByText("Nada pendente agora", { exact: true })
  ).toBeVisible();
  await expect(card(page, "Aluguel E2E · 1/3")).toHaveCount(0);
  // 1 of 3 paid: the milestone of the moment is "Mais perto de quitar". Desktop
  // shows it in the sidebar's lime card; a phone opens the strip with it.
  if (testInfo.project.name === "mobile") {
    await expect(
      page.getByRole("region", { name: "Marcos" }).getByRole("listitem").first()
    ).toContainText("Mais perto de quitar");
  } else {
    await expect(
      page.getByRole("complementary").getByText("Mais perto de quitar")
    ).toBeVisible();
  }
});

test("nada pendente com o guia ativo: o guia verde fica no lugar de Nada pendente agora", async ({
  page,
}) => {
  await signup(page);
  // Due in 15 days: in the next 30 days, but not an action yet.
  await seedContract(page.request, {
    title: "Longe E2E",
    schedule: {
      mode: "auto",
      totalAmountCents: 30_000,
      installmentsCount: 3,
      firstDueDate: isoDaysFromToday(15),
    },
  });
  await page.goto("/");
  await expect(
    page.getByRole("region", { name: "Próximos 30 dias" }).getByRole("link", {
      name: FAR_ROW,
    })
  ).toBeVisible();
  // The guide (2 of 3, the PIX key is next) already answers "what now".
  await expect(
    page.getByRole("heading", { level: 2, name: "Cadastre sua chave PIX." })
  ).toBeVisible();
  await expect(
    page.getByText("Nada pendente agora", { exact: true })
  ).toHaveCount(0);
});

test("recebedor: Cobrar no WhatsApp leva a cobrança com o PIX, e Marcar como recebida funciona", async ({
  page,
}) => {
  await signup(page);
  await page.request.patch("/api/me", {
    data: { pixKey: "recebedor-e2e@example.com" },
  });
  await seedContract(page.request, {
    title: "Venda E2E",
    ownerRole: "seller",
    schedule: {
      mode: "auto",
      totalAmountCents: 90_000,
      installmentsCount: 3,
      firstDueDate: isoDaysFromToday(2),
    },
  });
  await page.goto("/");
  // A click before hydration lands on the server HTML and is lost.
  await waitForHydrated(page);
  const sale = card(page, "Venda E2E · 1/3");
  const whatsapp = sale.getByRole("link", { name: "Cobrar no WhatsApp" });
  await expect(whatsapp).toHaveAttribute("target", "_blank");
  const href = (await whatsapp.getAttribute("href")) ?? "";
  expect(href.startsWith(WA_PREFIX)).toBe(true);
  const text = decodeURIComponent(href.slice(WA_PREFIX.length));
  expect(text).toContain("parcela 1 de 3 de “Venda E2E”");
  expect(text).toContain("Pix copia e cola:");
  expect(text).toContain("000201");
  await sale.getByRole("button", { name: "Marcar como recebida" }).click();
  await expect(
    page.getByText("Parcela marcada como recebida", { exact: true })
  ).toBeVisible();
  await expect(sale).toHaveCount(0);
});

test("convites no Agora: recusar e aceitar ali mesmo, e o recusado não volta", async ({
  browser,
}) => {
  const owner = await newUser(browser);
  const guest = await newUser(browser);
  try {
    const declined = await seedContract(owner.page.request, {
      title: "Convite Recusar",
    });
    const accepted = await seedContract(owner.page.request, {
      title: "Convite Aceitar",
    });
    for (const id of [declined.id, accepted.id]) {
      await seedInvite(owner.page.request, id, {
        displayName: "Vendedor",
        role: "seller",
        email: guest.email,
      });
    }
    await guest.page.goto("/");
    // A click before hydration lands on the server HTML and is lost.
    await waitForHydrated(guest.page);
    await inviteCard(guest.page, "Convite Recusar")
      .getByRole("button", { name: "Recusar" })
      .click();
    await expect(
      guest.page.getByText("Convite recusado", { exact: true })
    ).toBeVisible();
    await expect(inviteCard(guest.page, "Convite Recusar")).toHaveCount(0);
    // A deliberate tap, after the list's double-tap lock (ACTION_LOCK_MS, 700 ms):
    // a tap inside that window lands on the card that slid into place and is swallowed.
    await guest.page.waitForTimeout(800);
    await inviteCard(guest.page, "Convite Aceitar")
      .getByRole("button", { name: "Aceitar" })
      .click();
    await expect(
      guest.page.getByText("Convite aceito", { exact: true })
    ).toBeVisible();
    await expect(inviteCard(guest.page, "Convite Aceitar")).toHaveCount(0);

    await guest.page.reload();
    await waitForHydrated(guest.page);
    await expect(guest.page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(inviteCard(guest.page, "Convite Recusar")).toHaveCount(0);
    await guest.page.goto("/contracts");
    await expect(guest.page.getByText("Convite Aceitar")).toBeVisible();
  } finally {
    await owner.close();
    await guest.close();
  }
});

test("conferir comprovante: Confirmar no próprio Agora", async ({
  browser,
}) => {
  const payer = await newUser(browser);
  const approver = await newUser(browser);
  try {
    const { id } = await seedContract(payer.page.request, {
      title: "Conferir E2E",
      ownerRole: "buyer",
      requiresConfirmation: true,
    });
    const { token } = await seedInvite(payer.page.request, id, {
      displayName: "Vendedor",
      role: "seller",
      email: approver.email,
    });
    await approver.page.goto(`/invites/${token}`);
    await waitForHydrated(approver.page);
    await approver.page.getByRole("button", { name: ACCEPT_INVITE }).click();
    await approver.page.waitForURL(`**/contracts/${id}`);
    const detail = await getContract(payer.page.request, id);
    await payer.page.goto(
      `/contracts/${id}?installment=${detail.installments[0].id}`
    );
    await waitForHydrated(payer.page);
    await payer.page.getByLabel("Comprovante").setInputFiles(PROOF_PDF);
    await payer.page
      .getByRole("button", { name: "Enviar comprovante" })
      .click();
    await expect(
      payer.page.getByLabel("Parcela").getByText("aguardando")
    ).toBeVisible();

    await approver.page.goto("/");
    await waitForHydrated(approver.page);
    const review = card(approver.page, "Conferir E2E · 1/3");
    await expect(
      review.getByText("Faça primeiro · aguarda você")
    ).toBeVisible();
    await review.getByRole("button", { name: "Confirmar" }).click();
    await expect(
      approver.page.getByText("Pagamento confirmado", { exact: true })
    ).toBeVisible();
    await expect(review).toHaveCount(0);
  } finally {
    await payer.close();
    await approver.close();
  }
});

test("muitas ações: carrossel com 1 de N no celular e Ver todas no desktop", async ({
  page,
}, testInfo) => {
  await signup(page);
  await seedContract(page.request, {
    title: "Muitas E2E",
    schedule: {
      mode: "custom",
      installments: [-40, -30, -20, -10, -5].map((days) => ({
        amountCents: 10_000,
        dueDate: isoDaysFromToday(days),
      })),
    },
  });
  await page.goto("/");
  // A click before hydration lands on the server HTML and is lost.
  await waitForHydrated(page);
  await expect(card(page, "Muitas E2E · 1/5")).toBeVisible();
  if (testInfo.project.name === "mobile") {
    await expect(page.getByText("1 de 5")).toBeVisible();
    // the next card peeks at the edge, the last one is off screen
    await expect(card(page, "Muitas E2E · 2/5")).toBeInViewport();
    await expect(card(page, "Muitas E2E · 5/5")).not.toBeInViewport();
    await expectNoPageScrollX(page);
    // keyboard reaches every card: focusing a button in an off-screen card scrolls it in
    await card(page, "Muitas E2E · 5/5")
      .getByRole("button", { name: "Já paguei" })
      .focus();
    await expect(card(page, "Muitas E2E · 5/5")).toBeInViewport();
    await page.getByRole("button", { name: "Ver todas", exact: true }).click();
    const last = card(page, "Muitas E2E · 5/5");
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    await expect(page.getByText("1 de 5")).toHaveCount(0);
    await expectNoPageScrollX(page);
  } else {
    await expect(card(page, "Muitas E2E · 4/5")).toBeHidden();
    await page.getByRole("button", { name: "Ver todas (5)" }).click();
    await expect(card(page, "Muitas E2E · 4/5")).toBeVisible();
    await expect(card(page, "Muitas E2E · 5/5")).toBeVisible();
  }
});

test.describe("tablet a 800 px", () => {
  test.use({ viewport: { width: 800, height: 1000 } });

  test("o carrossel de 5 ações ao lado da sidebar não faz a página rolar de lado", async ({
    page,
  }, testInfo) => {
    // biome-ignore lint/suspicious/noSkippedTests: the mobile project has its own viewport
    test.skip(
      testInfo.project.name === "mobile",
      "o projeto mobile tem viewport própria"
    );
    await signup(page);
    await seedContract(page.request, {
      title: "Tablet E2E",
      schedule: {
        mode: "custom",
        installments: [-40, -30, -20, -10, -5].map((days) => ({
          amountCents: 10_000,
          dueDate: isoDaysFromToday(days),
        })),
      },
    });
    await page.goto("/");
    await waitForHydrated(page);
    // Below lg it is still the carousel, now beside the sidebar.
    await expect(card(page, "Tablet E2E · 1/5")).toBeVisible();
    await expect(page.getByText("1 de 5")).toBeVisible();
    await expectNoPageScrollX(page);
  });
});

test.describe("desktop a 1024 px", () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test("a grade de 3 cartões cabe no painel ao lado da sidebar", async ({
    page,
  }, testInfo) => {
    // biome-ignore lint/suspicious/noSkippedTests: the mobile project has its own viewport
    test.skip(
      testInfo.project.name === "mobile",
      "o projeto mobile tem viewport própria"
    );
    await signup(page);
    await seedContract(page.request, {
      title: "Grade E2E",
      schedule: {
        mode: "custom",
        installments: [-30, -20, -10].map((days) => ({
          amountCents: 10_000,
          dueDate: isoDaysFromToday(days),
        })),
      },
    });
    await page.goto("/");
    for (const n of [1, 2, 3]) {
      await expect(card(page, `Grade E2E · ${n}/3`)).toBeInViewport();
    }
    // From lg the cards are a grid: no carousel counter, nothing past the panel's edge.
    await expect(page.getByText("1 de 3")).toBeHidden();
    const overflows = await page
      .locator("#conteudo")
      .evaluate((main) => main.scrollWidth > main.clientWidth);
    expect(overflows).toBe(false);
  });
});

// Tela larga (mockup 12, estrutura B; Desvio 21). Six overdue installments:
// more than any row holds, so "Ver todas (6)" stays at every width.
const WIDE_DAYS = [-50, -40, -30, -20, -10, -5];

async function seedWide(page: Page) {
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
  return id;
}

/** The element's box; it must be on screen. */
async function box(locator: Locator) {
  const found = await locator.boundingBox();
  expect(found).not.toBeNull();
  return found as NonNullable<typeof found>;
}

for (const { width, perRow } of [
  { width: 1440, perRow: 3 },
  { width: 1660, perRow: 4 },
  { width: 1920, perRow: 5 },
  { width: 2560, perRow: 5 },
]) {
  test.describe(`tela larga a ${width} px`, () => {
    test.use({ viewport: { width, height: 1000 } });

    test("a moldura acompanha a tela, a sidebar tem 232 px e as ações crescem por colunas", async ({
      page,
    }, testInfo) => {
      // biome-ignore lint/suspicious/noSkippedTests: the mobile project has its own viewport
      test.skip(
        testInfo.project.name === "mobile",
        "o projeto mobile tem viewport própria"
      );
      await seedWide(page);
      // Structure B: the sidebar on the canvas at the left edge, the panel up to 12 px from the right edge.
      const sidebar = await box(page.getByRole("complementary"));
      expect(sidebar.x).toBe(0);
      expect(sidebar.width).toBe(232);
      const viewportWidth = await page.evaluate(
        () => document.documentElement.clientWidth
      );
      const main = await box(page.locator("#conteudo"));
      expect(main.x).toBeCloseTo(232, 0);
      expect(main.x + main.width).toBeCloseTo(viewportWidth - 12, 0);
      // One row of cards, never wider ones: 3 up to 1535, 4 up to 1839, 5 from 1840.
      const row = page.getByRole("article").filter({ visible: true });
      await expect(row).toHaveCount(perRow);
      const tops = await row.evaluateAll((cards) =>
        cards.map((el) => Math.round(el.getBoundingClientRect().top))
      );
      expect(new Set(tops).size).toBe(1);
      await expect(
        page.getByRole("button", { name: "Ver todas (6)" })
      ).toBeVisible();
      // The side column exists from 1440.
      await expect(
        page.getByRole("region", { name: "Notificações recentes" })
      ).toBeVisible();
      const overflows = await page
        .locator("#conteudo")
        .evaluate((el) => el.scrollWidth > el.clientWidth);
      expect(overflows).toBe(false);
    });
  });
}

test.describe("tela larga a 2560 px: o teto do conteúdo", () => {
  test.use({ viewport: { width: 2560, height: 1200 } });

  test("o conteúdo para em 1840 px, centralizado no painel", async ({
    page,
  }, testInfo) => {
    // biome-ignore lint/suspicious/noSkippedTests: the mobile project has its own viewport
    test.skip(
      testInfo.project.name === "mobile",
      "o projeto mobile tem viewport própria"
    );
    await seedWide(page);
    const main = await box(page.locator("#conteudo"));
    // The greeting row spans the content column: h1 on the left, "+ Novo contrato" on the right.
    const title = await box(page.getByRole("heading", { level: 1 }));
    const shortcut = await box(
      page.locator("#conteudo").getByRole("link", { name: "Novo contrato" })
    );
    const left = title.x;
    const right = shortcut.x + shortcut.width;
    expect(right - left).toBeCloseTo(1840, 0);
    expect(left - main.x).toBeCloseTo(main.x + main.width - right, 0);
  });
});

test.describe("Notificações recentes só a partir de 1440 px", () => {
  test.use({ viewport: { width: 1439, height: 900 } });

  test("abaixo não aparece nem busca; a partir de 1440 aparece, e Ver todas abre o painel", async ({
    page,
  }, testInfo) => {
    // biome-ignore lint/suspicious/noSkippedTests: the mobile project has its own viewport
    test.skip(
      testInfo.project.name === "mobile",
      "o projeto mobile tem viewport própria"
    );
    const calls: string[] = [];
    page.on("request", (req) => {
      if (new URL(req.url()).pathname === "/api/notifications") {
        calls.push(req.url());
      }
    });
    await seedWide(page);
    const recent = page.getByRole("region", { name: "Notificações recentes" });
    await expect(recent).toBeHidden();
    // Below lateral nothing is fetched for a block that is not on screen.
    expect(calls).toEqual([]);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(recent).toBeVisible();
    await expect.poll(() => calls.length).toBeGreaterThan(0);
    await recent.getByRole("button", { name: "Ver todas" }).click();
    await expect(
      page.getByRole("dialog", { name: "Notificações" })
    ).toBeVisible();
  });
});

test("+ Novo contrato ao lado da saudação no desktop; no celular fica o ＋ da tab bar", async ({
  page,
}, testInfo) => {
  await signup(page);
  const shortcut = page
    .locator("#conteudo")
    .getByRole("link", { name: "Novo contrato" });
  if (testInfo.project.name === "mobile") {
    await expect(shortcut).toBeHidden();
  } else {
    await shortcut.click();
    await page.waitForURL("**/contracts/new");
  }
});

test("Próximos 30 dias: a linha abre a parcela na gaveta do contrato", async ({
  page,
}) => {
  await signup(page);
  await seedContract(page.request, {
    title: "Agenda E2E",
    schedule: {
      mode: "custom",
      installments: [
        { amountCents: 10_000, dueDate: isoDaysFromToday(3) },
        { amountCents: 10_000, dueDate: isoDaysFromToday(15) },
      ],
    },
  });
  await page.goto("/");
  // The 1st installment is a card (due in 3 days); the 2nd is in the list.
  await page
    .getByRole("region", { name: "Próximos 30 dias" })
    .getByRole("link", { name: AGENDA_ROW })
    .click();
  await expect(page).toHaveURL(INSTALLMENT_PARAM);
  await expect(page.getByLabel("Parcela")).toBeVisible();
});

test("cold start: o shell e a saudação aparecem na hora, e a seção carrega depois", async ({
  page,
}) => {
  await signup(page);
  await seedContract(page.request, { title: "Frio E2E" });
  // Every /api/home takes 6s, including the shell's badge fetch after hydration.
  await page.route("**/api/home", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 6000));
    await route.continue();
  });
  await page.goto("/contracts");
  await waitForHydrated(page);
  await nowLink(page).click();
  await expect(
    page.getByRole("heading", { level: 1, name: GREETING })
  ).toBeVisible({
    timeout: 1500,
  });
  await expect(
    page.getByRole("status").filter({ hasText: "Conectando ao servidor…" })
  ).toBeVisible({ timeout: 4500 });
  await expect(card(page, "Frio E2E · 1/3")).toBeVisible({ timeout: 10_000 });
});

test("API travada: depois do timeout, Tentar de novo recupera", async ({
  page,
}) => {
  await page.clock.install();
  await signup(page);
  await seedContract(page.request, { title: "Travada E2E" });
  let hang = true;
  await page.route("**/api/home", async (route) => {
    if (hang) {
      return; // never answers: the client aborts it at the timeout
    }
    await route.continue();
  });
  await page.goto("/contracts");
  await waitForHydrated(page);
  await nowLink(page).click();
  await expect(
    page.getByRole("heading", { level: 1, name: GREETING })
  ).toBeVisible();
  // 16 s in two jumps, as a user lives it: skeleton, then "Conectando…" at
  // 3 s, then the timeout at 15 s. One jump would also fire the link's 50 ms
  // intent preload after the abort, and its loader would refetch the home.
  await page.clock.fastForward(4000);
  await expect(
    page.getByRole("status").filter({ hasText: "Conectando ao servidor…" })
  ).toBeVisible();
  await page.clock.fastForward(12_000);
  await expect(page.getByRole("alert")).toContainText(
    "O servidor demorou para responder."
  );
  hang = false;
  await page.getByRole("button", { name: "Tentar de novo" }).click();
  await expect(card(page, "Travada E2E · 1/3")).toBeVisible();
});

test("Tentar de novo: pelo teclado o foco vai para a seção com o anel; pelo clique, sem o anel", async ({
  page,
}) => {
  await signup(page);
  await seedContract(page.request, { title: "Anel E2E" });
  let fail = true;
  await page.route("**/api/home", async (route) => {
    if (fail) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "INTERNAL", message: "falha simulada" },
        }),
      });
      return;
    }
    await route.continue();
  });
  await page.goto("/contracts");
  await waitForHydrated(page);
  await nowLink(page).click();
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível carregar esta parte."
  );
  // The button leaves with the error, so the focus moves to the section. After
  // Enter it shows the ring (the user is on the keyboard)...
  await page.getByRole("button", { name: "Tentar de novo" }).focus();
  await page.keyboard.press("Enter");
  const focused = page.locator(":focus");
  await expect(focused.getByRole("alert")).toContainText(
    "Não foi possível carregar esta parte."
  );
  await expect(focused).toHaveAttribute("tabindex", "-1");
  expect(await focused.evaluate((el) => el.matches(":focus-visible"))).toBe(
    true
  );
  // ...after a click it does not.
  fail = false;
  await page.getByRole("button", { name: "Tentar de novo" }).click();
  await expect(
    focused.getByRole("article", { name: "Anel E2E · 1/3" })
  ).toBeVisible();
  await expect(focused).toHaveAttribute("tabindex", "-1");
  expect(await focused.evaluate((el) => el.matches(":focus-visible"))).toBe(
    false
  );
});

test("SSR: a home chega no HTML em streaming e o navegador não pede /api/home", async ({
  page,
}) => {
  await signup(page);
  await seedContract(page.request, { title: "Stream E2E" });
  const homeCalls: string[] = [];
  page.on("request", (req) => {
    if (new URL(req.url()).pathname === "/api/home") {
      homeCalls.push(req.url());
    }
  });
  const hydrationWarnings: string[] = [];
  page.on("console", (msg) => {
    if (HYDRATION.test(msg.text())) {
      hydrationWarnings.push(msg.text());
    }
  });
  await page.goto("/");
  await waitForHydrated(page);
  await expect(card(page, "Stream E2E · 1/3")).toBeVisible();
  expect(homeCalls).toEqual([]);
  // The server HTML is what the browser renders: no hydration mismatch.
  expect(hydrationWarnings).toEqual([]);
  // The raw SSR response, cookie included, already carries the home.
  const html = await (await page.request.get("/")).text();
  expect(html).toContain("Stream E2E · 1/3");
});

test("idioma: o Agora em inglês", async ({ page }) => {
  await signup(page);
  await openAccountMenu(page);
  await page.getByRole("menuitemradio", { name: "English (US)" }).click();
  await page.waitForLoadState("load");
  await waitForHydrated(page);
  await expect(
    page.getByRole("heading", { level: 1, name: GREETING_EN })
  ).toBeVisible();
  await expect(page.getByText("Start here").first()).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .filter({ visible: true })
      .getByRole("link", { name: "Now" })
  ).toBeVisible();
});

test("painel de notificações: pelo clique abre sem anel; pelo teclado, Esc devolve o foco a quem abriu", async ({
  page,
}) => {
  await signup(page);
  // The bell in the phone's top bar, or the sidebar row on desktop.
  const trigger = page
    .getByRole("button", { name: "Notificações" })
    .filter({ visible: true })
    .first();
  // Pointer first, on a fresh page: a ring carried over from a keyboard focus
  // would pass on to what the panel focuses.
  const panel = await openNotifications(page);
  await expect(panel.locator(":focus")).toHaveCount(1);
  await expect(panel.locator(":focus-visible")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(panel).toBeVisible();
  await sheetAtRest(panel);
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
});

for (const theme of ["light", "dark"] as const) {
  test(`axe (${theme}): Agora com ações e o painel de notificações`, async ({
    page,
    context,
  }, testInfo) => {
    if (theme === "dark") {
      await context.addCookies([
        { name: "theme", value: "dark", url: "http://localhost:3001" },
      ]);
    }
    await signup(page);
    await page.request.patch("/api/me", {
      data: { pixKey: "axe-e2e@example.com" },
    });
    await seedContract(page.request, {
      title: "Axe pago",
      schedule: {
        mode: "auto",
        totalAmountCents: 30_000,
        installmentsCount: 3,
        firstDueDate: isoDaysFromToday(-2),
      },
    });
    await seedContract(page.request, {
      title: "Axe recebo",
      ownerRole: "seller",
      schedule: {
        mode: "auto",
        totalAmountCents: 30_000,
        installmentsCount: 3,
        firstDueDate: isoDaysFromToday(3),
      },
    });
    await page.goto("/");
    await expect(card(page, "Axe pago · 1/3")).toBeVisible();
    if (theme === "dark") {
      await expect(page.locator("html.dark")).toBeVisible();
    }
    await scan(page);
    const panel = await openNotifications(page);
    await expect(panel).toHaveAttribute(
      "data-variant",
      testInfo.project.name === "mobile" ? "bottom" : "side"
    );
    await scan(page);
  });
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`axe (${theme}) na tela larga`, () => {
    test.use({ viewport: { width: 1920, height: 1080 } });

    test("estrutura B a 1920 px: sidebar no canvas, marcos e Notificações recentes nas colunas", async ({
      page,
      context,
    }, testInfo) => {
      // biome-ignore lint/suspicious/noSkippedTests: the mobile project has its own viewport
      test.skip(
        testInfo.project.name === "mobile",
        "o projeto mobile tem viewport própria"
      );
      if (theme === "dark") {
        await context.addCookies([
          { name: "theme", value: "dark", url: "http://localhost:3001" },
        ]);
      }
      const id = await seedWide(page);
      // One installment paid this month: milestones show up in their column,
      // and the sidebar's lime card ("Mais perto de quitar") sits on the canvas.
      const detail = await getContract(page.request, id);
      const paid = await page.request.post(
        `/api/installments/${detail.installments[5].id}/mark-paid`
      );
      expect(paid.ok()).toBe(true);
      await page.reload();
      await waitForHydrated(page);
      await expect(page.getByRole("region", { name: "Marcos" })).toBeVisible();
      const recent = page.getByRole("region", {
        name: "Notificações recentes",
      });
      // Wait for the block to settle past its skeleton (aria-hidden): the empty
      // state of a new account, or the list if a reminder already landed.
      await expect(
        recent
          .getByRole("heading", { name: "Nada novo por aqui" })
          .or(recent.getByRole("list"))
      ).toBeVisible();
      await expect(
        page.getByRole("complementary").getByText("Mais perto de quitar")
      ).toBeVisible();
      if (theme === "dark") {
        await expect(page.locator("html.dark")).toBeVisible();
      }
      await scan(page);
    });
  });
}

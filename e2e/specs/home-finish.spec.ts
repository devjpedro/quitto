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
  newUser,
  openNotifications,
  scan,
  seedContract,
  seedInvite,
  signup,
  waitForHydrated,
} from "../fixtures";
import {
  box,
  card,
  chipsMeasured,
  collectHydrationErrors,
  expectNoPageScrollX,
  seedOneEach,
} from "../home-helpers";

// Top-level regex literals (lint/performance/useTopLevelRegex), without backslashes.
const WHATSAPP = /Cobrar no WhatsApp/;
const STATUS_IN_URL = /status=/;
const PAID_GROUP = /2 parcelas marcadas como pagas/;
const INVITE_ACCEPTED = /Convite aceito/;
const WA = "https://wa.me/?text=";
/** The logo's ring (ProgressRing: viewBox 24, radius 9), never a Phosphor icon (viewBox 256). */
const RING_SVG = 'svg[viewBox="0 0 24 24"]:has(circle[r="9"])';

/** Three overdue installments of one contract: one card, "parcelas 1 a 3 de 3". */
function seedOverdueGroup(
  page: Page,
  title: string,
  ownerRole: "buyer" | "seller"
) {
  return seedContract(page.request, {
    title,
    ownerRole,
    schedule: {
      mode: "custom",
      installments: [-40, -25, -10].map((days) => ({
        amountCents: 20_000,
        dueDate: isoDaysFromToday(days),
      })),
    },
  });
}

/**
 * "Moto E2E", R$ 480,00 installments you receive, due `days` from today. The
 * payer ("Rafael Prado", linked by invite) marks the first `paid` of them
 * paid: one "installment_paid" each, in a row, beside the accepted invite.
 * Returns the contract's id.
 */
async function seedPaidByInvitee(
  page: Page,
  browser: Browser,
  days: number[],
  paid: number
): Promise<string> {
  const { id } = await seedContract(page.request, {
    title: "Moto E2E",
    ownerRole: "seller",
    schedule: {
      mode: "custom",
      installments: days.map((offset) => ({
        amountCents: 48_000,
        dueDate: isoDaysFromToday(offset),
      })),
    },
  });
  const payer = await newUser(browser);
  const { token } = await seedInvite(page.request, id, {
    displayName: "Rafael Prado",
    role: "buyer",
    email: payer.email,
  });
  expect(
    (await payer.page.request.post(`/api/invites/${token}/accept`)).ok()
  ).toBeTruthy();
  const detail = await getContract(page.request, id);
  const toPay = (
    detail.installments as { id: string; sequence: number }[]
  ).filter((it) => it.sequence <= paid);
  for (const installment of toPay) {
    const marked = await payer.page.request.post(
      `/api/installments/${installment.id}/mark-paid`
    );
    expect(marked.ok()).toBeTruthy();
  }
  await payer.close();
  return id;
}

/**
 * Three installments of "Moto E2E", the two past ones paid by the payer. 2 of
 * 3 is 67%: the milestone of the moment is "Mais perto de quitar", with the
 * ring. The bell gets two "installment_paid" in a row (one line) next to the
 * accepted invite.
 */
function seedCloseToPayoff(page: Page, browser: Browser) {
  return seedPaidByInvitee(page, browser, [-60, -30, 40], 2);
}

/**
 * The milestone of the moment is "Mais perto de quitar": desktop's lime card
 * (the ring and the % on the label's line), or the phone's first Marcos cell
 * (the 44 px ring, the % on the label). Returns that ring.
 */
async function expectCloseToPayoff(
  page: Page,
  isMobile: boolean
): Promise<Locator> {
  if (isMobile) {
    const cell = page
      .getByRole("region", { name: "Marcos" })
      .getByRole("listitem")
      .first();
    // The phone's variant: the % on the label, only the name below (no fraction).
    await expect(cell).toContainText("Mais perto de quitar · 67%");
    await expect(cell).toContainText("Moto E2E");
    await expect(cell).not.toContainText("2/3");
    const ring = cell.locator(RING_SVG);
    await expect(ring).toHaveAttribute("width", "44");
    return ring;
  }
  const label = page
    .getByRole("complementary")
    .locator("p", { hasText: "Mais perto de quitar" });
  await expect(label).toContainText("67%");
  await expect(page.getByRole("complementary")).toContainText("Moto E2E · 2/3");
  const ring = label.locator(RING_SVG);
  await expect(ring).toHaveAttribute("width", "22");
  return ring;
}

async function home(page: Page) {
  await page.goto("/");
  await waitForHydrated(page);
}

/** The bell's count, as the API has it. */
async function unreadCount(page: Page): Promise<number> {
  const response = await page.request.get("/api/home");
  return ((await response.json()) as { unreadCount: number }).unreadCount;
}

test("atrasadas do mesmo contrato são um cartão; Ver parcelas abre o contrato", async ({
  page,
}, testInfo) => {
  await signup(page);
  const { id } = await seedOverdueGroup(page, "Terreno E2E", "seller");
  await home(page);
  const group = card(page, "Terreno E2E · parcelas 1 a 3 de 3");
  await expect(group).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByText("Faça primeiro · 3 atrasadas")).toBeVisible();
  // One card only: no chip row (its value is already in the card). The count
  // is the desktop's subtitle; on a phone the subtitle is the date.
  await expect(page.getByRole("list", { name: "Resumo" })).toHaveCount(0);
  if (testInfo.project.name !== "mobile") {
    await expect(page.getByText("1 coisa pede sua atenção")).toBeVisible();
  }
  await group.getByRole("link", { name: "Ver parcelas" }).click();
  await expect(page).toHaveURL(new RegExp(`/contracts/${id}$`));
  expect(page.url()).not.toMatch(STATUS_IN_URL);
});

test("Cobrar no WhatsApp de um grupo cita todas as parcelas e o total", async ({
  page,
}) => {
  await signup(page);
  await seedOverdueGroup(page, "Terreno E2E", "seller");
  await home(page);
  const href = await card(page, "Terreno E2E · parcelas 1 a 3 de 3")
    .getByRole("link", { name: WHATSAPP })
    .getAttribute("href");
  expect(href?.startsWith(WA)).toBe(true);
  expect(decodeURIComponent(href?.slice(WA.length) ?? "")).toContain(
    "As parcelas 1 a 3 de “Terreno E2E” estão em aberto, somando R$ 600,00"
  );
});

test("grupo que você paga: Pagar a mais antiga abre a gaveta na mais antiga", async ({
  page,
}) => {
  await signup(page);
  const { id } = await seedOverdueGroup(page, "Aluguel E2E", "buyer");
  const detail = await getContract(page.request, id);
  const oldest = detail.installments.find(
    (it: { sequence: number }) => it.sequence === 1
  ) as { id: string };
  await home(page);
  const group = card(page, "Aluguel E2E · parcelas 1 a 3 de 3");
  await expect(group.getByRole("button", { name: "Já paguei" })).toHaveCount(0);
  await expect(
    group.getByRole("link", { name: "Ver parcelas" })
  ).toHaveAttribute("href", `/contracts/${id}`);
  await group.getByRole("link", { name: "Pagar a mais antiga" }).click();
  await expect(page).toHaveURL(new RegExp(`installment=${oldest.id}`));
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("avisos iguais seguidos são uma linha; ler a linha lê o grupo", async ({
  browser,
  page,
}) => {
  await signup(page);
  // The payer, linked by invite, marks both installments paid: two
  // "installment_paid" in a row for the receiver.
  const id = await seedPaidByInvitee(page, browser, [5, 35], 2);
  await home(page);
  // The two "installment_paid" (one line) and the accepted invite (a line of
  // its own, another type): reading the group must leave the invite unread.
  const before = await unreadCount(page);
  const panel = await openNotifications(page);
  const row = panel.getByRole("button", { name: PAID_GROUP });
  await expect(row).toContainText("Nova");
  await expect(
    panel.getByRole("button", { name: INVITE_ACCEPTED })
  ).toContainText("Nova");
  await row.click();
  // A group of paid notices opens its contract as it is: no ?status= (decision 13).
  await expect(page).toHaveURL(new RegExp(`/contracts/${id}$`));
  expect(page.url()).not.toMatch(STATUS_IN_URL);
  // Reading the line read its two notices, and only them.
  await expect.poll(() => unreadCount(page)).toBe(before - 2);
  const again = await openNotifications(page);
  await expect(
    again.getByRole("button", { name: PAID_GROUP })
  ).not.toContainText("Nova");
  await expect(
    again.getByRole("button", { name: INVITE_ACCEPTED })
  ).toContainText("Nova");
  await page.keyboard.press("Escape");
  await expect(again).toBeHidden();
});

test.describe("tela larga", () => {
  // biome-ignore lint/suspicious/noSkippedTests: desktop layout rules; the mobile project runs the phone cases
  test.skip(({ isMobile }) => isMobile, "regras do desktop");

  test("sidebar: contratos ativos com anel, os mais recentes em cima, e Ver todos (N)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1512, height: 860 });
    await signup(page);
    await seedOneEach(page.request, "Ativo E2E", [20, 21, 22, 23, 24, 25]);
    await home(page);
    const list = page.getByRole("list", { name: "Contratos ativos" });
    await expect(list.getByRole("link")).toHaveCount(5);
    const newest = list.getByRole("link").first();
    await expect(newest).toContainText("Ativo E2E 6");
    // Every row has the logo's ring. Nothing paid: the track alone (no arc)
    // and the fraction beside it says the same, 0/1.
    await expect(list.locator(RING_SVG)).toHaveCount(5);
    const ring = newest.locator(RING_SVG);
    await expect(ring).toBeVisible();
    await expect(ring.locator("circle")).toHaveCount(1);
    await expect(newest).toContainText("0/1");
    await expect(
      page.getByRole("link", { name: "Ver todos (6)" })
    ).toHaveAttribute("href", "/contracts");
  });

  test("poucas ações a 1512 e 1920: Próximos 30 dias na linha das ações, sem esticar cartão e sem divergência de hidratação", async ({
    page,
  }) => {
    const hydrationErrors = collectHydrationErrors(page);
    await signup(page);
    await seedContract(page.request, {
      title: "Pouco E2E",
      ownerRole: "seller",
      schedule: {
        mode: "custom",
        installments: [-10, 12, 20].map((days) => ({
          amountCents: 30_000,
          dueDate: isoDaysFromToday(days),
        })),
      },
    });
    const fewWidths = new Map<number, number>();
    for (const width of [1512, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await home(page);
      const first = await box(card(page, "Pouco E2E · parcela 1 de 3"));
      const upcoming = await box(
        page.getByRole("region", { name: "Próximos 30 dias" })
      );
      expect(Math.abs(upcoming.y - first.y)).toBeLessThan(4);
      expect(upcoming.x).toBeGreaterThan(first.x + first.width);
      fewWidths.set(width, first.width);
      await expectNoPageScrollX(page);
    }
    // The same account with 3 cards: the first card keeps the width it had
    // alone (the row uses the action grid's tracks; nothing stretches).
    await seedOneEach(page.request, "Mais E2E", [-20, -15], "seller");
    for (const width of [1512, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await home(page);
      await expect(page.getByRole("article")).toHaveCount(3);
      const first = await box(page.getByRole("article").first());
      expect(Math.abs(first.width - (fewWidths.get(width) ?? 0))).toBeLessThan(
        2
      );
    }
    // The few-actions row is decided by the data, so the server HTML and the hydration agree.
    expect(hydrationErrors).toEqual([]);
  });

  test("três ações: a lista fica embaixo, como antes", async ({ page }) => {
    await page.setViewportSize({ width: 1512, height: 900 });
    await signup(page);
    await seedOneEach(page.request, "Três E2E", [-30, -20, -10]);
    await home(page);
    const first = await box(card(page, "Três E2E 1 · parcela 1 de 1"));
    const upcoming = await box(
      page.getByRole("region", { name: "Próximos 30 dias" })
    );
    expect(upcoming.y).toBeGreaterThan(first.y + first.height);
  });

  test("a 1024 o cartão estreito empilha os botões, cada um na largura toda (O2)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await signup(page);
    await seedOneEach(page.request, "Estreito E2E", [-30, -20, -10], "seller");
    await home(page);
    const narrow = card(page, "Estreito E2E 2 · parcela 1 de 1");
    const whatsapp = await box(narrow.getByRole("link", { name: WHATSAPP }));
    const received = await box(
      narrow.getByRole("button", { name: "Marcar como recebida" })
    );
    // The pair does not fit a ~200 px card (decision 16, O2): one under the
    // other, each the card's full width.
    expect(received.y).toBeGreaterThan(whatsapp.y + 4);
    expect(Math.abs(whatsapp.width - received.width)).toBeLessThan(2);
    expect(whatsapp.width).toBeGreaterThan((await box(narrow)).width - 40);
  });
});

test("celular: o cartão é branco sobre o fundo, e Ver parcelas vira um ícone de 44 px com nome", async ({
  page,
}, testInfo) => {
  // biome-ignore lint/suspicious/noSkippedTests: the phone layout exists only in the mobile project
  test.skip(testInfo.project.name !== "mobile", "só no celular");
  await signup(page);
  await seedOverdueGroup(page, "Terreno E2E", "seller");
  await seedOneEach(page.request, "Outro E2E", [-5], "seller");
  await home(page);
  const see = card(page, "Terreno E2E · parcelas 1 a 3 de 3").getByRole(
    "link",
    {
      name: "Ver parcelas",
    }
  );
  const icon = await box(see);
  expect(Math.round(icon.width)).toBe(44);
  expect(Math.round(icon.height)).toBe(44);
  await expect(card(page, "Outro E2E 1 · parcela 1 de 1")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)"
  );
  await expect(page.locator("#app-shell")).toHaveCSS(
    "background-color",
    "rgb(241, 240, 235)"
  );
  await expectNoPageScrollX(page);
});

test("celular: o chip de atraso aparece com 2 cartões a receber, numa linha; a página não rola", async ({
  page,
}, testInfo) => {
  // biome-ignore lint/suspicious/noSkippedTests: the chip strip is measured at the phone's width
  test.skip(testInfo.project.name !== "mobile", "só no celular");
  // The strip's tab stop is the client's (the server cannot measure): it must
  // not make the hydration diverge.
  const hydrationErrors = collectHydrationErrors(page);
  await signup(page);
  // Two overdue cards to receive (two contracts): the only case with a chip.
  await seedOverdueGroup(page, "Terreno E2E", "seller");
  await seedOverdueGroup(page, "Notebook E2E", "seller");
  await home(page);
  const strip = page.getByRole("list", { name: "Resumo" });
  const chips = strip.getByRole("listitem");
  await expect(chips).toHaveCount(1);
  await expect(chips).toContainText("a receber em atraso");
  // One line, and one chip does not scroll: no tab stop on the strip.
  expect(await strip.getAttribute("tabindex")).toBeNull();
  expect(await strip.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
    false
  );
  await expectNoPageScrollX(page);
  await scan(page);
  expect(hydrationErrors).toEqual([]);
});

test("celular: a última linha de Próximos 30 dias, focada pelo teclado, nunca fica sob a tab bar", async ({
  page,
}, testInfo) => {
  // biome-ignore lint/suspicious/noSkippedTests: the fixed tab bar exists only at the phone's width
  test.skip(testInfo.project.name !== "mobile", "só no celular");
  await signup(page);
  // Eight installments ahead (none is an action yet): the list runs past the screen.
  await seedOneEach(
    page.request,
    "Agenda E2E",
    [10, 12, 14, 16, 18, 20, 22, 24]
  );
  await home(page);
  const rows = page
    .getByRole("region", { name: "Próximos 30 dias" })
    .getByRole("link");
  await expect(rows).toHaveCount(8);
  const bar = await box(
    page
      .getByRole("navigation", { name: "Navegação principal" })
      .filter({ visible: true })
  );
  // The last row right behind the fixed bar, still inside the viewport: the
  // case scroll-padding is for. Without it the browser sees the row as
  // visible, and the focus would leave it under the bar.
  await rows.last().evaluate((el) => {
    const bottom = el.getBoundingClientRect().bottom + window.scrollY;
    window.scrollTo({
      top: bottom - window.innerHeight + 4,
      behavior: "instant",
    });
  });
  const behind = await box(rows.last());
  expect(behind.y + behind.height).toBeGreaterThan(bar.y);
  // Tab into it from the row before, as a keyboard user does.
  await rows
    .nth(6)
    .evaluate((el) => (el as HTMLElement).focus({ preventScroll: true }));
  await page.keyboard.press("Tab");
  await expect(rows.last()).toBeFocused();
  const row = await box(rows.last());
  expect(row.y).toBeGreaterThanOrEqual(0);
  expect(row.y + row.height).toBeLessThanOrEqual(bar.y);
});

test("marco do momento: 2 de 3 pagas é Mais perto de quitar, com o anel da logo no tanto pago", async ({
  browser,
  page,
}, testInfo) => {
  await signup(page);
  await seedCloseToPayoff(page, browser);
  await home(page);
  const isMobile = testInfo.project.name === "mobile";
  const ring = await expectCloseToPayoff(page, isMobile);
  // The ring is the paid share: the track and an arc of 67% of the circle
  // (2 pi 9 = 56.55), from the top.
  await expect(ring.locator("circle")).toHaveCount(2);
  await expect(ring.locator("circle").last()).toHaveAttribute(
    "stroke-dasharray",
    "37.89 56.55"
  );
  // The sidebar's card says what is left, and the next date (40 days ahead);
  // the phone's cell is short and does not.
  if (!isMobile) {
    await expect(
      page
        .getByRole("complementary")
        .getByText("Falta 1 parcela, em", { exact: false })
    ).toBeVisible();
  }
});

test("axe em claro e escuro com grupo, chips de atraso, marcos e notificações", async ({
  browser,
  context,
  page,
}, testInfo) => {
  await signup(page);
  await seedOverdueGroup(page, "Terreno E2E", "seller");
  await seedOneEach(page.request, "Aluguel E2E", [-2, 12], "buyer");
  // Milestones (the lime one with the ring) and a grouped line in the bell.
  await seedCloseToPayoff(page, browser);
  const isMobile = testInfo.project.name === "mobile";
  await home(page);
  for (const theme of ["light", "dark"] as const) {
    if (theme === "dark") {
      await context.addCookies([
        { name: "theme", value: "dark", url: "http://localhost:3001" },
      ]);
      await page.reload();
      await waitForHydrated(page);
      await expect(page.locator("html.dark")).toBeVisible();
    }
    await expect(page.getByRole("region", { name: "Marcos" })).toBeVisible();
    await expectCloseToPayoff(page, isMobile);
    await chipsMeasured(page);
    await scan(page);
    // The bell's panel over it, with the grouped line (the count on its tile)
    // next to the invite's own line.
    const panel = await openNotifications(page);
    await expect(panel.getByRole("button", { name: PAID_GROUP })).toBeVisible();
    await expect(
      panel.getByRole("button", { name: INVITE_ACCEPTED })
    ).toBeVisible();
    await scan(page);
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
  }
});

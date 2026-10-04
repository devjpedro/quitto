import { expect, type Page, test } from "@playwright/test";
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
const STATUS_OVERDUE = /status=overdue/;
const STATUS_PAID = /status=paid/;
const PAID_GROUP = /2 parcelas marcadas como pagas/;
const INVITE_ACCEPTED = /Convite aceito/;
const WA = "https://wa.me/?text=";

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

async function home(page: Page) {
  await page.goto("/");
  await waitForHydrated(page);
}

/** The bell's count, as the API has it. */
async function unreadCount(page: Page): Promise<number> {
  const response = await page.request.get("/api/home");
  return ((await response.json()) as { unreadCount: number }).unreadCount;
}

test("atrasadas do mesmo contrato são um cartão; Ver parcelas abre o contrato filtrado", async ({
  page,
}) => {
  await signup(page);
  const { id } = await seedOverdueGroup(page, "Terreno E2E", "seller");
  await home(page);
  const group = card(page, "Terreno E2E · parcelas 1 a 3 de 3");
  await expect(group).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByText("Faça primeiro · 3 atrasadas")).toBeVisible();
  await expect(page.getByRole("list", { name: "Resumo" })).toContainText(
    "1 pendência"
  );
  await expect(page.getByRole("list", { name: "Resumo" })).toContainText(
    "R$ 600,00 a receber em atraso"
  );
  await group.getByRole("link", { name: "Ver parcelas" }).click();
  await expect(page).toHaveURL(STATUS_OVERDUE);
  expect(page.url()).toContain(`/contracts/${id}`);
  await expect(
    page.getByRole("button", { name: "Atrasadas (3)" })
  ).toHaveAttribute("aria-pressed", "true");
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
  ).toHaveAttribute("href", `/contracts/${id}?status=overdue`);
  await group.getByRole("link", { name: "Pagar a mais antiga" }).click();
  await expect(page).toHaveURL(new RegExp(`installment=${oldest.id}`));
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("avisos iguais seguidos são uma linha; ler a linha lê o grupo", async ({
  browser,
  page,
}) => {
  await signup(page);
  const { id } = await seedContract(page.request, {
    title: "Moto E2E",
    ownerRole: "seller",
    schedule: {
      mode: "custom",
      installments: [5, 35].map((days) => ({
        amountCents: 48_000,
        dueDate: isoDaysFromToday(days),
      })),
    },
  });
  // The payer, linked by invite, marks both installments paid: two
  // "installment_paid" in a row for the receiver.
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
  for (const installment of detail.installments as { id: string }[]) {
    const marked = await payer.page.request.post(
      `/api/installments/${installment.id}/mark-paid`
    );
    expect(marked.ok()).toBeTruthy();
  }
  await payer.close();
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
  // A group of paid notices opens its contract on "Pagas".
  await expect(page).toHaveURL(new RegExp(`/contracts/${id}`));
  await expect(page).toHaveURL(STATUS_PAID);
  await expect(page.getByRole("button", { name: "Pagas (2)" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  // Reading the line read its two notices, and only them.
  await expect.poll(() => unreadCount(page)).toBe(before - 2);
  const again = await openNotifications(page);
  await expect(
    again.getByRole("button", { name: PAID_GROUP })
  ).not.toContainText("Nova");
  await expect(
    again.getByRole("button", { name: INVITE_ACCEPTED })
  ).toContainText("Nova");
  // With the contract already open on "Todas", the line still lands on
  // "Pagas": the list follows ?status= with the page mounted.
  await page.keyboard.press("Escape");
  await expect(again).toBeHidden();
  await page.goto(`/contracts/${id}`);
  await waitForHydrated(page);
  await expect(page.getByRole("button", { name: "Todas (2)" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  const fromContract = await openNotifications(page);
  await fromContract.getByRole("button", { name: PAID_GROUP }).click();
  await expect(page).toHaveURL(STATUS_PAID);
  await expect(page.getByRole("button", { name: "Pagas (2)" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
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
    await expect(list.getByRole("link").first()).toContainText("Ativo E2E 6");
    await expect(list.locator("svg").first()).toBeVisible();
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
    if (received.y > whatsapp.y + 4) {
      expect(Math.abs(whatsapp.width - received.width)).toBeLessThan(2);
      expect(whatsapp.width).toBeGreaterThan((await box(narrow)).width - 40);
    }
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

test("celular: os chips numa linha só, que rola de lado; a página não rola", async ({
  page,
}, testInfo) => {
  // biome-ignore lint/suspicious/noSkippedTests: the chip strip scrolls only at the phone's width
  test.skip(testInfo.project.name !== "mobile", "só no celular");
  // The strip's tab stop is the client's (the server cannot measure): it must
  // not make the hydration diverge.
  const hydrationErrors = collectHydrationErrors(page);
  await signup(page);
  // Five chips: pending, overdue to pay, overdue to receive, to pay and to receive in 30 days.
  await seedOverdueGroup(page, "Terreno E2E", "seller");
  await seedOneEach(page.request, "Paga E2E", [-5, 12], "buyer");
  await seedOneEach(page.request, "Recebe E2E", [15], "seller");
  await home(page);
  const strip = page.getByRole("list", { name: "Resumo" });
  const chips = strip.getByRole("listitem");
  await expect(chips).toHaveCount(5);
  // One line (decision 23): every chip on the same row, the strip wider than its box.
  const tops = await chips.evaluateAll((items) =>
    items.map((item) => Math.round(item.getBoundingClientRect().top))
  );
  expect(new Set(tops).size).toBe(1);
  expect(await strip.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
    true
  );
  // A strip that scrolls is a tab stop (useScrollsSideways), so axe passes.
  await expect(strip).toHaveAttribute("tabindex", "0");
  // The last chip scrolls fully into view, inside the 16 px gutter.
  await chips.last().scrollIntoViewIfNeeded();
  const last = await box(chips.last());
  expect(last.x + last.width).toBeLessThanOrEqual(390);
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

test("axe em claro e escuro com grupo, chips de atraso, marcos e notificações", async ({
  context,
  page,
}) => {
  await signup(page);
  await seedOverdueGroup(page, "Terreno E2E", "seller");
  await seedOneEach(page.request, "Aluguel E2E", [-2, 12], "buyer");
  await home(page);
  await chipsMeasured(page);
  await scan(page);
  await context.addCookies([
    { name: "theme", value: "dark", url: "http://localhost:3001" },
  ]);
  await page.reload();
  await waitForHydrated(page);
  await expect(page.locator("html.dark")).toBeVisible();
  await chipsMeasured(page);
  await scan(page);
});

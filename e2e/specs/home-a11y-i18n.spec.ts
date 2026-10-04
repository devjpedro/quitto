import { expect, test } from "@playwright/test";
import {
  getContract,
  isoDaysFromToday,
  openAccountMenu,
  openNotifications,
  scan,
  seedContract,
  sheetAtRest,
  signup,
  waitForHydrated,
} from "../fixtures";
import { card, chipsMeasured, seedWide } from "../home-helpers";

const GREETING_EN = /^(Good morning|Good afternoon|Good evening), Usuário$/;
const PAID_THIS_MONTH = /Pago em /;

test("idioma: o Agora em inglês", async ({ page }) => {
  await signup(page);
  await openAccountMenu(page);
  await page.getByRole("menuitemradio", { name: "English (US)" }).click();
  await page.waitForLoadState("load");
  await waitForHydrated(page);
  await expect(
    page.getByRole("heading", { level: 1, name: GREETING_EN })
  ).toBeVisible();
  // The desktop sidebar's moment card says it too; on a phone it is hidden.
  await expect(
    page.getByText("Start here").filter({ visible: true }).first()
  ).toBeVisible();
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
    await expect(card(page, "Axe pago · parcela 1 de 3")).toBeVisible();
    if (theme === "dark") {
      await expect(page.locator("html.dark")).toBeVisible();
    }
    await chipsMeasured(page);
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
      const { hydrationErrors, id } = await seedWide(page);
      // One installment paid this month (the first contract's only one):
      // milestones show up in their column, and the sidebar's lime card
      // ("Pago em …") sits on the canvas.
      const detail = await getContract(page.request, id);
      const paid = await page.request.post(
        `/api/installments/${detail.installments[0].id}/mark-paid`
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
        page.getByRole("complementary").getByText(PAID_THIS_MONTH)
      ).toBeVisible();
      if (theme === "dark") {
        await expect(page.locator("html.dark")).toBeVisible();
      }
      // The richest layout (side column, milestones) hydrates cleanly too.
      expect(hydrationErrors).toEqual([]);
      await scan(page);
    });
  });
}

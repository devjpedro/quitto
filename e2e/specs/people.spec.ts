import { expect, test } from "@playwright/test";
import {
  scan,
  sheetAtRest,
  signup,
  twoParties,
  waitForHydrated,
} from "../fixtures";
import { expectNoPageScrollX } from "../home-helpers";

const PERSON_PARAM = /[?&]person=/;

test("duas contas: cada uma vê a outra, com o saldo do lado certo", async ({
  browser,
}) => {
  // The owner sells (Rafael pays): the owner sees "Te deve", Rafael sees "Você deve".
  const parties = await twoParties(browser, {
    ownerRole: "seller",
    requiresConfirmation: false,
    firstDueDaysFromToday: 5,
    count: 3,
  });
  try {
    await parties.owner.page.goto("/people");
    await waitForHydrated(parties.owner.page);
    const ownerCard = parties.owner.page
      .locator('[data-testid^="person-card-"]')
      .filter({ hasText: "Rafael Prado" })
      .first();
    await expect(ownerCard).toContainText("Te deve");
    await expect(ownerCard).toContainText("R$ 1.440,00");

    await parties.other.page.goto("/people");
    await waitForHydrated(parties.other.page);
    const otherCard = parties.other.page
      .locator('[data-testid^="person-card-"]')
      .filter({ hasText: "Usuário E2E" })
      .first();
    await expect(otherCard).toContainText("Você deve");
  } finally {
    await parties.owner.close();
    await parties.other.close();
  }
});

test("o sheet lista o contrato e leva a ele", async ({ browser }) => {
  const parties = await twoParties(browser, {
    ownerRole: "seller",
    requiresConfirmation: false,
    firstDueDaysFromToday: 5,
    count: 3,
  });
  try {
    const { page } = parties.owner;
    await page.goto("/people");
    await waitForHydrated(page);
    const card = page
      .locator('[data-testid^="person-card-"]')
      .filter({ hasText: "Rafael Prado" })
      .first();
    await card.click();
    await expect(page).toHaveURL(PERSON_PARAM);
    const sheet = page.getByRole("dialog");
    await sheetAtRest(sheet);
    await sheet.getByTestId(`person-contract-${parties.id}`).click();
    await page.waitForURL(`**/contracts/${parties.id}`);
  } finally {
    await parties.owner.close();
    await parties.other.close();
  }
});

test("vazio: Ninguém por aqui ainda", async ({ page }) => {
  await signup(page);
  await page.goto("/people");
  await waitForHydrated(page);
  await expect(page.getByTestId("people-empty")).toContainText(
    "Ninguém por aqui ainda"
  );
});

test("celular: nada transborda", async ({ browser }, testInfo) => {
  // biome-ignore lint/suspicious/noSkippedTests: nada transborda só importa no celular
  test.skip(testInfo.project.name !== "mobile", "só no projeto mobile");
  const parties = await twoParties(browser, {
    ownerRole: "seller",
    requiresConfirmation: false,
    firstDueDaysFromToday: -3,
    count: 3,
  });
  try {
    await parties.owner.page.goto("/people");
    await waitForHydrated(parties.owner.page);
    await expect(
      parties.owner.page.locator('[data-testid^="person-card-"]').first()
    ).toBeVisible();
    await expectNoPageScrollX(parties.owner.page);
  } finally {
    await parties.owner.close();
    await parties.other.close();
  }
});

test("axe em claro e escuro (a grade e o sheet aberto)", async ({
  browser,
}) => {
  const parties = await twoParties(browser, {
    ownerRole: "seller",
    requiresConfirmation: false,
    firstDueDaysFromToday: -3,
    count: 3,
  });
  try {
    const { page } = parties.owner;
    await page.goto("/people");
    await waitForHydrated(page);
    const card = page.locator('[data-testid^="person-card-"]').first();
    await expect(card).toBeVisible();
    await scan(page);
    await card.click();
    await sheetAtRest(page.getByRole("dialog"));
    await scan(page);

    await page
      .context()
      .addCookies([
        { name: "theme", value: "dark", url: "http://localhost:3001" },
      ]);
    await page.goto("/people");
    await waitForHydrated(page);
    await expect(page.locator("html.dark")).toBeVisible();
    await expect(card).toBeVisible();
    await scan(page);
    await card.click();
    await sheetAtRest(page.getByRole("dialog"));
    await scan(page);
  } finally {
    await parties.owner.close();
    await parties.other.close();
  }
});

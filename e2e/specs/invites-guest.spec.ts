import { expect, test } from "@playwright/test";
import {
  newUser,
  randomEmail,
  scan,
  seedContract,
  seedInvite,
  waitForHydrated,
} from "../fixtures";

const TITLE = "Viagem para Floripa (dividida)";

test("sem login: vê o convite, cria a conta e volta para aceitar", async ({
  browser,
}) => {
  const a = await newUser(browser);
  const context = await browser.newContext();
  const guest = await context.newPage();
  try {
    const { id } = await seedContract(a.page.request, {
      title: TITLE,
      ownerRole: "seller",
    });
    const email = randomEmail();
    const { token } = await seedInvite(a.page.request, id, {
      displayName: "Convidado",
      role: "buyer",
      email,
    });
    await guest.goto(`/invites/${token}`);
    await waitForHydrated(guest);
    await expect(
      guest.getByRole("heading", { level: 1, name: "Entre para responder" })
    ).toBeVisible();
    await expect(guest.getByTestId("login-invite")).toContainText(TITLE);
    await expect(guest.getByTestId("login-invite")).toContainText(
      "Você entra como quem paga."
    );
    await scan(guest);
    await guest.getByRole("link", { name: "Criar conta" }).click();
    await guest.waitForURL("**/login?**");
    await waitForHydrated(guest);
    await expect(
      guest.getByRole("heading", { name: "Crie sua conta para responder" })
    ).toBeVisible();
    await expect(guest.getByTestId("login-invite")).toContainText(TITLE);
    await guest.locator("#name").fill("Convidado E2E");
    await guest.locator("#email").fill(email);
    await guest.locator("#password").fill("password123");
    await guest
      .getByRole("button", { name: "Criar conta e ver o convite" })
      .click();
    await guest.waitForURL(`**/invites/${token}`);
    await waitForHydrated(guest);
    await guest.getByRole("button", { name: "Aceitar convite" }).click();
    await guest.waitForURL(`**/contracts/${id}`);
  } finally {
    await a.close();
    await context.close();
  }
});

test("sem login: Entrar com a conta que já existe volta para o convite", async ({
  browser,
}) => {
  const a = await newUser(browser);
  const b = await newUser(browser);
  try {
    const { id } = await seedContract(a.page.request, { title: TITLE });
    const { token } = await seedInvite(a.page.request, id, {
      displayName: "Convidado",
      role: "seller",
      email: b.email,
    });
    await b.page.context().clearCookies();
    await b.page.goto(`/invites/${token}`);
    await waitForHydrated(b.page);
    await b.page.getByRole("link", { name: "Entrar", exact: true }).click();
    await waitForHydrated(b.page);
    await expect(
      b.page.getByRole("heading", { name: "Entre para responder" })
    ).toBeVisible();
    await b.page.locator("#email").fill(b.email);
    await b.page.locator("#password").fill("password123");
    await b.page
      .getByRole("button", { name: "Entrar e ver o convite" })
      .click();
    await b.page.waitForURL(`**/invites/${token}`);
    await expect(
      b.page.getByRole("heading", { level: 1, name: TITLE })
    ).toBeVisible();
    await expect(
      b.page.getByRole("button", { name: "Aceitar convite" })
    ).toBeVisible();
  } finally {
    await a.close();
    await b.close();
  }
});

test("o convite, com e sem login, não tem violações de a11y no escuro", async ({
  browser,
}) => {
  const a = await newUser(browser);
  const b = await newUser(browser);
  const context = await browser.newContext();
  try {
    const { id } = await seedContract(a.page.request, { title: TITLE });
    const { token } = await seedInvite(a.page.request, id, {
      displayName: "Convidado",
      role: "seller",
      email: b.email,
    });
    for (const page of [b.page, await context.newPage()]) {
      await page
        .context()
        .addCookies([
          { name: "theme", value: "dark", url: "http://localhost:3001" },
        ]);
      await page.goto(`/invites/${token}`);
      await waitForHydrated(page);
      await expect(page.locator("html.dark")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await scan(page);
    }
  } finally {
    await a.close();
    await b.close();
    await context.close();
  }
});

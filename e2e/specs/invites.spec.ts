import { expect, test } from "@playwright/test";
import { newUser, randomEmail, seedContract, seedInvite } from "../fixtures";

const ACCEPT_INVITE = /Aceitar convite/i;
const WRONG_EMAIL = /Este convite é para outro e-mail/i;
const ALREADY_PARTICIPANT = /Você já participa deste contrato/i;
const INVITE_TITLE = "Convite E2E";

test("convidado com e-mail certo aceita e vê o contrato", async ({
  browser,
}) => {
  const a = await newUser(browser);
  const b = await newUser(browser);
  try {
    const { id } = await seedContract(a.page.request, { title: INVITE_TITLE });
    const { token } = await seedInvite(a.page.request, id, {
      displayName: "Vendedor",
      role: "seller",
      email: b.email,
    });
    await b.page.goto(`/invites/${token}`);
    await expect(
      b.page.getByRole("heading", { name: "Convite para um contrato" })
    ).toBeVisible();
    await b.page.getByRole("button", { name: ACCEPT_INVITE }).click();
    await b.page.waitForURL(`**/contracts/${id}`);
    await b.page.goto("/contracts");
    await expect(b.page.getByText(INVITE_TITLE)).toBeVisible();
  } finally {
    await a.close();
    await b.close();
  }
});

test("convite para outro e-mail não pode ser aceito", async ({ browser }) => {
  const a = await newUser(browser);
  const b = await newUser(browser);
  try {
    const { id } = await seedContract(a.page.request, { title: INVITE_TITLE });
    const { token } = await seedInvite(a.page.request, id, {
      displayName: "Vendedor",
      role: "seller",
      email: randomEmail(),
    });
    await b.page.goto(`/invites/${token}`);
    await expect(b.page.getByText(WRONG_EMAIL)).toBeVisible();
    await expect(
      b.page.getByRole("button", { name: ACCEPT_INVITE })
    ).toHaveCount(0);
  } finally {
    await a.close();
    await b.close();
  }
});

test("dono que já participa vê aviso de já participar", async ({ browser }) => {
  const a = await newUser(browser);
  try {
    const { id } = await seedContract(a.page.request, { title: INVITE_TITLE });
    const { token } = await seedInvite(a.page.request, id, {
      displayName: "Vendedor",
      role: "seller",
      email: randomEmail(),
    });
    await a.page.goto(`/invites/${token}`);
    await expect(a.page.getByText(ALREADY_PARTICIPANT)).toBeVisible();
    await expect(
      a.page.getByRole("button", { name: ACCEPT_INVITE })
    ).toHaveCount(0);
  } finally {
    await a.close();
  }
});

test("convite já aceito fica indisponível", async ({ browser }) => {
  const a = await newUser(browser);
  const b = await newUser(browser);
  try {
    const { id } = await seedContract(a.page.request, { title: INVITE_TITLE });
    const { token } = await seedInvite(a.page.request, id, {
      displayName: "Vendedor",
      role: "seller",
      email: b.email,
    });
    await b.page.goto(`/invites/${token}`);
    await b.page.getByRole("button", { name: ACCEPT_INVITE }).click();
    await b.page.waitForURL(`**/contracts/${id}`);
    await b.page.goto(`/invites/${token}`); // reabrir o mesmo token
    await expect(
      b.page.getByRole("heading", { name: "Convite indisponível" })
    ).toBeVisible();
    await expect(
      b.page.getByRole("button", { name: ACCEPT_INVITE })
    ).toHaveCount(0);
  } finally {
    await a.close();
    await b.close();
  }
});

test("dono gerencia participantes: remove um e troca o papel de outro", async ({
  browser,
}) => {
  const a = await newUser(browser);
  try {
    const { id } = await seedContract(a.page.request, { title: INVITE_TITLE });
    await seedInvite(a.page.request, id, {
      displayName: "Fulano",
      role: "viewer",
      email: randomEmail(),
    });
    const { participantId: ciclanoId } = await seedInvite(a.page.request, id, {
      displayName: "Ciclano",
      role: "seller",
      email: randomEmail(),
    });
    await a.page.goto(`/contracts/${id}`);
    await a.page.getByRole("button", { name: "Gerenciar" }).click();
    const drawer = a.page.getByLabel("Participantes");
    // remover Fulano
    await drawer.getByRole("button", { name: "Ações de Fulano" }).click();
    await a.page
      .getByRole("menuitem", { name: "Remover participante" })
      .click();
    await a.page
      .getByRole("dialog", { name: "Remover participante" })
      .getByRole("button", { name: "Remover", exact: true })
      .click();
    await expect(drawer.getByText("Fulano")).toHaveCount(0);
    // trocar o papel de Ciclano: vendedor → convidado
    await a.page.locator(`#role-${ciclanoId}`).click();
    await a.page.getByRole("option", { name: "convidado" }).click();
    await expect(a.page.locator(`#role-${ciclanoId}`)).toContainText(
      "convidado"
    );
  } finally {
    await a.close();
  }
});

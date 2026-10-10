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

test("o convidado vê quem convidou e as condições, e aceitar abre o contrato", async ({
  browser,
}) => {
  const a = await newUser(browser);
  const b = await newUser(browser);
  try {
    const { id } = await seedContract(a.page.request, {
      title: TITLE,
      ownerRole: "seller",
    });
    const { token } = await seedInvite(a.page.request, id, {
      displayName: "Convidado",
      role: "buyer",
      email: b.email,
    });
    await b.page.goto(`/invites/${token}`);
    await waitForHydrated(b.page);
    await expect(
      b.page.getByRole("heading", { level: 1, name: TITLE })
    ).toBeVisible();
    await expect(b.page.getByText("Você entra como quem paga.")).toBeVisible();
    await scan(b.page);
    await b.page.getByRole("button", { name: "Aceitar convite" }).click();
    await b.page.waitForURL(`**/contracts/${id}`);
    await b.page.goto(`/invites/${token}`);
    await expect(
      b.page.getByRole("heading", { name: "Você já aceitou este convite" })
    ).toBeVisible();
  } finally {
    await a.close();
    await b.close();
  }
});

test("recusar pede confirmação e a tela vira 'Você recusou'", async ({
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
    await b.page.goto(`/invites/${token}`);
    await waitForHydrated(b.page);
    await b.page.getByRole("button", { name: "Recusar", exact: true }).click();
    const dialog = b.page.getByRole("dialog", { name: "Recusar o convite?" });
    await dialog.getByRole("button", { name: "Recusar convite" }).click();
    await expect(
      b.page.getByRole("heading", { name: "Você recusou este convite" })
    ).toBeVisible();
  } finally {
    await a.close();
    await b.close();
  }
});

test("outra conta: só o e-mail mascarado e Trocar de conta", async ({
  browser,
}) => {
  const a = await newUser(browser);
  const b = await newUser(browser);
  try {
    const { id } = await seedContract(a.page.request, { title: TITLE });
    const guest = randomEmail();
    const { token } = await seedInvite(a.page.request, id, {
      displayName: "Convidado",
      role: "seller",
      email: guest,
    });
    await b.page.goto(`/invites/${token}`);
    await waitForHydrated(b.page);
    await expect(
      b.page.getByRole("heading", { name: "Este convite é para outro e-mail" })
    ).toBeVisible();
    await expect(b.page.getByText(guest)).toHaveCount(0);
    await expect(
      b.page.getByRole("button", { name: "Trocar de conta" })
    ).toBeVisible();
    await expect(
      b.page.getByRole("button", { name: "Aceitar convite" })
    ).toHaveCount(0);
  } finally {
    await a.close();
    await b.close();
  }
});

test("o dono vê o convite que mandou; reenviar mantém o link", async ({
  browser,
}) => {
  const a = await newUser(browser);
  try {
    const { id } = await seedContract(a.page.request, { title: TITLE });
    const { token } = await seedInvite(a.page.request, id, {
      displayName: "Convidado",
      role: "seller",
      email: randomEmail(),
    });
    await a.page.goto(`/invites/${token}`);
    await waitForHydrated(a.page);
    await expect(
      a.page.getByRole("heading", { name: "Este é o convite que você mandou" })
    ).toBeVisible();
    await a.page.getByRole("button", { name: "Reenviar e-mail" }).click();
    await expect(a.page.getByText("Convite reenviado")).toBeVisible();
    await a.page.goto(`/invites/${token}`);
    await expect(
      a.page.getByRole("heading", { name: "Este é o convite que você mandou" })
    ).toBeVisible();
  } finally {
    await a.close();
  }
});

test("um token que não existe: 'Este convite não existe'", async ({
  browser,
}) => {
  const a = await newUser(browser);
  try {
    await a.page.goto("/invites/nao-existe");
    await expect(
      a.page.getByRole("heading", { name: "Este convite não existe" })
    ).toBeVisible();
  } finally {
    await a.close();
  }
});

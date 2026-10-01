import { expect, test } from "@playwright/test";
import {
  getContract,
  newUser,
  seedContract,
  seedInvite,
  signup,
  waitForHydrated,
} from "../fixtures";

const CHAVE_PIX_LABEL = /chave pix/i;
const SALVAR = /salvar/i;
const CHAVE_PIX_SALVA = /chave pix salva/i;
const PAGUE_COM_PIX = /pague com pix/i;
const QR_CODE_PIX = /qr code pix/i;
const COPIAR = /^copiar$/i;
const COPIADO = /copiado/i;
const ACCEPT_INVITE = /aceitar convite/i;
const PAY_TO_SELLER = /pagar para fulano vendedor/i;

test("define chave no perfil e vê QR + copia na parcela (contrato seller)", async ({
  page,
  context,
}) => {
  await signup(page);

  // Settings → seção "Recebimento (PIX)" → preencher chave válida → Salvar
  await page.goto("/settings");
  await waitForHydrated(page);
  await page.getByLabel(CHAVE_PIX_LABEL).fill("joao@example.com");
  await page.getByRole("button", { name: SALVAR }).click();
  await expect(page.getByRole("status")).toHaveText(CHAVE_PIX_SALVA);

  // Contrato onde o usuário logado é o vendedor (gate do PIX exige seller +
  // parcela pendente + chave resolvida).
  const { id } = await seedContract(page.request, {
    ownerRole: "seller",
    title: "PIX E2E",
  });
  const detail = await getContract(page.request, id);
  const installmentId = detail.installments[0].id as string;

  await page.goto(`/contracts/${id}?installment=${installmentId}`);
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();

  await expect(drawer.getByText(PAGUE_COM_PIX)).toBeVisible();
  const qr = drawer.getByRole("img", { name: QR_CODE_PIX });
  await expect(qr).toBeVisible();
  const copyButton = drawer.getByRole("button", { name: COPIAR });
  await expect(copyButton).toBeVisible();

  // Concede permissão de clipboard antes do clique de copiar (Chromium).
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await copyButton.click();
  await expect(drawer.getByRole("button", { name: COPIADO })).toBeVisible();
});

test("comprador-dono vê o PIX do vendedor linkado na parcela", async ({
  browser,
}) => {
  const buyer = await newUser(browser);
  const seller = await newUser(browser);
  try {
    await seller.page.request.patch("/api/me", {
      data: { pixKey: "vendedor@example.com" },
    });
    const { id } = await seedContract(buyer.page.request, {
      ownerRole: "buyer",
      title: "Devo pro fulano",
    });
    const { token } = await seedInvite(buyer.page.request, id, {
      displayName: "Fulano Vendedor",
      role: "seller",
      email: seller.email,
    });
    await seller.page.goto(`/invites/${token}`);
    await waitForHydrated(seller.page);
    await seller.page.getByRole("button", { name: ACCEPT_INVITE }).click();
    await seller.page.waitForURL(`**/contracts/${id}`);

    const detail = await getContract(buyer.page.request, id);
    await buyer.page.goto(
      `/contracts/${id}?installment=${detail.installments[0].id}`
    );
    const drawer = buyer.page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await expect(
      drawer.locator("p").filter({ hasText: PAY_TO_SELLER })
    ).toBeVisible();
    await expect(drawer.getByRole("img", { name: QR_CODE_PIX })).toBeVisible();
  } finally {
    await buyer.close();
    await seller.close();
  }
});

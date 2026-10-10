import { expect, test } from "@playwright/test";
import { getContract, newUser, seedContract } from "../fixtures";

const SECRET_TITLE = "Segredo do Dono A";
// Sem acesso é o mesmo que não existir (404): a página do contrato mostra o
// estado "Contrato não encontrado" no bloco, sem toast (decisão 20).
const DENIED = /Contrato não encontrado/;

test("estranho não acessa o contrato de outro (sem vazar título)", async ({
  browser,
}) => {
  const owner = await newUser(browser);
  const stranger = await newUser(browser);
  try {
    const { id } = await seedContract(owner.page.request, {
      title: SECRET_TITLE,
    });
    await stranger.page.goto(`/contracts/${id}`);
    // estado negado visível
    await expect(stranger.page.getByText(DENIED)).toBeVisible();
    // e o título NÃO vaza
    await expect(stranger.page.getByText(SECRET_TITLE)).toHaveCount(0);
  } finally {
    await owner.close();
    await stranger.close();
  }
});

test("estranho é bloqueado no deep-link de parcela", async ({ browser }) => {
  const owner = await newUser(browser);
  const stranger = await newUser(browser);
  try {
    const { id } = await seedContract(owner.page.request, {
      title: SECRET_TITLE,
    });
    const detail = await getContract(owner.page.request, id);
    const installmentId = detail.installments[0].id as string;
    await stranger.page.goto(`/contracts/${id}?installment=${installmentId}`);
    await expect(stranger.page.getByText(DENIED)).toBeVisible();
    await expect(stranger.page.getByText(SECRET_TITLE)).toHaveCount(0);
  } finally {
    await owner.close();
    await stranger.close();
  }
});

import { expect, test } from "@playwright/test";
import { getContract, newUser, seedContract } from "../fixtures";

const SECRET_TITLE = "Segredo do Dono A";
// Confirmed against a real run: o boundary de erro da rota mostra este título
// fixo ("Ops, algo deu errado") + a mensagem da API ("Contrato não encontrado"),
// e ainda dispara um toast. Ancoramos no título estável do ErrorFallback.
const DENIED = /Ops, algo deu errado/i;

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

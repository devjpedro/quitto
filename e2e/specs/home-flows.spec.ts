import { expect, test } from "@playwright/test";
import {
  advanceDateNow,
  GREETING,
  getContract,
  isoDaysFromToday,
  newUser,
  PROOF_PDF,
  seedContract,
  seedInvite,
  signup,
  waitForHydrated,
} from "../fixtures";
import { card, inviteCard } from "../home-helpers";

const ACCEPT_INVITE = /Aceitar convite/i;
const AGENDA_ROW = /Agenda E2E/;
const FAR_ROW = /Longe E2E/;
const INSTALLMENT_PARAM = /installment=/;
const PAID_THIS_MONTH = /Pago em /;
const WA_PREFIX = "https://wa.me/?text=";
/** The list's double-tap lock (use-action-lock.ts). */
const ACTION_LOCK_MS = 700;

test("primeiro acesso: o guia mostra o próximo passo e dispensar fica guardado", async ({
  page,
}) => {
  await signup(page);
  await expect(
    page.getByRole("heading", { level: 1, name: GREETING })
  ).toBeVisible();
  // The desktop sidebar's moment card says it too; on a phone it is hidden.
  await expect(
    page.getByText("Comece por aqui").filter({ visible: true }).first()
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Criar meu primeiro contrato" })
  ).toHaveAttribute("href", "/contracts/new");
  // The screen answers at once (optimistic): reload only once the dismissal
  // reached the API, or the reload can race it and bring the guide back.
  const dismissed = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/me/onboarding/dismiss" &&
      response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "dispensar guia" }).click();
  await expect(
    page.getByRole("heading", { name: "Suas pendências aparecem aqui" })
  ).toBeVisible();
  expect((await dismissed).ok()).toBe(true);
  await page.reload();
  await waitForHydrated(page);
  await expect(
    page.getByRole("heading", { name: "Suas pendências aparecem aqui" })
  ).toBeVisible();
  await expect(page.getByText("Comece por aqui")).toHaveCount(0);
  // One sentence and one action: on desktop the header's shortcut steps aside
  // (the phone's tab bar ＋ is the shell's, outside the page).
  await expect(
    page
      .getByRole("main")
      .getByRole("link", { name: "Novo contrato" })
      .filter({ visible: true })
  ).toHaveCount(1);
});

test("pagador: Já paguei tira a parcela do Agora na hora e fica assim depois de recarregar", async ({
  page,
}, testInfo) => {
  await signup(page);
  await seedContract(page.request, {
    title: "Aluguel E2E",
    schedule: {
      mode: "auto",
      totalAmountCents: 300_000,
      installmentsCount: 3,
      firstDueDate: isoDaysFromToday(-3),
    },
  });
  // A payer past the guide: while it shows, the green guide card takes the
  // place of "Nada pendente agora" (next test).
  const dismissed = await page.request.post("/api/me/onboarding/dismiss");
  expect(dismissed.ok()).toBe(true);
  await page.goto("/");
  // A click before hydration lands on the server HTML and is lost.
  await waitForHydrated(page);
  const first = card(page, "Aluguel E2E · parcela 1 de 3");
  await expect(first.getByText("Faça primeiro · atrasada")).toBeVisible();
  await first.getByRole("button", { name: "Já paguei" }).click();
  await expect(
    page.getByText("Parcela marcada como paga", { exact: true })
  ).toBeVisible();
  await expect(first).toHaveCount(0);
  await expect(
    page.getByText("Nada pendente agora", { exact: true })
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: GREETING })
  ).toBeVisible();
  await expect(
    page.getByText("Nada pendente agora", { exact: true })
  ).toBeVisible();
  await expect(card(page, "Aluguel E2E · parcela 1 de 3")).toHaveCount(0);
  // 1 of 3 paid is 33%, below the half "Mais perto de quitar" asks for: the
  // milestone of the moment is what was paid this month. Desktop shows it in
  // the sidebar's lime card; a phone opens the strip with it.
  if (testInfo.project.name === "mobile") {
    await expect(
      page.getByRole("region", { name: "Marcos" }).getByRole("listitem").first()
    ).toContainText(PAID_THIS_MONTH);
  } else {
    await expect(
      page.getByRole("complementary").getByText(PAID_THIS_MONTH)
    ).toBeVisible();
  }
});

test("nada pendente com o guia ativo: o guia verde fica no lugar de Nada pendente agora", async ({
  page,
}) => {
  await signup(page);
  // Due in 15 days: in the next 30 days, but not an action yet.
  await seedContract(page.request, {
    title: "Longe E2E",
    schedule: {
      mode: "auto",
      totalAmountCents: 30_000,
      installmentsCount: 3,
      firstDueDate: isoDaysFromToday(15),
    },
  });
  await page.goto("/");
  await expect(
    page.getByRole("region", { name: "Próximos 30 dias" }).getByRole("link", {
      name: FAR_ROW,
    })
  ).toBeVisible();
  // The guide (2 of 3, the PIX key is next) already answers "what now".
  await expect(
    page.getByRole("heading", { level: 2, name: "Cadastre sua chave PIX." })
  ).toBeVisible();
  await expect(
    page.getByText("Nada pendente agora", { exact: true })
  ).toHaveCount(0);
});

test("recebedor: Cobrar no WhatsApp leva a cobrança com o PIX, e Marcar como recebida funciona", async ({
  page,
}) => {
  await signup(page);
  await page.request.patch("/api/me", {
    data: { pixKey: "recebedor-e2e@example.com" },
  });
  await seedContract(page.request, {
    title: "Venda E2E",
    ownerRole: "seller",
    schedule: {
      mode: "auto",
      totalAmountCents: 90_000,
      installmentsCount: 3,
      firstDueDate: isoDaysFromToday(2),
    },
  });
  await page.goto("/");
  // A click before hydration lands on the server HTML and is lost.
  await waitForHydrated(page);
  const sale = card(page, "Venda E2E · parcela 1 de 3");
  const whatsapp = sale.getByRole("link", { name: "Cobrar no WhatsApp" });
  await expect(whatsapp).toHaveAttribute("target", "_blank");
  const href = (await whatsapp.getAttribute("href")) ?? "";
  expect(href.startsWith(WA_PREFIX)).toBe(true);
  const text = decodeURIComponent(href.slice(WA_PREFIX.length));
  expect(text).toContain("parcela 1 de 3 de “Venda E2E”");
  expect(text).toContain("Pix copia e cola:");
  expect(text).toContain("000201");
  await sale.getByRole("button", { name: "Marcar como recebida" }).click();
  await expect(
    page.getByText("Parcela marcada como recebida", { exact: true })
  ).toBeVisible();
  await expect(sale).toHaveCount(0);
});

test("convites no Agora: recusar e aceitar ali mesmo, e o recusado não volta", async ({
  browser,
}) => {
  const owner = await newUser(browser);
  const guest = await newUser(browser);
  try {
    const declined = await seedContract(owner.page.request, {
      title: "Convite Recusar",
    });
    const accepted = await seedContract(owner.page.request, {
      title: "Convite Aceitar",
    });
    for (const id of [declined.id, accepted.id]) {
      await seedInvite(owner.page.request, id, {
        displayName: "Vendedor",
        role: "seller",
        email: guest.email,
      });
    }
    // The page clock lets the test move past the double-tap lock without a real wait.
    await guest.page.clock.install();
    await guest.page.goto("/");
    // A click before hydration lands on the server HTML and is lost.
    await waitForHydrated(guest.page);
    await inviteCard(guest.page, "Convite Recusar")
      .getByRole("button", { name: "Recusar" })
      .click();
    await expect(
      guest.page.getByText("Convite recusado", { exact: true })
    ).toBeVisible();
    await expect(inviteCard(guest.page, "Convite Recusar")).toHaveCount(0);
    // A deliberate tap, after the double-tap lock: a tap inside that window
    // lands on the card that slid into place and is swallowed.
    await advanceDateNow(guest.page, ACTION_LOCK_MS + 100);
    await inviteCard(guest.page, "Convite Aceitar")
      .getByRole("button", { name: "Aceitar" })
      .click();
    await expect(
      guest.page.getByText("Convite aceito", { exact: true })
    ).toBeVisible();
    await expect(inviteCard(guest.page, "Convite Aceitar")).toHaveCount(0);

    await guest.page.reload();
    await waitForHydrated(guest.page);
    // The section has arrived (the h1 comes before it, by design): the
    // accepted contract's overdue installment is now the guest's to charge.
    await expect(
      card(guest.page, "Convite Aceitar · parcela 1 de 3")
    ).toBeVisible();
    await expect(inviteCard(guest.page, "Convite Recusar")).toHaveCount(0);
    await guest.page.goto("/contracts");
    // In the list, not in the sidebar's "Contratos ativos".
    await expect(
      guest.page.getByRole("main").getByText("Convite Aceitar")
    ).toBeVisible();
  } finally {
    await owner.close();
    await guest.close();
  }
});

test("conferir comprovante: Confirmar no próprio Agora", async ({
  browser,
}) => {
  const payer = await newUser(browser);
  const approver = await newUser(browser);
  try {
    const { id } = await seedContract(payer.page.request, {
      title: "Conferir E2E",
      ownerRole: "buyer",
      requiresConfirmation: true,
    });
    const { token } = await seedInvite(payer.page.request, id, {
      displayName: "Vendedor",
      role: "seller",
      email: approver.email,
    });
    await approver.page.goto(`/invites/${token}`);
    await waitForHydrated(approver.page);
    await approver.page.getByRole("button", { name: ACCEPT_INVITE }).click();
    await approver.page.waitForURL(`**/contracts/${id}`);
    const detail = await getContract(payer.page.request, id);
    await payer.page.goto(
      `/contracts/${id}?installment=${detail.installments[0].id}`
    );
    await waitForHydrated(payer.page);
    await payer.page.getByLabel("Comprovante").setInputFiles(PROOF_PDF);
    await payer.page
      .getByRole("button", { name: "Enviar comprovante" })
      .click();
    await expect(
      payer.page.getByLabel("Parcela").getByText("aguardando")
    ).toBeVisible();

    await approver.page.goto("/");
    await waitForHydrated(approver.page);
    const review = card(approver.page, "Conferir E2E · parcela 1 de 3");
    await expect(
      review.getByText("Faça primeiro · aguarda você")
    ).toBeVisible();
    await review.getByRole("button", { name: "Confirmar" }).click();
    await expect(
      approver.page.getByText("Pagamento confirmado", { exact: true })
    ).toBeVisible();
    await expect(review).toHaveCount(0);
  } finally {
    await payer.close();
    await approver.close();
  }
});

test("Próximos 30 dias: a linha abre a parcela na gaveta do contrato", async ({
  page,
}) => {
  await signup(page);
  await seedContract(page.request, {
    title: "Agenda E2E",
    schedule: {
      mode: "custom",
      installments: [
        { amountCents: 10_000, dueDate: isoDaysFromToday(3) },
        { amountCents: 10_000, dueDate: isoDaysFromToday(15) },
      ],
    },
  });
  await page.goto("/");
  // The 1st installment is a card (due in 3 days); the 2nd is in the list.
  await page
    .getByRole("region", { name: "Próximos 30 dias" })
    .getByRole("link", { name: AGENDA_ROW })
    .click();
  await expect(page).toHaveURL(INSTALLMENT_PARAM);
  await expect(page.getByLabel("Parcela")).toBeVisible();
});

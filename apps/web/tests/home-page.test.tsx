import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOWER_FEW, LOWER_STACK } from "@/features/home/components/home-grid";
import { HomePage } from "@/features/home/components/home-page";
import { queryKeys } from "@/lib/query-keys";
import { homeFixture, installmentAction, inviteAction } from "./home-fixtures";
import { nb } from "./nbsp";
import { notificationItem } from "./notification-fixtures";
import { makeTestQueryClient, renderWithProviders } from "./test-utils";

const { getHome, getNotifications, markPaid } = vi.hoisted(() => ({
  getHome: vi.fn(),
  getNotifications: vi.fn(),
  markPaid: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    api: {
      home: { get: () => getHome() },
      notifications: { get: () => getNotifications() },
      me: { get: () => new Promise(() => undefined) },
      installments: () => ({ "mark-paid": { post: () => markPaid() } }),
    },
  },
}));

interface LinkProps {
  children: ReactNode;
  className?: string;
  to: string;
}

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children, className, to }: LinkProps) => (
    <a className={className} href={to}>
      {children}
    </a>
  ),
}));

const GREETING = /^(Bom dia|Boa tarde|Boa noite), Maria$/;
const DATE_LEAD = /Sexta-feira, 2 de outubro ·/;
const DATE_ONLY = /^Sexta-feira, 2 de outubro$/;
const ONE_THING = /1 coisa pede sua atenção/;
const NOTHING_PENDING = /Nada pede sua atenção agora\./;
const TWO_THINGS = /2 coisas pedem sua atenção/;

const NOTIFICATIONS_FAILED = {
  data: null,
  error: { status: 500, value: { error: { code: "INTERNAL", message: "x" } } },
};

/** The test setup's matchMedia answers min-width queries against innerWidth. */
function setScreenWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
}

const startWidth = window.innerWidth;

/** The content's lower part (HomeLower); the skeleton's shares its grid, not this attribute. */
/** A notice no card says (an accepted invite is never a card): "Notificações recentes" keeps it. */
const NOTICE = notificationItem({
  id: "k1",
  type: "invite_accepted",
  installmentId: null,
  contractId: "c1",
});

/** The desktop "Ver todas" (the phone's, under the carousel, has the same name). */
const desktopSeeAll = () =>
  screen
    .getAllByRole("button", { name: "Ver todas" })
    .find((button) =>
      button.closest('[data-testid="home-see-all"]')
    ) as HTMLElement;

const lowerPart = () => document.querySelector<HTMLElement>("[data-lower]");

function renderHome({ likeTheApp = false } = {}) {
  const client = makeTestQueryClient();
  if (likeTheApp) {
    // As in the app (src/lib/query.ts): every non-401 error goes to the boundary.
    const defaults = client.getDefaultOptions();
    client.setDefaultOptions({
      ...defaults,
      queries: { ...defaults.queries, throwOnError: true },
    });
  }
  client.setQueryData(queryKeys.session, {
    id: "u1",
    name: "Maria Souza",
    email: "maria@example.com",
    image: null,
  });
  return renderWithProviders(<HomePage />, { client });
}

beforeEach(() => {
  getHome.mockReset();
  getNotifications.mockReset();
  markPaid.mockReset();
});

afterEach(() => {
  setScreenWidth(startWidth);
});

describe("HomePage", () => {
  it("a saudação aparece na hora; o resto espera o home no esqueleto", async () => {
    let answer: (value: unknown) => void = () => undefined;
    getHome.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      })
    );
    renderHome();
    expect(
      screen.getByRole("heading", { level: 1, name: GREETING })
    ).toBeVisible();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    answer({
      data: homeFixture({ actions: [installmentAction()] }),
      error: null,
    });
    expect(
      await screen.findByRole("article", {
        name: nb("Aluguel do apê · parcela~7~de~12"),
      })
    ).toBeVisible();
    expect(screen.getByText(ONE_THING)).toBeVisible();
    expect(document.title).toBe("Quitto · Agora");
  });

  it("só parcelas atrasadas nos cartões e nada mais na janela: os 30 dias não dizem que nada vence", async () => {
    getHome.mockResolvedValue({
      data: homeFixture({
        actions: [
          installmentAction({ kind: "overdue", dueDate: "2026-09-20" }),
        ],
      }),
      error: null,
    });
    renderHome();
    expect(
      await screen.findByRole("heading", {
        name: "Nada mais vence nos próximos 30 dias",
      })
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Nada vence nos próximos 30 dias" })
    ).toBeNull();
  });

  it("só convite nos cartões e nada na janela: os 30 dias dizem que nada vence (convite não é vencimento)", async () => {
    getHome.mockResolvedValue({
      data: homeFixture({ actions: [inviteAction()] }),
      error: null,
    });
    renderHome();
    expect(
      await screen.findByRole("heading", {
        name: "Nada vence nos próximos 30 dias",
      })
    ).toBeVisible();
    expect(
      screen.getByText(
        "Cada parcela aparece aqui quando faltar um mês para o vencimento."
      )
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", {
        name: "Nada mais vence nos próximos 30 dias",
      })
    ).toBeNull();
  });

  it("sem ação e com contrato: Nada pendente agora, e os 30 dias continuam", async () => {
    getHome.mockResolvedValue({ data: homeFixture(), error: null });
    renderHome();
    expect(await screen.findByText("Nada pendente agora")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Próximos 30 dias" })
    ).toBeVisible();
  });

  it("+ Novo contrato fica ao lado da saudação, só no desktop, antes dos dados", () => {
    getHome.mockReturnValue(new Promise(() => undefined));
    renderHome();
    const shortcut = screen.getByRole("link", { name: "Novo contrato" });
    expect(shortcut).toHaveAttribute("href", "/contracts/new");
    expect(shortcut).toHaveClass("hidden", "md:inline-flex");
  });

  it("cabeçalho: saudação 32/700 e, no desktop, a data por extenso antes do resumo", async () => {
    // TODAY (home-fixtures) is 2026-10-02, a Friday.
    getHome.mockResolvedValue({
      data: homeFixture({
        actions: [
          installmentAction(),
          installmentAction({ installmentId: "i2", sequence: 8 }),
        ],
      }),
      error: null,
    });
    renderHome();
    expect(
      screen.getByRole("heading", { level: 1, name: GREETING })
    ).toHaveClass("md:text-[32px]", "font-bold");
    // The date leads the subtitle on desktop; on a phone it is the whole subtitle (the carousel says the count).
    expect(await screen.findByText(DATE_LEAD)).toHaveClass("max-md:hidden");
    expect(screen.getByText(DATE_ONLY)).toHaveClass("md:hidden");
    // "Ver todas" sits at the end of the same line (it only shows with 4+ cards).
    expect(
      screen.getByText(TWO_THINGS).closest("p")?.parentElement
    ).toHaveClass("flex", "justify-between");
    expect(screen.getByText(TWO_THINGS)).toBeVisible();
  });

  it("cabeçalho: com 4 ações o Ver todas do desktop fica na linha do resumo", async () => {
    getHome.mockResolvedValue({
      data: homeFixture({
        actions: [1, 2, 3, 4].map((n) =>
          installmentAction({ installmentId: `i${n}`, sequence: n })
        ),
      }),
      error: null,
    });
    renderHome();
    await screen.findByText(DATE_LEAD, { exact: false });
    const line = screen.getByText(DATE_LEAD, { exact: false }).closest("p")
      ?.parentElement as HTMLElement;
    expect(line).toContainElement(desktopSeeAll());
  });

  it("tela larga: o conteúdo para em 1840 px, com respiro de 24 a 32 px, e a parte de baixo cresce por colunas", async () => {
    getHome.mockResolvedValue({
      data: homeFixture({
        actions: [
          installmentAction(),
          installmentAction({ installmentId: "i2" }),
          installmentAction({ installmentId: "i3" }),
        ],
        // The guide is unfinished, so it shows compact at the end.
        onboarding: { ...homeFixture().onboarding, hasPixKey: false },
        milestones: {
          ...homeFixture().milestones,
          settled: {
            paidCents: 4_190_000,
            receivedCents: 0,
            payableTotalCents: 4_190_000,
            receivableTotalCents: 0,
          },
        },
      }),
      error: null,
    });
    renderHome();
    // Greeting row → the 1840 px column (header and section) → the panel's padding.
    const column = screen.getByRole("heading", { level: 1 }).parentElement
      ?.parentElement;
    expect(column).toHaveClass("mx-auto", "w-full", "max-w-[1840px]");
    expect(column?.parentElement).toHaveClass("p-4", "md:p-6", "lateral:p-8");

    const upcoming = await screen.findByRole("region", {
      name: "Próximos 30 dias",
    });
    const left = upcoming.parentElement;
    const lower = left?.parentElement;
    expect(lower).toHaveClass(
      "lateral:grid",
      "lateral:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)]"
    );
    // Two columns at every width: from wide the actions go to 5 per row, down here nothing changes.
    expect(lower?.className).not.toContain("wide:grid-cols");
    // The rhythm of mockup 13: 28 px between blocks on a phone, 36 px and
    // 28 px between columns from lateral, 36 px above the lower part.
    expect(lower).toHaveClass(
      ...LOWER_STACK.split(" "),
      "lateral:gap-x-7",
      "lateral:gap-y-9"
    );
    expect(left).toHaveClass("lateral:gap-9");
    // Below lateral the column wrappers dissolve, so the lower part reads as mockup 11.
    expect(left).toHaveClass("contents", "lateral:flex");
    const side = screen.getByRole("region", { name: "Marcos" }).parentElement;
    expect(side).toHaveClass("contents", "lateral:flex");
    expect(side).not.toHaveClass("wide:contents");
    expect(side?.parentElement).toBe(lower);
    // List, milestones, then the guide: the guide goes last below lateral, under the list from lateral.
    const guide = screen
      .getByRole("button", { name: "dispensar guia" })
      .closest("section");
    expect(guide?.parentElement).toHaveClass(
      "order-last",
      "lateral:order-none"
    );
    expect(guide?.parentElement?.parentElement).toBe(left);
  });

  it("sem contrato não há coluna lateral: a parte de baixo nem existe", async () => {
    getHome.mockResolvedValue({
      data: homeFixture({
        onboarding: {
          ...homeFixture().onboarding,
          hasContract: false,
          dismissedAt: "2026-10-02T10:00:00.000Z",
        },
      }),
      error: null,
    });
    renderHome();
    expect(
      await screen.findByRole("heading", {
        name: "Suas pendências aparecem aqui",
      })
    ).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "Próximos 30 dias" })
    ).toBeNull();
    expect(screen.queryByRole("region", { name: "Marcos" })).toBeNull();
  });

  it("sem contrato e com o guia dispensado: o vazio tem a única ação, e o + Novo contrato do cabeçalho sai", async () => {
    getHome.mockResolvedValue({
      data: homeFixture({
        onboarding: {
          ...homeFixture().onboarding,
          hasContract: false,
          dismissedAt: "2026-10-02T10:00:00.000Z",
        },
      }),
      error: null,
    });
    renderHome();
    await screen.findByRole("heading", {
      name: "Suas pendências aparecem aqui",
    });
    const header = screen.getByRole("heading", { level: 1 }).parentElement;
    const shortcut = within(header as HTMLElement).getByRole("link", {
      name: "Novo contrato",
    });
    // By CSS, so the server HTML and the hydration agree: the page hides the
    // shortcut once the empty state (marked data-home-empty) is in it.
    expect(shortcut).toHaveClass("group-has-[[data-home-empty]]/home:hidden");
    const page = shortcut.closest("[class~='group/home']");
    expect(page?.querySelector("[data-home-empty]")).toContainElement(
      screen.getByRole("heading", { name: "Suas pendências aparecem aqui" })
    );
  });

  it("com contrato, nada marca a home como vazia: o + Novo contrato do cabeçalho fica", async () => {
    getHome.mockResolvedValue({ data: homeFixture(), error: null });
    renderHome();
    expect(await screen.findByText("Nada pendente agora")).toBeVisible();
    expect(document.querySelector("[data-home-empty]")).toBeNull();
  });

  it("sem contrato, com um convite e o guia por terminar: o guia compacto vem embaixo, e a coluna lateral leva só as Notificações recentes", async () => {
    setScreenWidth(1440);
    getNotifications.mockResolvedValue({ data: [NOTICE], error: null });
    getHome.mockResolvedValue({
      data: homeFixture({
        actions: [inviteAction()],
        onboarding: {
          ...homeFixture().onboarding,
          hasContract: false,
          counterpartyContractId: null,
        },
      }),
      error: null,
    });
    renderHome();
    const guide = (
      await screen.findByRole("button", { name: "dispensar guia" })
    ).closest("section") as HTMLElement;
    expect(guide).toBeVisible();
    expect(within(guide).getByText("Criar o primeiro contrato")).toBeVisible();
    // The invite is the only action, so the green guide card does not lead.
    expect(
      screen.queryByRole("heading", {
        name: "Cadastre o primeiro acordo que você quer acompanhar.",
      })
    ).toBeNull();
    expect(
      screen.queryByRole("region", { name: "Próximos 30 dias" })
    ).toBeNull();
    expect(screen.queryByRole("region", { name: "Marcos" })).toBeNull();
    // Guide → its order-last wrapper → the left column → the lower part. With
    // no milestones the side column still has "Notificações recentes", so the
    // grid is on and no side column is ever left empty.
    const left = guide.parentElement?.parentElement;
    const lower = left?.parentElement;
    expect(guide.parentElement).toHaveClass("order-last");
    const recent = await screen.findByRole("region", {
      name: "Notificações recentes",
    });
    expect(recent.parentElement?.parentElement).toBe(lower);
    expect(lower?.children).toHaveLength(2);
    expect(lower).toHaveClass("lateral:grid");
  });

  it("a coluna lateral leva as Notificações recentes, só a partir de lateral e sem buscar na tela estreita", async () => {
    setScreenWidth(1440);
    getNotifications.mockResolvedValue({ data: [NOTICE], error: null });
    getHome.mockResolvedValue({ data: homeFixture(), error: null });
    renderHome();
    const recent = await screen.findByRole("region", {
      name: "Notificações recentes",
    });
    expect(recent).toHaveClass("hidden", "lateral:block");
    // In the side column, which stays one column at every width.
    const side = recent.parentElement;
    expect(side).toHaveClass("contents", "lateral:flex");
    expect(side).not.toHaveClass("wide:contents");
    // This fixture has a contract but no milestones on screen: the block alone
    // keeps the side column filled, so the grid is on.
    expect(side?.parentElement).toHaveClass("lateral:grid");
  });

  it("abaixo de lateral nada é buscado e o bloco das notificações nem entra", async () => {
    getHome.mockResolvedValue({ data: homeFixture(), error: null });
    renderHome();
    expect(await screen.findByText("Nada pendente agora")).toBeVisible();
    expect(getNotifications).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("region", { name: "Notificações recentes" })
    ).toBeNull();
  });

  it("a 1440 px, se a lista de notificações falha, o bloco some e a home continua", async () => {
    setScreenWidth(1440);
    getHome.mockResolvedValue({
      data: homeFixture({
        milestones: {
          ...homeFixture().milestones,
          settled: {
            paidCents: 4_190_000,
            receivedCents: 0,
            payableTotalCents: 4_190_000,
            receivableTotalCents: 0,
          },
        },
      }),
      error: null,
    });
    getNotifications.mockResolvedValue(NOTIFICATIONS_FAILED);
    renderHome({ likeTheApp: true });
    await screen.findByRole("region", { name: "Próximos 30 dias" });
    await waitFor(() => expect(getNotifications).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Notificações recentes" })
      ).toBeNull()
    );
    // The error stays in the block: the home is still on screen, not the boundary.
    expect(
      screen.getByRole("region", { name: "Próximos 30 dias" })
    ).toBeVisible();
    expect(screen.getByRole("region", { name: "Marcos" })).toBeVisible();
    // The milestones keep the side column filled, so the columns stay on.
    expect(lowerPart()).toHaveAttribute("data-lower", "columns");
  });

  it.each([
    [
      "sem contrato, com o guia compacto",
      homeFixture({
        actions: [inviteAction()],
        onboarding: {
          ...homeFixture().onboarding,
          hasContract: false,
          counterpartyContractId: null,
        },
      }),
    ],
    ["com contrato e sem marcos", homeFixture()],
  ])(
    "a 1440 px, %s e a lista falhando: a coluna lateral vazia desliga a grade",
    async (_case, home) => {
      setScreenWidth(1440);
      getHome.mockResolvedValue({ data: home, error: null });
      getNotifications.mockResolvedValue(NOTIFICATIONS_FAILED);
      renderHome({ likeTheApp: true });
      await waitFor(() => expect(lowerPart()).not.toBeNull());
      await waitFor(() =>
        expect(
          screen.queryByRole("region", { name: "Notificações recentes" })
        ).toBeNull()
      );
      const lower = lowerPart();
      expect(lower?.lastElementChild).toBeEmptyDOMElement();
      // An empty side column is decided by the data (no milestones from md,
      // and the list failed): the lower part stacks, so no 2fr track stays
      // blank beside the list or the guide.
      expect(lower).toHaveAttribute("data-lower", "stack");
      expect(lower).not.toHaveClass("lateral:grid");
      // And it takes no room from lateral: no 32 px gap under the last block.
      expect(lower?.lastElementChild).toHaveClass("lateral:hidden");
      expect(lower?.firstElementChild).not.toHaveClass("lateral:hidden");
    }
  );

  it("a 1440 px, só com o marco do momento e a lista falhando: a faixa do celular fica na coluna da esquerda e a lateral vazia desliga a grade", async () => {
    setScreenWidth(1440);
    getHome.mockResolvedValue({
      data: homeFixture({
        milestones: {
          ...homeFixture().milestones,
          closestToPayoff: {
            contractId: "c1",
            title: "Celular da Ana",
            paidCount: 1,
            totalCount: 3,
            percent: 33,
            remainingCount: 2,
            nextDueDate: "2026-10-13",
          },
        },
      }),
      error: null,
    });
    getNotifications.mockResolvedValue(NOTIFICATIONS_FAILED);
    renderHome({ likeTheApp: true });
    await waitFor(() => expect(lowerPart()).not.toBeNull());
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Notificações recentes" })
      ).toBeNull()
    );
    // The strip with only the milestone of the moment is for phones (from md
    // the sidebar's lime card shows it): it lives in the left column, so the
    // side column is left empty and the lower part stacks.
    const strip = screen.getByRole("region", { name: "Marcos" });
    expect(strip).toHaveClass("md:hidden");
    const lower = lowerPart();
    expect(lower?.firstElementChild).toContainElement(strip);
    expect(lower?.lastElementChild).toBeEmptyDOMElement();
    expect(lower?.lastElementChild).toHaveClass("lateral:hidden");
    expect(lower).toHaveAttribute("data-lower", "stack");
  });

  it("primeiro acesso: o guia verde lidera", async () => {
    getHome.mockResolvedValue({
      data: homeFixture({
        onboarding: {
          ...homeFixture().onboarding,
          hasContract: false,
          hasPixKey: false,
          hasCounterparty: false,
          remindersOn: false,
          counterpartyContractId: null,
        },
      }),
      error: null,
    });
    renderHome();
    expect(
      await screen.findByRole("heading", {
        name: "Cadastre o primeiro acordo que você quer acompanhar.",
      })
    ).toBeVisible();
    expect(screen.queryByText("Nada pendente agora")).toBeNull();
  });

  it("pelo teclado: quando sai a última ação, o foco vai para o resumo e não cai no body", async () => {
    markPaid.mockReturnValue(new Promise(() => undefined));
    getHome.mockResolvedValue({
      data: homeFixture({ actions: [installmentAction()] }),
      error: null,
    });
    renderHome();
    const markPaidButton = await screen.findByRole("button", {
      name: "Já paguei",
    });
    await userEvent.tab(); // "Novo contrato"
    await userEvent.tab(); // "Pagar com PIX"
    await userEvent.tab(); // "Já paguei"
    expect(document.activeElement).toBe(markPaidButton);
    await userEvent.keyboard("{Enter}");
    // The list leaves with its last card (optimistic), and "Nada pendente agora" takes its place.
    expect(await screen.findByText("Nada pendente agora")).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "O que fazer agora" })
    ).toBeNull();
    const summary = screen
      .getByText(NOTHING_PENDING)
      .closest("p") as HTMLElement;
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(summary);
    expect(summary).toHaveAttribute("tabindex", "-1");
  });

  it("como no Chromium, o botão que fica desabilitado perde o foco antes de o cartão sair, e o foco ainda vai para o resumo", async () => {
    // jsdom keeps the focus on a button that turns disabled (busy); Chromium
    // drops it to the body, and only then the optimistic update takes the
    // card out (measured ~10 ms apart). Emulate both.
    const dropFocusWhenDisabled = new MutationObserver((records) => {
      for (const { target } of records) {
        if (
          target === document.activeElement &&
          (target as HTMLButtonElement).disabled
        ) {
          // jsdom will not blur a disabled button: hand the focus to a
          // throwaway input and remove it, which leaves the body focused.
          const sink = document.createElement("input");
          document.body.append(sink);
          sink.focus();
          sink.remove();
        }
      }
    });
    try {
      markPaid.mockReturnValue(new Promise(() => undefined));
      getHome.mockResolvedValue({
        data: homeFixture({ actions: [installmentAction()] }),
        error: null,
      });
      const { client } = renderHome();
      const markPaidButton = await screen.findByRole("button", {
        name: "Já paguei",
      });
      dropFocusWhenDisabled.observe(markPaidButton, {
        attributes: true,
        attributeFilter: ["disabled"],
      });
      // Holds the optimistic update (it awaits cancelQueries first) until the busy state is on screen.
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const cancel = client.cancelQueries.bind(client);
      vi.spyOn(client, "cancelQueries").mockImplementation(async (...args) => {
        await gate;
        return cancel(...args);
      });
      await userEvent.tab(); // "Novo contrato"
      await userEvent.tab(); // "Pagar com PIX"
      await userEvent.tab(); // "Já paguei"
      expect(document.activeElement).toBe(markPaidButton);
      await userEvent.keyboard("{Enter}");
      await waitFor(() => expect(markPaidButton).toBeDisabled());
      // The focus is already lost, with the card still on screen.
      expect(document.activeElement).toBe(document.body);
      expect(
        screen.getByRole("article", {
          name: nb("Aluguel do apê · parcela~7~de~12"),
        })
      ).toBeVisible();
      release();
      expect(await screen.findByText("Nada pendente agora")).toBeVisible();
      expect(document.activeElement).toBe(
        screen.getByText(NOTHING_PENDING).closest("p") as HTMLElement
      );
    } finally {
      dropFocusWhenDisabled.disconnect();
    }
  });

  it("a lista que esvazia por fora (outra tela, outra aba) não mexe no foco de quem está em outro lugar", async () => {
    getHome.mockResolvedValue({
      data: homeFixture({ actions: [installmentAction()] }),
      error: null,
    });
    const { client } = renderHome();
    await screen.findByRole("article", {
      name: nb("Aluguel do apê · parcela~7~de~12"),
    });
    await userEvent.tab();
    const shortcut = screen.getByRole("link", { name: "Novo contrato" });
    expect(document.activeElement).toBe(shortcut);
    client.setQueryData(queryKeys.home, homeFixture());
    expect(await screen.findByText("Nada pendente agora")).toBeVisible();
    expect(document.activeElement).toBe(shortcut);
  });

  it("ninguém focado (Safari, leitor de tela) e a lista esvazia por fora: o foco fica onde estava", async () => {
    getHome.mockResolvedValue({
      data: homeFixture({ actions: [installmentAction()] }),
      error: null,
    });
    const { client } = renderHome();
    await screen.findByRole("article", {
      name: nb("Aluguel do apê · parcela~7~de~12"),
    });
    expect(document.activeElement).toBe(document.body);
    // A refetch on returning to the tab: the other party already paid.
    client.setQueryData(queryKeys.home, homeFixture());
    expect(await screen.findByText("Nada pendente agora")).toBeVisible();
    expect(document.activeElement).toBe(document.body);
  });

  it("um Ver todas aberto fecha quando a lista esvazia: os cartões seguintes voltam como carrossel, não como lista aberta", async () => {
    const five = [1, 2, 3, 4, 5].map((n) =>
      installmentAction({ installmentId: `i${n}`, sequence: n })
    );
    getHome.mockResolvedValue({
      data: homeFixture({ actions: five }),
      error: null,
    });
    const { client } = renderHome();
    await screen.findAllByRole("button", { name: "Ver todas" });
    await userEvent.click(desktopSeeAll());
    expect(screen.getAllByRole("button", { name: "Ver menos" })).toHaveLength(
      2
    );
    // Paid elsewhere: the list empties...
    client.setQueryData(queryKeys.home, homeFixture());
    expect(await screen.findByText("Nada pendente agora")).toBeVisible();
    // ...and a refetch brings five cards again.
    client.setQueryData(queryKeys.home, homeFixture({ actions: five }));
    expect(await screen.findByText("1 de 5")).toBeVisible();
    expect(desktopSeeAll()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Ver menos" })).toBeNull();
  });

  it("poucas ações a partir de 1440: Próximos 30 dias e os marcos, empilhados, na linha das ações; só as notificações embaixo", async () => {
    setScreenWidth(1512);
    getNotifications.mockResolvedValue({ data: [NOTICE], error: null });
    getHome.mockResolvedValue({
      data: homeFixture({
        actions: [installmentAction()],
        milestones: {
          ...homeFixture().milestones,
          settled: {
            paidCents: 1_020_000,
            receivedCents: 0,
            payableTotalCents: 2_660_000,
            receivableTotalCents: 0,
          },
        },
      }),
      error: null,
    });
    renderHome();
    const upcoming = await screen.findByRole("region", {
      name: "Próximos 30 dias",
    });
    const recent = await screen.findByRole("region", {
      name: "Notificações recentes",
    });
    const milestones = screen.getByRole("region", { name: "Marcos" });
    // The slot of the row: "Próximos 30 dias" with the milestones right under it (mockup 16, frame D).
    const stack = upcoming.parentElement;
    expect(stack).toHaveClass("flex", "flex-col");
    expect(stack).toContainElement(milestones);
    const slot = stack?.parentElement;
    expect(slot).toHaveClass(
      "lateral:col-span-2",
      "2xl:col-span-3",
      "wide:col-span-4"
    );
    const row = slot?.parentElement;
    expect(row).toHaveClass("lateral:grid");
    expect(row).toContainElement(screen.getByRole("article"));
    const lower = lowerPart();
    expect(lower).not.toContainElement(upcoming);
    expect(lower).not.toContainElement(milestones);
    // Only the notifications are left down here: one block, in the 3fr track.
    expect(lower).toHaveAttribute("data-lower", "stack");
    expect(lower).toHaveClass(
      "lateral:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)]"
    );
    expect(lower?.firstElementChild).toContainElement(recent);
  });

  it("poucas ações com marcos e a lista de notificações falhando: os marcos continuam na linha das ações, e a parte de baixo inteira some a partir de 1440", async () => {
    setScreenWidth(1512);
    getNotifications.mockResolvedValue(NOTIFICATIONS_FAILED);
    getHome.mockResolvedValue({
      data: homeFixture({
        actions: [installmentAction()],
        milestones: {
          ...homeFixture().milestones,
          settled: {
            paidCents: 1_020_000,
            receivedCents: 0,
            payableTotalCents: 2_660_000,
            receivableTotalCents: 0,
          },
        },
      }),
      error: null,
    });
    renderHome({ likeTheApp: true });
    const milestones = await screen.findByRole("region", { name: "Marcos" });
    await waitFor(() => expect(getNotifications).toHaveBeenCalled());
    await waitFor(() =>
      expect(lowerPart()).toHaveAttribute("data-lower", "stack")
    );
    const upcoming = screen.getByRole("region", { name: "Próximos 30 dias" });
    expect(upcoming.parentElement).toContainElement(milestones);
    // Nothing left to show from lateral (no guide, the list failed): hidden, no margin at the panel's end.
    expect(lowerPart()).toHaveClass("lateral:hidden");
    expect(lowerPart()).not.toHaveClass("lateral:grid");
  });

  it("só o marco do momento e a lista de notificações falhando: a 1440 a parte de baixo empilha, sem trilha em branco", async () => {
    setScreenWidth(1440);
    getNotifications.mockResolvedValue(NOTIFICATIONS_FAILED);
    getHome.mockResolvedValue({
      data: homeFixture({
        actions: [
          installmentAction(),
          installmentAction({ installmentId: "i2" }),
          installmentAction({ installmentId: "i3" }),
        ],
        milestones: {
          ...homeFixture().milestones,
          previousMonthAllClear: { month: "2026-09", paidCount: 12 },
        },
      }),
      error: null,
    });
    renderHome({ likeTheApp: true });
    await screen.findByRole("region", { name: "Próximos 30 dias" });
    await waitFor(() => expect(getNotifications).toHaveBeenCalled());
    await waitFor(() =>
      expect(lowerPart()).toHaveAttribute("data-lower", "stack")
    );
  });

  it("poucas ações sem marcos e com o guia: a partir de 1440 as notificações à esquerda e o guia à direita, nada na largura toda", async () => {
    setScreenWidth(1512);
    getNotifications.mockResolvedValue({ data: [NOTICE], error: null });
    getHome.mockResolvedValue({
      data: homeFixture({
        actions: [installmentAction()],
        // The guide is unfinished, so it shows compact; no milestones from md.
        onboarding: { ...homeFixture().onboarding, hasPixKey: false },
      }),
      error: null,
    });
    renderHome();
    const recent = await screen.findByRole("region", {
      name: "Notificações recentes",
    });
    const guide = screen
      .getByRole("button", { name: "dispensar guia" })
      .closest("section");
    const lower = lowerPart();
    // The guide takes the milestones' column, so neither block stretches
    // across the whole content.
    expect(lower).toHaveAttribute("data-lower", "columns");
    expect(lower).toHaveClass(...LOWER_FEW.split(" "));
    expect(lower?.firstElementChild).toContainElement(recent);
    expect(lower?.lastElementChild).toContainElement(guide);
  });

  it("poucas ações sem marcos, com o guia e a lista de notificações falhando: sobra um bloco, na trilha de 3fr", async () => {
    setScreenWidth(1512);
    getNotifications.mockResolvedValue(NOTIFICATIONS_FAILED);
    getHome.mockResolvedValue({
      data: homeFixture({
        actions: [installmentAction()],
        onboarding: { ...homeFixture().onboarding, hasPixKey: false },
      }),
      error: null,
    });
    renderHome({ likeTheApp: true });
    await screen.findByRole("button", { name: "dispensar guia" });
    await waitFor(() => expect(getNotifications).toHaveBeenCalled());
    await waitFor(() =>
      expect(lowerPart()).toHaveAttribute("data-lower", "stack")
    );
    expect(lowerPart()?.firstElementChild).toContainElement(
      screen.getByRole("button", { name: "dispensar guia" }).closest("section")
    );
    expect(lowerPart()?.lastElementChild).toHaveClass("lateral:hidden");
    expect(lowerPart()).toHaveClass(...LOWER_FEW.split(" "));
  });

  it("poucas ações sem marcos e sem guia: as notificações sozinhas ficam na trilha de 3fr, sem esticar na largura toda", async () => {
    setScreenWidth(1512);
    getNotifications.mockResolvedValue({ data: [NOTICE], error: null });
    getHome.mockResolvedValue({
      data: homeFixture({ actions: [installmentAction()] }),
      error: null,
    });
    renderHome();
    const recent = await screen.findByRole("region", {
      name: "Notificações recentes",
    });
    const lower = lowerPart();
    // One block: no second column, but the grid stays, so the list keeps the
    // width it has beside the milestones (3fr) instead of the whole content.
    expect(lower).toHaveAttribute("data-lower", "stack");
    expect(lower).toHaveClass(...LOWER_FEW.split(" "));
    expect(lower?.firstElementChild).toContainElement(recent);
    expect(lower?.lastElementChild).toHaveClass("lateral:hidden");
  });

  it("poucas ações sem marcos, sem guia e com a lista de notificações falhando: nada a mostrar a partir de 1440, e a parte de baixo inteira some ali", async () => {
    setScreenWidth(1512);
    getNotifications.mockResolvedValue(NOTIFICATIONS_FAILED);
    getHome.mockResolvedValue({
      data: homeFixture({ actions: [installmentAction()] }),
      error: null,
    });
    renderHome({ likeTheApp: true });
    await screen.findByRole("region", { name: "Próximos 30 dias" });
    await waitFor(() => expect(getNotifications).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Notificações recentes" })
      ).toBeNull()
    );
    // Hidden from lateral only: below it a phone-only strip may live in it.
    // No margin of its own is left at the end of the panel.
    const lower = lowerPart();
    expect(lower).toHaveClass("lateral:hidden");
    // One class per line: with two, .not passes as soon as either is missing.
    expect(lower).not.toHaveClass("lateral:grid");
    expect(lower).not.toHaveClass("hidden");
  });

  it("3 → 2 ações pelo teclado: a lista não remonta, e o foco vai para o cartão que ficou no lugar", async () => {
    markPaid.mockReturnValue(new Promise(() => undefined));
    getHome.mockResolvedValue({
      data: homeFixture({
        actions: [
          installmentAction(),
          installmentAction({ installmentId: "i2", sequence: 8 }),
          installmentAction({ installmentId: "i3", sequence: 9 }),
        ],
      }),
      error: null,
    });
    renderHome();
    const section = await screen.findByRole("region", {
      name: "O que fazer agora",
    });
    expect(section.parentElement).toHaveClass("contents");
    const [first] = within(section).getAllByRole("button", {
      name: "Já paguei",
    });
    // As if tabbed to it: a focused button hands the focus on (useActionFocus).
    first?.focus();
    expect(document.activeElement).toBe(first);
    await userEvent.keyboard("{Enter}");
    // The 1st card leaves (optimistic): 2 left, so the row turns "few".
    await waitFor(() =>
      expect(within(section).getAllByRole("article")).toHaveLength(2)
    );
    // Only classes changed: the same section, now inside the few-actions grid.
    expect(screen.getByRole("region", { name: "O que fazer agora" })).toBe(
      section
    );
    // Between md and lateral, 36 px from the cards to "Próximos 30 dias", as in the normal mode.
    expect(section.parentElement).toHaveClass(
      "lateral:grid",
      "gap-7",
      "md:gap-9"
    );
    const [nowFirst] = within(section).getAllByRole("article");
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(
      nowFirst?.querySelector("a[href], button:not(:disabled)")
    );
  });

  it("3 → 2 ações: o 2º toque dentro da trava não age no cartão que deslizou para o lugar", async () => {
    markPaid.mockReturnValue(new Promise(() => undefined));
    getHome.mockResolvedValue({
      data: homeFixture({
        actions: [
          installmentAction(),
          installmentAction({ installmentId: "i2", sequence: 8 }),
          installmentAction({ installmentId: "i3", sequence: 9 }),
        ],
      }),
      error: null,
    });
    renderHome();
    const section = await screen.findByRole("region", {
      name: "O que fazer agora",
    });
    // A frozen clock: the 2nd tap stays inside ACTION_LOCK_MS (700 ms) however
    // slow the machine is (the pattern of action-list.test.tsx's frozenClock).
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now());
    try {
      const [first] = within(section).getAllByRole("button", {
        name: "Já paguei",
      });
      await userEvent.click(first as HTMLElement);
      await waitFor(() =>
        expect(within(section).getAllByRole("article")).toHaveLength(2)
      );
      // A double tap: the 2nd lands on the "Já paguei" of the card that slid into the spot.
      const [next] = within(section).getAllByRole("button", {
        name: "Já paguei",
      });
      await userEvent.click(next as HTMLElement);
      expect(markPaid).toHaveBeenCalledTimes(1);
      expect(within(section).getAllByRole("article")).toHaveLength(2);
    } finally {
      clock.mockRestore();
    }
  });
});

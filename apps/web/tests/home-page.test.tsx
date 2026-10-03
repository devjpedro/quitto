import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomePage } from "@/features/home/components/home-page";
import { queryKeys } from "@/lib/query-keys";
import { homeFixture, installmentAction, inviteAction } from "./home-fixtures";
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

/** The lower part: list and guide on the left, the side column last. */
const lowerPart = () =>
  document.querySelector<HTMLElement>("[class~='lateral:grid']");

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
      await screen.findByRole("article", { name: "Aluguel do apê · 7/12" })
    ).toBeVisible();
    expect(screen.getByText("1 coisa pede sua atenção")).toBeVisible();
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

  it("tela larga: o conteúdo para em 1840 px, com respiro de 24 a 32 px, e a parte de baixo cresce por colunas", async () => {
    getHome.mockResolvedValue({
      data: homeFixture({
        actions: [installmentAction()],
        // The guide is unfinished, so it shows compact at the end.
        onboarding: { ...homeFixture().onboarding, hasPixKey: false },
        milestones: {
          ...homeFixture().milestones,
          settled: { paidCents: 4_190_000, receivedCents: 0 },
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
      "lateral:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)]",
      "wide:grid-cols-[minmax(0,2fr)_repeat(auto-fit,minmax(300px,1fr))]"
    );
    // Below lateral the column wrappers dissolve, so the lower part reads as mockup 11.
    expect(left).toHaveClass("contents", "lateral:flex");
    const side = screen.getByRole("region", { name: "Marcos" }).parentElement;
    expect(side).toHaveClass("contents", "lateral:flex", "wide:contents");
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

  it("sem contrato, com um convite e o guia por terminar: o guia compacto vem embaixo, e a coluna lateral leva só as Notificações recentes", async () => {
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
    const recent = screen.getByRole("region", {
      name: "Notificações recentes",
    });
    expect(recent.parentElement?.parentElement).toBe(lower);
    expect(lower?.children).toHaveLength(2);
    expect(lower).toHaveClass("lateral:grid");
  });

  it("a coluna lateral leva as Notificações recentes, só a partir de lateral e sem buscar na tela estreita", async () => {
    getHome.mockResolvedValue({ data: homeFixture(), error: null });
    renderHome();
    const recent = await screen.findByRole("region", {
      name: "Notificações recentes",
    });
    expect(recent).toHaveClass("hidden", "lateral:flex");
    // In the side column; from wide it takes a column of its own.
    const side = recent.parentElement;
    expect(side).toHaveClass("contents", "lateral:flex", "wide:contents");
    // This fixture has a contract but no milestones on screen: the block alone
    // keeps the side column filled, so the grid is on.
    expect(side?.parentElement).toHaveClass("lateral:grid");
    // jsdom is 1024 px wide: below lateral nothing is fetched.
    expect(getNotifications).not.toHaveBeenCalled();
  });

  it("a 1440 px, se a lista de notificações falha, o bloco some e a home continua", async () => {
    setScreenWidth(1440);
    getHome.mockResolvedValue({
      data: homeFixture({
        milestones: {
          ...homeFixture().milestones,
          settled: { paidCents: 4_190_000, receivedCents: 0 },
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
    // The milestones keep the side column filled, so the grid stays on.
    expect(lowerPart()?.matches(":has(> :empty)")).toBe(false);
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
      // A column left empty turns the grid into a block: no 2fr track stays
      // blank beside the list or the guide.
      expect(lower).toHaveClass("lateral:has-[>:empty]:block");
      expect(lower?.matches(":has(> :empty)")).toBe(true);
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
    // side column is left empty and the grid turns into a block.
    const strip = screen.getByRole("region", { name: "Marcos" });
    expect(strip).toHaveClass("md:hidden");
    const lower = lowerPart();
    expect(lower?.firstElementChild).toContainElement(strip);
    expect(lower?.lastElementChild).toBeEmptyDOMElement();
    expect(lower?.matches(":has(> :empty)")).toBe(true);
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
    const summary = screen.getByText("Nada pede sua atenção agora.");
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
        screen.getByRole("article", { name: "Aluguel do apê · 7/12" })
      ).toBeVisible();
      release();
      expect(await screen.findByText("Nada pendente agora")).toBeVisible();
      expect(document.activeElement).toBe(
        screen.getByText("Nada pede sua atenção agora.")
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
    await screen.findByRole("article", { name: "Aluguel do apê · 7/12" });
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
    await screen.findByRole("article", { name: "Aluguel do apê · 7/12" });
    expect(document.activeElement).toBe(document.body);
    // A refetch on returning to the tab: the other party already paid.
    client.setQueryData(queryKeys.home, homeFixture());
    expect(await screen.findByText("Nada pendente agora")).toBeVisible();
    expect(document.activeElement).toBe(document.body);
  });
});

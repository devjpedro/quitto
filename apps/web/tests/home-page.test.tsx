import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomePage } from "@/features/home/components/home-page";
import { queryKeys } from "@/lib/query-keys";
import {
  homeFixture,
  installmentAction,
  inviteAction,
  upcomingItem,
} from "./home-fixtures";
import { nb } from "./nbsp";
import { makeTestQueryClient, renderWithProviders } from "./test-utils";

const { getHome, markPaid } = vi.hoisted(() => ({
  getHome: vi.fn(),
  markPaid: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    api: {
      home: { get: () => getHome() },
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
const ONE_THING = /1 coisa pede sua atenção/;
const A_RECEBER = /a receber/;
const EM_ATRASO = /em atraso/;
const NOTHING_PENDING = /Nada pede sua atenção agora\./;

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
  markPaid.mockReset();
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

  it("sem ação e com contrato: Tudo em dia, e os 30 dias continuam", async () => {
    getHome.mockResolvedValue({ data: homeFixture(), error: null });
    renderHome();
    expect(await screen.findByText("Tudo em dia")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Próximos 30 dias" })
    ).toBeVisible();
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
    expect(screen.queryByText("Tudo em dia")).toBeNull();
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
    await userEvent.tab(); // "Pagar com PIX"
    await userEvent.tab(); // "Já paguei"
    expect(document.activeElement).toBe(markPaidButton);
    await userEvent.keyboard("{Enter}");
    // The list leaves with its last card (optimistic), and "Tudo em dia" takes its place.
    expect(await screen.findByText("Tudo em dia")).toBeVisible();
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
      expect(await screen.findByText("Tudo em dia")).toBeVisible();
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
    // Someone elsewhere on the page (the sidebar, say).
    const shortcut = document.createElement("button");
    document.body.append(shortcut);
    shortcut.focus();
    expect(document.activeElement).toBe(shortcut);
    client.setQueryData(queryKeys.home, homeFixture());
    expect(await screen.findByText("Tudo em dia")).toBeVisible();
    expect(document.activeElement).toBe(shortcut);
    shortcut.remove();
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
    expect(await screen.findByText("Tudo em dia")).toBeVisible();
    expect(document.activeElement).toBe(document.body);
  });

  it("uma ação em destaque: o cartão verde só com a primeira; as outras são linhas em 'Na sequência', sem botão", async () => {
    getHome.mockResolvedValue({
      data: homeFixture({
        actions: [
          installmentAction(),
          installmentAction({
            installmentId: "i2",
            contractTitle: "Moto do Rafa",
            kind: "overdue",
            dueDate: "2026-09-20",
            direction: "receive",
            canMarkReceived: true,
          }),
          inviteAction(),
        ],
      }),
      error: null,
    });
    renderHome();
    await screen.findByRole("article", {
      name: nb("Aluguel do apê · parcela~7~de~12"),
    });
    expect(screen.getAllByRole("article")).toHaveLength(1);
    const next = screen.getByRole("region", { name: "Na sequência" });
    const rows = within(next).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    // A line opens the thing, and has no button of its own.
    expect(within(next).queryByRole("button")).toBeNull();
    expect(within(rows[0] as HTMLElement).getByRole("link")).toHaveTextContent(
      "Moto do Rafa"
    );
    expect(within(rows[1] as HTMLElement).getByRole("link")).toHaveAttribute(
      "href",
      "/invites/$token"
    );
  });

  it("com uma ação só, não há 'Na sequência'; com mais de 5, as que passam de 4 viram '+ N em Parcelas'", async () => {
    getHome.mockResolvedValue({
      data: homeFixture({ actions: [installmentAction()] }),
      error: null,
    });
    const { unmount } = renderHome();
    await screen.findByRole("article");
    expect(screen.queryByRole("region", { name: "Na sequência" })).toBeNull();
    unmount();
    getHome.mockResolvedValue({
      data: homeFixture({
        actions: [1, 2, 3, 4, 5, 6, 7].map((n) =>
          installmentAction({ installmentId: `i${n}`, sequence: n })
        ),
      }),
      error: null,
    });
    renderHome();
    const next = await screen.findByRole("region", { name: "Na sequência" });
    expect(within(next).getAllByRole("listitem")).toHaveLength(4);
    expect(within(next).getByText("+ 2 em Parcelas")).toBeVisible();
  });

  it("'Próximos 30 dias' mostra 3 linhas e 'Mais N em Parcelas', sem os totais", async () => {
    getHome.mockResolvedValue({
      data: homeFixture({
        upcoming: {
          items: [1, 2, 3, 4].map((n) =>
            upcomingItem({ installmentId: `u${n}`, sequence: n })
          ),
          moreCount: 1,
          toPayCents: 0,
          toReceiveCents: 128_000,
        },
      }),
      error: null,
    });
    renderHome();
    const section = (
      await screen.findByRole("heading", { name: "Próximos 30 dias" })
    ).closest("section") as HTMLElement;
    expect(within(section).getAllByRole("listitem")).toHaveLength(3);
    expect(
      within(section).getByRole("link", { name: "Mais 2 em Parcelas" })
    ).toHaveAttribute("href", "/installments");
    expect(within(section).queryByText(A_RECEBER)).toBeNull();
  });

  it("saíram da home: o 'Novo contrato' do cabeçalho, as notificações recentes e o chip de atraso", async () => {
    getHome.mockResolvedValue({
      data: homeFixture({
        actions: [
          installmentAction({ kind: "overdue", dueDate: "2026-09-20" }),
          installmentAction({
            installmentId: "i2",
            kind: "overdue",
            dueDate: "2026-09-21",
          }),
        ],
        overdue: { toPayCents: 250_000, toReceiveCents: 0 },
      }),
      error: null,
    });
    renderHome();
    await screen.findByRole("article");
    expect(screen.queryByRole("link", { name: "Novo contrato" })).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Notificações recentes" })
    ).toBeNull();
    expect(screen.queryByText(EM_ATRASO)).toBeNull();
  });
});

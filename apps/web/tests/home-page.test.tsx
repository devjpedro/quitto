import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomePage } from "@/features/home/components/home-page";
import { queryKeys } from "@/lib/query-keys";
import { homeFixture, installmentAction } from "./home-fixtures";
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

function renderHome() {
  const client = makeTestQueryClient();
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
      await screen.findByRole("article", { name: "Aluguel do apê · 7/12" })
    ).toBeVisible();
    expect(screen.getByText("1 coisa pede sua atenção")).toBeVisible();
    expect(document.title).toBe("Quitto · Agora");
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
});

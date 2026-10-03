import { QueryClient, useQuery } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActionList } from "@/features/home/components/action-list";
import { ACTION_LOCK_MS } from "@/features/home/hooks/use-action-lock";
import type { Home, HomeAction } from "@/features/home/types";
import { queryKeys } from "@/lib/query-keys";
import {
  homeFixture,
  installmentAction,
  inviteAction,
  TODAY,
} from "./home-fixtures";
import { renderWithProviders } from "./test-utils";

const { markPaid, decline } = vi.hoisted(() => ({
  markPaid: vi.fn(),
  decline: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    api: {
      installments: ({ installmentId }: { installmentId: string }) => ({
        "mark-paid": { post: () => markPaid(installmentId) },
        confirm: { post: () => markPaid(installmentId) },
      }),
      invites: () => ({
        accept: { post: () => decline() },
        decline: { post: () => decline() },
      }),
    },
  },
}));

interface LinkProps {
  children: ReactNode;
  className?: string;
  params?: { id: string };
  search?: { installment?: string };
  to: string;
}

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children, className, params, search, to }: LinkProps) => (
    <a
      className={className}
      href={`${to.replace("$id", params?.id ?? "")}?installment=${search?.installment ?? ""}`}
    >
      {children}
    </a>
  ),
}));

function makeClient(actions: HomeAction[]) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Number.POSITIVE_INFINITY,
        staleTime: Number.POSITIVE_INFINITY,
      },
      mutations: { retry: false },
    },
  });
  client.setQueryData(queryKeys.home, homeFixture({ actions }));
  return client;
}

/** Actions as a static prop: the card under the finger never leaves the screen. */
function renderList(actions: HomeAction[] = [installmentAction()]) {
  return renderWithProviders(<ActionList actions={actions} today={TODAY} />, {
    client: makeClient(actions),
  });
}

/** Actions read from the cache, as on the page: the optimistic update removes the card. */
function LiveList() {
  const { data } = useQuery({
    queryKey: queryKeys.home,
    queryFn: () => new Promise<Home>(() => undefined),
  });
  return data ? <ActionList actions={data.actions} today={TODAY} /> : null;
}

function renderLive(actions: HomeAction[]) {
  return renderWithProviders(<LiveList />, { client: makeClient(actions) });
}

const twoToPay = () => [
  installmentAction({ installmentId: "i1", sequence: 1 }),
  installmentAction({ installmentId: "i2", sequence: 2 }),
];

const firstMarkPaid = () =>
  screen.getAllByRole("button", { name: "Já paguei" })[0] as HTMLElement;

/** `count` overdue installments of the same contract, 1/12 to count/12. */
const overdue = (count: number) =>
  Array.from({ length: count }, (_, i) =>
    installmentAction({
      installmentId: `i${i + 1}`,
      sequence: i + 1,
      kind: "overdue",
      dueDate: "2026-09-20",
    })
  );

/** The grid cell (`li`) of the card "Aluguel do apê · n/12". */
const itemOf = (n: number) =>
  screen
    .getByRole("article", { name: `Aluguel do apê · ${n}/12` })
    .closest("li");

beforeEach(() => {
  markPaid.mockReset();
  decline.mockReset();
});

describe("ActionList", () => {
  it("o primeiro cartão é o verde 'Faça primeiro', com Pagar com PIX e Já paguei", () => {
    renderList();
    const card = screen.getByRole("article", { name: "Aluguel do apê · 7/12" });
    expect(card).toBeVisible();
    expect(screen.getByText("Faça primeiro · amanhã")).toBeVisible();
    expect(screen.getByText("R$ 1.250,00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pagar com PIX" })).toHaveAttribute(
      "href",
      "/contracts/c1?installment=i1"
    );
    expect(screen.getByRole("button", { name: "Já paguei" })).toBeVisible();
  });

  it("receber: Cobrar no WhatsApp abre o wa.me com a cobrança e o PIX", () => {
    renderList([
      installmentAction({ installmentId: "x0" }),
      installmentAction({
        installmentId: "r1",
        kind: "overdue",
        direction: "receive",
        dueDate: "2026-09-28",
        counterpartyName: "Carlos",
        contractTitle: "Notebook",
        sequence: 2,
        installmentsCount: 6,
      }),
    ]);
    const link = screen.getByRole("link", {
      name: "Cobrar no WhatsApp (abre o WhatsApp)",
    });
    expect(link).toHaveAttribute("target", "_blank");
    const href = link.getAttribute("href") ?? "";
    expect(href.startsWith("https://wa.me/?text=")).toBe(true);
    const text = decodeURIComponent(href.slice("https://wa.me/?text=".length));
    expect(text).toContain("A parcela 2 de 6 de “Notebook”");
    expect(text).toContain("000201pix");
    expect(
      screen.getByRole("button", { name: "Marcar como recebida" })
    ).toBeVisible();
  });

  it("um toque duplo chama a API uma vez só", async () => {
    markPaid.mockReturnValue(new Promise(() => undefined));
    renderList();
    await userEvent.dblClick(screen.getByRole("button", { name: "Já paguei" }));
    await waitFor(() => expect(markPaid).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(markPaid).toHaveBeenCalledTimes(1);
  });

  it("toque duplo: o segundo toque não age no cartão que deslizou para o lugar", async () => {
    markPaid.mockReturnValue(new Promise(() => undefined));
    renderLive(twoToPay());
    await userEvent.click(firstMarkPaid());
    await waitFor(() =>
      expect(
        screen.queryByRole("article", { name: "Aluguel do apê · 1/12" })
      ).toBeNull()
    );
    // The card 2/12 is now first, green, with its own "Já paguei" under the finger.
    await userEvent.click(firstMarkPaid());
    expect(markPaid).toHaveBeenCalledTimes(1);
    expect(markPaid).toHaveBeenCalledWith("i1");
  });

  it("um toque deliberado depois da janela da trava funciona", async () => {
    markPaid.mockReturnValue(new Promise(() => undefined));
    const realNow = Date.now.bind(Date);
    let skew = 0;
    const now = vi
      .spyOn(Date, "now")
      .mockImplementation(() => realNow() + skew);
    try {
      renderLive(twoToPay());
      await userEvent.click(firstMarkPaid());
      await waitFor(() =>
        expect(
          screen.queryByRole("article", { name: "Aluguel do apê · 1/12" })
        ).toBeNull()
      );
      skew = ACTION_LOCK_MS + 100;
      await userEvent.click(firstMarkPaid());
      await waitFor(() => expect(markPaid).toHaveBeenCalledTimes(2));
      expect(markPaid).toHaveBeenLastCalledWith("i2");
    } finally {
      now.mockRestore();
    }
  });

  it("1 ação: largura toda no celular e 2 colunas no desktop", () => {
    renderList([installmentAction()]);
    const item = screen
      .getByRole("article", { name: "Aluguel do apê · 7/12" })
      .closest("li");
    expect(item).toHaveClass("w-full", "lg:col-span-2");
    expect(item).not.toHaveClass("w-[calc(100%-2.75rem)]");
    expect(screen.queryByText("1 de 1")).toBeNull();
  });

  it("5 ações: 1 de 5 no carrossel e Ver todas revela as escondidas no desktop", async () => {
    renderList(overdue(5));
    expect(screen.getByText("1 de 5")).toBeVisible();
    expect(screen.getAllByRole("article")).toHaveLength(5);
    const fourth = itemOf(4);
    const fifth = itemOf(5);
    // Past the row of 3 (lg), back in the row of 4 (2xl) and of 5 (wide).
    expect(fourth).toHaveClass("lg:hidden", "2xl:block");
    expect(fifth).toHaveClass("lg:hidden", "wide:block");
    const seeAll = screen.getByRole("button", { name: "Ver todas (5)" });
    expect(seeAll).toHaveAttribute("aria-expanded", "false");
    // Shown while a card is past the row: until wide, where all 5 fit.
    expect(seeAll.parentElement).toHaveClass("lg:flex", "wide:hidden");
    expect(seeAll.parentElement).not.toHaveClass("2xl:hidden");
    await userEvent.click(seeAll);
    // Mobile and desktop toggles share the state, and jsdom renders both.
    for (const button of screen.getAllByRole("button", { name: "Ver menos" })) {
      expect(button).toHaveAttribute("aria-expanded", "true");
    }
    expect(fourth).not.toHaveClass("lg:hidden");
    expect(fifth).not.toHaveClass("lg:hidden");
  });

  it("a grade cresce por colunas: 3 em lg, 4 em 2xl e 5 em wide", () => {
    renderList(overdue(5));
    const grid = itemOf(1)?.parentElement;
    expect(grid).toHaveClass(
      "lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)]",
      "2xl:grid-cols-[minmax(0,1.25fr)_repeat(3,minmax(0,1fr))]",
      "wide:grid-cols-[minmax(0,1.25fr)_repeat(4,minmax(0,1fr))]"
    );
    // Every card is in the HTML: the width decides by CSS, never by JS.
    for (const n of [1, 2, 3]) {
      expect(itemOf(n)).not.toHaveClass("lg:hidden");
    }
  });

  it("4 ações: a 4ª aparece a partir de 2xl e o Ver todas some ali", () => {
    renderList(overdue(4));
    expect(itemOf(4)).toHaveClass("lg:hidden", "2xl:block");
    const seeAll = screen.getByRole("button", { name: "Ver todas (4)" });
    expect(seeAll.parentElement).toHaveClass(
      "lg:flex",
      "2xl:hidden",
      "wide:hidden"
    );
  });

  it("6 ações: a 6ª só aparece com Ver todas, que fica até em wide", () => {
    renderList(overdue(6));
    expect(itemOf(6)).toHaveClass("lg:hidden");
    expect(itemOf(6)).not.toHaveClass("wide:block");
    const seeAll = screen.getByRole("button", { name: "Ver todas (6)" });
    expect(seeAll.parentElement).toHaveClass("lg:flex");
    expect(seeAll.parentElement).not.toHaveClass("wide:hidden");
  });

  it("3 ações: nenhum Ver todas no desktop", () => {
    renderList(overdue(3));
    expect(screen.queryByRole("button", { name: "Ver todas (3)" })).toBeNull();
  });

  it("o carrossel contém os sr-only: o ul é relative", () => {
    // The sr-only texts (Money's full amount, "(abre o WhatsApp)") are
    // absolutely positioned: without a positioned ancestor inside the
    // carousel they escape its overflow-x and widen the whole page.
    renderList(overdue(5));
    expect(itemOf(1)?.parentElement).toHaveClass("relative", "overflow-x-auto");
  });

  it("convite: Aceitar e Recusar no próprio cartão", async () => {
    decline.mockResolvedValue({ data: { ok: true }, error: null });
    renderList([inviteAction()]);
    expect(screen.getByText("Faça primeiro · convite")).toBeVisible();
    expect(screen.getByText("Moto da Ana")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Recusar" }));
    await waitFor(() => expect(decline).toHaveBeenCalledTimes(1));
  });
});

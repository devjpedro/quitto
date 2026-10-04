import { QueryClient, useQuery } from "@tanstack/react-query";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type MouseEventHandler, type ReactNode, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActionList } from "@/features/home/components/action-list";
import { SeeAllButton } from "@/features/home/components/chips-row";
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

const NBSP = String.fromCharCode(0xa0);
/** Writes "~" for the no-break space the installment messages keep between numbers. */
const nb = (text: string) => text.replaceAll("~", NBSP);

const { markPaid, confirm, accept, decline } = vi.hoisted(() => ({
  markPaid: vi.fn(),
  confirm: vi.fn(),
  accept: vi.fn(),
  decline: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    api: {
      installments: ({ installmentId }: { installmentId: string }) => ({
        "mark-paid": { post: () => markPaid(installmentId) },
        confirm: { post: () => confirm(installmentId) },
      }),
      invites: ({ token }: { token: string }) => ({
        accept: { post: () => accept(token) },
        decline: { post: () => decline(token) },
      }),
    },
  },
}));

interface LinkProps {
  "aria-label"?: string;
  children: ReactNode;
  className?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  params?: { id: string };
  search?: { installment?: string; status?: string };
  to: string;
}

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({
    children,
    className,
    onClick,
    params,
    search,
    to,
    ...rest
  }: LinkProps) => {
    const query = new URLSearchParams(
      Object.entries(search ?? {}).filter(
        (entry): entry is [string, string] => entry[1] !== undefined
      )
    ).toString();
    return (
      <a
        aria-label={rest["aria-label"]}
        className={className}
        href={`${to.replace("$id", params?.id ?? "")}${query ? `?${query}` : ""}`}
        onClick={onClick}
      >
        {children}
      </a>
    );
  },
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

/** The list as the page mounts it: "Ver todas (N)" lives on the chips row and shares the state. */
function Actions({ actions }: { actions: HomeAction[] }) {
  const [expanded, setExpanded] = useState(false);
  const onToggle = () => setExpanded((value) => !value);
  return (
    <>
      <SeeAllButton
        count={actions.length}
        expanded={expanded}
        listId="acoes"
        onToggle={onToggle}
      />
      <ActionList
        actions={actions}
        expanded={expanded}
        listId="acoes"
        onToggle={onToggle}
        today={TODAY}
      />
    </>
  );
}

/** Actions as a static prop: the card under the finger never leaves the screen. */
function renderList(actions: HomeAction[] = [installmentAction()]) {
  return renderWithProviders(<Actions actions={actions} />, {
    client: makeClient(actions),
  });
}

/** Actions read from the cache, as on the page: the optimistic update removes the card. */
function LiveList() {
  const { data } = useQuery({
    queryKey: queryKeys.home,
    queryFn: () => new Promise<Home>(() => undefined),
  });
  return data ? <Actions actions={data.actions} /> : null;
}

function renderLive(actions: HomeAction[]) {
  return renderWithProviders(<LiveList />, { client: makeClient(actions) });
}

const WHATSAPP_NAME = /Cobrar no WhatsApp/;
const MARK_RECEIVED_NAME = /Marcar como recebida/;

/** "Venda do terreno": `sequences` of 60 overdue, Diego owes me. */
const terrenoGroup = (sequences: number[]) => {
  const oldest = Math.min(...sequences);
  return installmentAction({
    id: "overdue:vt:receive",
    kind: "overdue",
    direction: "receive",
    installmentId: `vt-${oldest}`,
    contractId: "vt",
    contractTitle: "Venda do terreno",
    sequence: oldest,
    installmentsCount: 60,
    amountCents: 200_000,
    dueDate: "2024-10-28",
    counterpartyName: "Diego Martins",
    pixCode: null,
    canMarkPaid: false,
    count: sequences.length,
    installmentIds: sequences.map((n) => `vt-${n}`),
    sequences,
    totalCents: sequences.length * 200_000,
  });
};

/** The decoded text of the card's "Cobrar no WhatsApp" link. */
const whatsappText = () =>
  decodeURIComponent(
    screen
      .getByRole("link", { name: "Cobrar no WhatsApp (abre o WhatsApp)" })
      .getAttribute("href") ?? ""
  );

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

/** The grid cell (`li`) of the card "Aluguel do apê · parcela n de 12". */
const itemOf = (n: number) =>
  screen
    .getByRole("article", { name: nb(`Aluguel do apê · parcela~${n}~de~12`) })
    .closest("li");

/** The card "Aluguel do apê · parcela n de 12", or null once it left the list. */
const articleOf = (n: number) =>
  screen.queryByRole("article", {
    name: nb(`Aluguel do apê · parcela~${n}~de~12`),
  });

/** Freezes the lock's clock (`Date.now`), so only `advance` moves it on. */
function frozenClock() {
  let now = Date.now();
  const spy = vi.spyOn(Date, "now").mockImplementation(() => now);
  return {
    advance: (ms: number) => {
      now += ms;
    },
    restore: () => spy.mockRestore(),
  };
}

/**
 * Records, per click on a link, whether the list cancelled it. Listens on
 * the document, after React's root listener, and then cancels the click
 * itself so jsdom never navigates.
 */
function watchLinkClicks() {
  const cancelled: boolean[] = [];
  const listener = (event: MouseEvent) => {
    if (event.target instanceof Element && event.target.closest("a")) {
      cancelled.push(event.defaultPrevented);
      event.preventDefault();
    }
  };
  document.addEventListener("click", listener);
  return {
    cancelled,
    stop: () => document.removeEventListener("click", listener),
  };
}

/** 1/12 has only "Já paguei" (no Pix); 2/12 is to receive (WhatsApp); 3/12 has "Pagar com PIX". */
const markPaidThenLinks = () => [
  installmentAction({ installmentId: "i1", sequence: 1, pixCode: null }),
  installmentAction({ installmentId: "i2", sequence: 2, direction: "receive" }),
  installmentAction({ installmentId: "i3", sequence: 3 }),
];

beforeEach(() => {
  markPaid.mockReset();
  confirm.mockReset();
  accept.mockReset();
  decline.mockReset();
});

describe("ActionList", () => {
  it("o primeiro cartão é o verde 'Faça primeiro', com Pagar com PIX e Já paguei", () => {
    renderList();
    const card = screen.getByRole("article", {
      name: nb("Aluguel do apê · parcela~7~de~12"),
    });
    expect(card).toBeVisible();
    // Fill, not outline (mockup 13): the green card and its hover step.
    expect(card).toHaveClass("bg-brand-surface", "hover:bg-brand-hover");
    expect(card).not.toHaveClass("border");
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
    // Frozen: the second tap stays inside the window however slow the machine is.
    const clock = frozenClock();
    try {
      renderLive(twoToPay());
      await userEvent.click(firstMarkPaid());
      await waitFor(() => expect(articleOf(1)).toBeNull());
      // The card 2/12 is now first, green, with its own "Já paguei" under the finger.
      await userEvent.click(firstMarkPaid());
      expect(markPaid).toHaveBeenCalledTimes(1);
      expect(markPaid).toHaveBeenCalledWith("i1");
    } finally {
      clock.restore();
    }
  });

  it("um toque deliberado depois da janela da trava funciona", async () => {
    markPaid.mockReturnValue(new Promise(() => undefined));
    const clock = frozenClock();
    try {
      renderLive(twoToPay());
      await userEvent.click(firstMarkPaid());
      await waitFor(() => expect(articleOf(1)).toBeNull());
      clock.advance(ACTION_LOCK_MS + 100);
      await userEvent.click(firstMarkPaid());
      await waitFor(() => expect(markPaid).toHaveBeenCalledTimes(2));
      expect(markPaid).toHaveBeenLastCalledWith("i2");
    } finally {
      clock.restore();
    }
  });

  it("toque duplo: o segundo toque não abre o link do cartão que deslizou (WhatsApp e PIX)", async () => {
    markPaid.mockReturnValue(new Promise(() => undefined));
    const clock = frozenClock();
    const links = watchLinkClicks();
    try {
      renderLive(markPaidThenLinks());
      await userEvent.click(firstMarkPaid());
      await waitFor(() => expect(articleOf(1)).toBeNull());
      // 2/12 slid into the place: its WhatsApp link, then 3/12's Pix link.
      await userEvent.click(
        screen.getByRole("link", {
          name: "Cobrar no WhatsApp (abre o WhatsApp)",
        })
      );
      await userEvent.click(
        screen.getByRole("link", { name: "Pagar com PIX" })
      );
      expect(links.cancelled).toEqual([true, true]);
    } finally {
      links.stop();
      clock.restore();
    }
  });

  it("depois da janela da trava, o link funciona", async () => {
    markPaid.mockReturnValue(new Promise(() => undefined));
    const clock = frozenClock();
    const links = watchLinkClicks();
    try {
      renderLive(markPaidThenLinks());
      await userEvent.click(firstMarkPaid());
      await waitFor(() => expect(articleOf(1)).toBeNull());
      clock.advance(ACTION_LOCK_MS + 100);
      await userEvent.click(
        screen.getByRole("link", {
          name: "Cobrar no WhatsApp (abre o WhatsApp)",
        })
      );
      expect(links.cancelled).toEqual([false]);
    } finally {
      links.stop();
      clock.restore();
    }
  });

  it("1 ação: largura toda no celular e 2 colunas no desktop", () => {
    renderList([installmentAction()]);
    const item = screen
      .getByRole("article", { name: nb("Aluguel do apê · parcela~7~de~12") })
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
    expect(screen.getByRole("button", { name: "Aceitar" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Recusar" }));
    await waitFor(() => expect(decline).toHaveBeenCalledWith("tok1"));
    expect(decline).toHaveBeenCalledTimes(1);
    expect(accept).not.toHaveBeenCalled();
  });

  it("Aguarda você: Conferir abre a parcela e Confirmar confirma ali mesmo", async () => {
    confirm.mockReturnValue(new Promise(() => undefined));
    renderList([installmentAction({ kind: "review", canConfirm: true })]);
    expect(screen.getByRole("link", { name: "Conferir" })).toHaveAttribute(
      "href",
      "/contracts/c1?installment=i1"
    );
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(confirm).toHaveBeenCalledWith("i1"));
    expect(markPaid).not.toHaveBeenCalled();
  });

  it("grupo a receber: Cobrar no WhatsApp cita todas e o total; Ver parcelas abre o contrato filtrado", () => {
    renderList([
      installmentAction({
        id: "overdue:nb:receive",
        kind: "overdue",
        direction: "receive",
        installmentId: "nb-3",
        contractId: "nb",
        contractTitle: "Notebook da Marina",
        sequence: 3,
        dueDate: "2026-08-30",
        counterpartyName: "Marina Pires",
        pixCode: null,
        canMarkPaid: false,
        count: 2,
        installmentIds: ["nb-3", "nb-4"],
        sequences: [3, 4],
        totalCents: 70_000,
      }),
    ]);
    const whatsapp = screen.getByRole("link", { name: WHATSAPP_NAME });
    expect(decodeURIComponent(whatsapp.getAttribute("href") ?? "")).toContain(
      "As parcelas 3 e 4 de “Notebook da Marina” estão em aberto, somando R$ 700,00"
    );
    expect(screen.getByRole("link", { name: "Ver parcelas" })).toHaveAttribute(
      "href",
      "/contracts/nb?status=overdue"
    );
    expect(
      screen.queryByRole("button", { name: MARK_RECEIVED_NAME })
    ).toBeNull();
  });

  it("grupo que você paga: Pagar a mais antiga abre a parcela mais antiga", () => {
    renderList([
      installmentAction({
        id: "overdue:al:pay",
        kind: "overdue",
        installmentId: "al-5",
        contractId: "al",
        sequence: 5,
        dueDate: "2026-09-01",
        pixCode: null,
        canMarkPaid: false,
        count: 2,
        installmentIds: ["al-5", "al-6"],
        sequences: [5, 6],
        totalCents: 250_000,
      }),
    ]);
    expect(
      screen.getByRole("link", { name: "Pagar a mais antiga" })
    ).toHaveAttribute("href", "/contracts/al?installment=al-5");
    expect(screen.queryByRole("button", { name: "Já paguei" })).toBeNull();
  });

  it("grupo que você paga: Pagar a mais antiga e Ver parcelas (ícone de 44 px no celular), nada que dispare mutação", () => {
    renderList([
      installmentAction({
        id: "overdue:al:pay",
        kind: "overdue",
        installmentId: "al-5",
        contractId: "al",
        sequence: 5,
        dueDate: "2026-09-01",
        pixCode: null,
        canMarkPaid: false,
        count: 2,
        installmentIds: ["al-5", "al-6"],
        sequences: [5, 6],
        totalCents: 250_000,
      }),
    ]);
    const card = screen.getByRole("article", {
      name: nb("Aluguel do apê · parcelas~5 e 6~de~12"),
    });
    expect(within(card).getByText("Faça primeiro · 2 atrasadas")).toBeVisible();
    // The name is in bold inside the line (PersonText): the line reads as one.
    const person = within(card).getByText("Maria Souza").parentElement;
    expect(person).toHaveTextContent("para Maria Souza · desde 01/09");
    expect(person).toBeVisible();
    expect(
      within(card).getByRole("link", { name: "Pagar a mais antiga" })
    ).toHaveAttribute("href", "/contracts/al?installment=al-5");
    const seeAll = within(card).getByRole("link", { name: "Ver parcelas" });
    expect(seeAll).toHaveAttribute("href", "/contracts/al?status=overdue");
    // On a phone a square icon button (h-11 from size sm, w-11 here), named by aria-label.
    expect(seeAll).toHaveClass("max-md:w-11", "max-md:px-0");
    expect(within(card).queryAllByRole("button")).toEqual([]);
  });

  it("grupo com lacuna: o nome do cartão e o WhatsApp dizem as faixas", () => {
    renderList([
      terrenoGroup([5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20]),
    ]);
    expect(
      screen.getByRole("article", {
        name: nb("Venda do terreno · parcelas~5~a~12 e 14~a~20~de~60"),
      })
    ).toBeVisible();
    expect(whatsappText()).toContain(
      nb("As parcelas 5~a~12 e 14~a~20 de “Venda do terreno” estão em aberto")
    );
  });

  it("grupo com mais de 3 itens: o nome do cartão e o WhatsApp dizem quantas e entre quais", () => {
    renderList([terrenoGroup([3, 5, 7, 9, 10, 11, 12])]);
    expect(
      screen.getByRole("article", {
        name: nb("Venda do terreno · 7 parcelas entre 3~e~12~de~60"),
      })
    ).toBeVisible();
    expect(whatsappText()).toContain(
      "7 parcelas de “Venda do terreno”, entre a 3 e a 12, estão em aberto"
    );
  });

  it("cartão comum: preenchido no tom quente, sem contorno, e o hover desce um degrau", () => {
    renderList(twoToPay());
    const second = screen.getByRole("article", {
      name: nb("Aluguel do apê · parcela~2~de~12"),
    });
    expect(second).toHaveClass(
      "bg-surface-card",
      "hover:bg-surface-card-hover"
    );
    expect(second).not.toHaveClass("border");
    expect(
      within(second).getByRole("button", { name: "Já paguei" })
    ).toHaveClass("bg-surface-inset");
  });

  it("cartão de parcela: a pessoa com rosto, a barra do contrato inteiro e a legenda", () => {
    renderList([
      installmentAction({ installmentId: "x0" }),
      installmentAction(),
    ]);
    const card = screen.getAllByRole("article")[1] as HTMLElement;
    expect(within(card).getByText("MS")).toHaveAttribute("aria-hidden", "true");
    expect(within(card).getByText("Maria Souza").tagName).toBe("B");
    expect(card.querySelectorAll("[data-status]")).toHaveLength(12);
    expect(within(card).getByText("6 de 12 pagas")).toBeVisible();
    expect(within(card).getByText("falta R$ 7.500,00")).toBeVisible();
  });

  it("legenda no cartão estreito: quebra a linha em vez de vazar, e o 'falta' fica à direita (1024 px)", () => {
    renderList([
      installmentAction({ installmentId: "x0" }),
      installmentAction(),
    ]);
    const card = screen.getAllByRole("article")[1] as HTMLElement;
    const remaining = within(card).getByText("falta R$ 7.500,00");
    // 182 px of content at 1024: "4 de 12 pagas" and "falta R$ 14.400,00" need 190.
    expect(remaining.parentElement).toHaveClass(
      "flex-wrap",
      "whitespace-nowrap"
    );
    expect(remaining).toHaveClass("ml-auto");
  });

  it("convite: avatar de 28 px, o título grande e as condições", () => {
    renderList([installmentAction({ installmentId: "x0" }), inviteAction()]);
    const card = screen.getAllByRole("article")[1] as HTMLElement;
    expect(within(card).getByText("A")).toHaveClass("size-7");
    expect(within(card).getByText("4 parcelas de R$ 300,00")).toBeVisible();
    expect(card).toHaveTextContent("a partir de 10/11");
    // A narrow card (1024 px) wraps before "· a partir de 10/11", never inside it.
    expect(within(card).getByText("· a partir de 10/11")).toHaveClass(
      "whitespace-nowrap"
    );
  });

  it("cartão estreito: os botões empilham na largura toda, sem meia linha (O2, 1024 px)", () => {
    renderList([installmentAction({ kind: "review", canConfirm: true })]);
    const card = screen.getByRole("article");
    expect(card).toHaveClass("@container");
    for (const control of [
      screen.getByRole("link", { name: "Conferir" }),
      screen.getByRole("button", { name: "Confirmar" }),
    ]) {
      expect(control).toHaveClass("@max-[15rem]:w-full");
    }
  });

  it("par a receber (Cobrar no WhatsApp + Marcar como recebida, 362 px): empilha abaixo de 368 px, nunca um botão sozinho na linha", () => {
    renderList([
      installmentAction({ installmentId: "x0" }),
      installmentAction({ installmentId: "r1", direction: "receive" }),
    ]);
    const card = screen.getAllByRole("article")[1] as HTMLElement;
    for (const control of [
      within(card).getByRole("link", { name: WHATSAPP_NAME }),
      within(card).getByRole("button", { name: MARK_RECEIVED_NAME }),
    ]) {
      expect(control).toHaveClass("@max-[23rem]:w-full");
      expect(control).not.toHaveClass("@max-[15rem]:w-full");
    }
  });

  it("pares de grupo com o rótulo Ver parcelas: empilham a partir de md abaixo do que pedem (331 e 267 px); no celular o ícone de 44 px cabe", () => {
    const group = {
      kind: "overdue",
      pixCode: null,
      canMarkPaid: false,
      count: 2,
    } as const;
    renderList([
      installmentAction({ installmentId: "x0" }),
      installmentAction({
        ...group,
        id: "overdue:nb:receive",
        direction: "receive",
        installmentId: "nb-3",
        contractId: "nb",
        contractTitle: "Notebook da Marina",
        sequence: 3,
        installmentIds: ["nb-3", "nb-4"],
        sequences: [3, 4],
      }),
      installmentAction({
        ...group,
        id: "overdue:al:pay",
        installmentId: "al-5",
        contractId: "al",
        sequence: 5,
        installmentIds: ["al-5", "al-6"],
        sequences: [5, 6],
      }),
    ]);
    const [, receive, pay] = screen.getAllByRole("article") as HTMLElement[];
    for (const control of [
      within(receive as HTMLElement).getByRole("link", { name: WHATSAPP_NAME }),
      within(receive as HTMLElement).getByRole("link", {
        name: "Ver parcelas",
      }),
    ]) {
      expect(control).toHaveClass(
        "@max-[15rem]:w-full",
        "md:@max-[21rem]:w-full"
      );
    }
    for (const control of [
      within(pay as HTMLElement).getByRole("link", {
        name: "Pagar a mais antiga",
      }),
      within(pay as HTMLElement).getByRole("link", { name: "Ver parcelas" }),
    ]) {
      expect(control).toHaveClass(
        "@max-[15rem]:w-full",
        "md:@max-[17rem]:w-full"
      );
    }
  });

  it("12 px entre os cartões, no carrossel e na grade", () => {
    renderList(overdue(3));
    expect(itemOf(1)?.parentElement).toHaveClass("gap-3");
  });

  it("Já paguei ao lado de um grupo: a falha devolve só o cartão simples, no mesmo lugar, e a contagem volta", async () => {
    let respond: (value: unknown) => void = () => undefined;
    markPaid.mockReturnValue(
      new Promise((resolve) => {
        respond = resolve;
      })
    );
    const group = installmentAction({
      id: "overdue:nb:receive",
      kind: "overdue",
      direction: "receive",
      installmentId: "nb-3",
      contractId: "nb",
      contractTitle: "Notebook da Marina",
      dueDate: "2026-08-30",
      pixCode: null,
      canMarkPaid: false,
      count: 2,
      installmentIds: ["nb-3", "nb-4"],
      sequences: [3, 4],
      totalCents: 70_000,
    });
    const single = installmentAction({
      installmentId: "i2",
      sequence: 2,
      pixCode: null,
    });
    // A card after the single one: putting it back at the end would show.
    const review = installmentAction({
      id: "installment:r3",
      kind: "review",
      installmentId: "r3",
      contractId: "mr",
      contractTitle: "Moto do Rafa",
      sequence: 3,
      installmentsCount: 10,
      canConfirm: true,
    });
    const client = makeClient([group, single, review]);
    const cachedIds = () =>
      client
        .getQueryData<Home>(queryKeys.home)
        ?.actions.map((action) => action.id);
    renderWithProviders(<LiveList />, { client });
    await userEvent.click(screen.getByRole("button", { name: "Já paguei" }));
    await waitFor(() => expect(markPaid).toHaveBeenCalledWith("i2"));
    // In flight the card has already left, from the screen and the cache.
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(2));
    expect(cachedIds()).toEqual([group.id, review.id]);
    respond({ data: null, error: { status: 422, value: null } });
    // The refusal brings back only the single card, where it was: between the
    // group and the next card, not at the end.
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(3));
    const [first, second, third] = screen.getAllByRole("article");
    expect(first).toHaveTextContent("Notebook da Marina");
    // toHaveTextContent folds the no-break spaces into plain ones.
    expect(second).toHaveTextContent("Aluguel do apê · parcela 2 de 12");
    expect(third).toHaveTextContent("Moto do Rafa");
    // And the count goes back with it: pending counts are cards, read from the cache.
    expect(cachedIds()).toEqual([group.id, single.id, review.id]);
  });
});

// Without a card left the home drops the list, and the page hands the focus
// to the summary (home-page.test.tsx, "quando sai a última ação").
describe("ActionList · foco depois da ação", () => {
  it("pelo teclado: o foco vai para o 1º botão do cartão que ficou no mesmo lugar", async () => {
    markPaid.mockReturnValue(new Promise(() => undefined));
    renderLive(twoToPay());
    await userEvent.tab(); // "Pagar com PIX" of 1/12
    await userEvent.tab(); // "Já paguei" of 1/12
    const card = articleOf(1) as HTMLElement;
    expect(document.activeElement).toBe(
      within(card).getByRole("button", { name: "Já paguei" })
    );
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(articleOf(1)).toBeNull());
    expect(document.activeElement).toBe(
      within(articleOf(2) as HTMLElement).getByRole("link", {
        name: "Pagar com PIX",
      })
    );
  });

  it("pelo teclado: quando sai o último cartão, o foco vai para o anterior", async () => {
    markPaid.mockReturnValue(new Promise(() => undefined));
    renderLive(twoToPay());
    for (let i = 0; i < 4; i++) {
      await userEvent.tab(); // Pix and "Já paguei" of 1/12, then of 2/12
    }
    expect(document.activeElement).toBe(
      within(articleOf(2) as HTMLElement).getByRole("button", {
        name: "Já paguei",
      })
    );
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(articleOf(2)).toBeNull());
    expect(document.activeElement).toBe(
      within(articleOf(1) as HTMLElement).getByRole("link", {
        name: "Pagar com PIX",
      })
    );
  });

  it("um link não tira o cartão, e o foco fica nele", async () => {
    const links = watchLinkClicks();
    try {
      renderLive(twoToPay());
      await userEvent.tab();
      await userEvent.keyboard("{Enter}");
      expect(links.cancelled).toEqual([false]);
      expect(articleOf(1)).not.toBeNull();
      expect(document.activeElement).toBe(
        within(articleOf(1) as HTMLElement).getByRole("link", {
          name: "Pagar com PIX",
        })
      );
    } finally {
      links.stop();
    }
  });

  it("segurar Enter não age no cartão que recebeu o foco: a repetição da tecla é cancelada", async () => {
    markPaid.mockReturnValue(new Promise(() => undefined));
    // No Pix: each card's first button is its "Já paguei".
    renderLive([
      installmentAction({ installmentId: "i1", sequence: 1, pixCode: null }),
      installmentAction({ installmentId: "i2", sequence: 2, pixCode: null }),
    ]);
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(articleOf(1)).toBeNull());
    const next = within(articleOf(2) as HTMLElement).getByRole("button", {
      name: "Já paguei",
    });
    expect(document.activeElement).toBe(next);
    // user-event 14.6 never marks a held key as a repeat (its keydown carries
    // only key and code), so the auto-repeat is a native KeyboardEvent here.
    const keydown = (key: string, repeat: boolean) =>
      next.dispatchEvent(
        new KeyboardEvent("keydown", {
          key,
          repeat,
          bubbles: true,
          cancelable: true,
        })
      );
    // dispatchEvent is false when the list cancelled the keydown (and with it the activation).
    expect(keydown("Enter", true)).toBe(false);
    expect(keydown(" ", true)).toBe(false);
    expect(keydown("Enter", false)).toBe(true);
    expect(markPaid).toHaveBeenCalledTimes(1);
    expect(markPaid).toHaveBeenCalledWith("i1");
  });
});

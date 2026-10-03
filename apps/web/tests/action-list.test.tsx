import { QueryClient, useQuery } from "@tanstack/react-query";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MouseEventHandler, ReactNode } from "react";
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

const WHATSAPP_NAME = /Cobrar no WhatsApp/;
const MARK_RECEIVED_NAME = /Marcar como recebida/;

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
    .getByRole("article", { name: `Aluguel do apê · parcela ${n} de 12` })
    .closest("li");

/** The card "Aluguel do apê · parcela n de 12", or null once it left the list. */
const articleOf = (n: number) =>
  screen.queryByRole("article", {
    name: `Aluguel do apê · parcela ${n} de 12`,
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
      name: "Aluguel do apê · parcela 7 de 12",
    });
    expect(card).toBeVisible();
    // Same 1 px border as the white cards, in the card's own green (mockup 11):
    // the content lines up across the row.
    expect(card).toHaveClass("border", "border-brand-surface");
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
      .getByRole("article", { name: "Aluguel do apê · parcela 7 de 12" })
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

  it("grupo a receber: Cobrar no WhatsApp cita todas e o total; Ver parcelas abre o contrato", () => {
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
    // The filter (?status=overdue) comes with Task 12b.
    expect(screen.getByRole("link", { name: "Ver parcelas" })).toHaveAttribute(
      "href",
      "/contracts/nb"
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

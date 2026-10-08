import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { person, personContract } from "./people-fixtures";
import { renderWithProviders } from "./test-utils";

const { getPeople, nav } = vi.hoisted(() => ({
  getPeople: vi.fn(),
  nav: {
    search: {} as { person?: string },
    rerender: (() => undefined) as () => void,
    pushed: false,
  },
}));

vi.mock("@/lib/api", () => ({
  api: { api: { people: { get: () => getPeople() } } },
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({
    children,
    params,
    to,
    ...rest
  }: {
    children: ReactNode;
    params?: { id: string };
    to: string;
  }) => (
    <a
      data-testid={(rest as { "data-testid"?: string })["data-testid"]}
      href={params ? to.replace("$id", params.id) : to}
    >
      {children}
    </a>
  ),
  getRouteApi: () => ({ useSearch: () => nav.search }),
  useRouter: () => ({
    state: { location: { state: { panel: nav.pushed } } },
    history: {
      back: () => {
        nav.search = {};
        nav.rerender();
      },
    },
    subscribe: (_event: string, callback: () => void) => {
      queueMicrotask(callback);
      return () => undefined;
    },
  }),
  useNavigate:
    () => (opts: { search: { person?: string }; state?: unknown }) => {
      nav.search = opts.search;
      nav.pushed = typeof opts.state === "object";
      nav.rerender();
      return Promise.resolve();
    },
}));

import { PeoplePage } from "@/features/people/components/people-page";

const CARLOS = person({
  key: "aaaaaaaaaaaaaaaa",
  contracts: [
    personContract({ contractId: "emp", title: "Empréstimo do Carlos" }),
    personContract({
      contractId: "gel",
      title: "Geladeira do Carlos",
      settled: true,
      paidCount: 5,
      installmentsCount: 5,
      remainingCents: 0,
    }),
  ],
});
const ANA = person({
  key: "bbbbbbbbbbbbbbbb",
  name: "Ana Rocha",
  youOweCents: 0,
  owesYouCents: 32_000,
  contracts: [
    personContract({
      contractId: "cel",
      title: "Celular da Ana",
      direction: "receive",
    }),
  ],
});

function renderPage(people: ReturnType<typeof person>[]) {
  getPeople.mockResolvedValue({ data: { people }, error: null });
  const view = renderWithProviders(<PeoplePage />);
  nav.rerender = () => view.rerender(<PeoplePage />);
  return view;
}

describe("PeoplePage", () => {
  beforeEach(() => {
    nav.search = {};
    nav.pushed = false;
    getPeople.mockReset();
  });

  it("tocar no cartão abre o sheet com os contratos e escreve ?person", async () => {
    const user = userEvent.setup();
    renderPage([CARLOS, ANA]);
    await user.click(await screen.findByTestId("person-card-aaaaaaaaaaaaaaaa"));
    expect(nav.search).toEqual({ person: "aaaaaaaaaaaaaaaa" });
    const sheet = await screen.findByTestId("person-sheet");
    expect(sheet).toHaveTextContent("Empréstimo do Carlos");
    expect(sheet).toHaveTextContent("Geladeira do Carlos");
    expect(screen.getByTestId("person-contract-emp")).toHaveAttribute(
      "href",
      "/contracts/emp"
    );
  });

  it("Esc fecha e devolve o foco ao cartão", async () => {
    const user = userEvent.setup();
    renderPage([CARLOS]);
    const card = await screen.findByTestId("person-card-aaaaaaaaaaaaaaaa");
    await user.click(card);
    await screen.findByTestId("person-sheet");
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByTestId("person-sheet")).toBeNull()
    );
    await waitFor(() => expect(card).toHaveFocus());
  });

  it("os totais somam por direção, nunca juntos", async () => {
    renderPage([CARLOS, ANA]);
    await screen.findByTestId("person-card-aaaaaaaaaaaaaaaa");
    const totals = within(
      screen.getByRole("list", { name: "Saldo com as pessoas" })
    );
    expect(totals.getByText("R$ 320,00")).toBeVisible();
    expect(totals.getByText("R$ 2.000,00")).toBeVisible();
  });

  it("sem pessoas: o vazio com Ir para contratos", async () => {
    renderPage([]);
    expect(await screen.findByText("Só você por enquanto")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Ir para contratos" })
    ).toBeVisible();
  });
});

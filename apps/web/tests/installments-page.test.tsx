import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PanelRoute } from "@/features/installments/types";
import { listInstallment } from "./installments-fixtures";
import { renderWithProviders } from "./test-utils";

const { getList, nav, gone } = vi.hoisted(() => ({
  getList: vi.fn(),
  gone: vi.fn(),
  nav: {
    search: { month: "2026-10" } as Record<string, unknown>,
    to: null as null | { to: string; params?: unknown; search?: unknown },
    rerender: (() => undefined) as () => void,
  },
}));

vi.mock("@/lib/api", () => ({
  api: { api: { installments: { get: (arg: unknown) => getList(arg) } } },
}));

vi.mock("@/features/contracts/api", () => ({
  contractQueryOptions: (id: string) => ({
    queryKey: ["contract", id],
    queryFn: async () => ({
      contract: { id, title: "Contrato" },
      installments: [],
      role: "buyer",
      participants: [],
    }),
  }),
}));

vi.mock("@/features/installments/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/installments/api")>()),
  installmentQueryOptions: (id: string) => ({
    queryKey: ["installment", id],
    queryFn: async () => null,
  }),
}));

// The panel is the contract page's concern: the aside stub shows what the route gave it.
vi.mock("@/features/installments/components/installments-aside", () => ({
  InstallmentsAside: ({
    contractId,
    panel,
  }: {
    contractId?: string;
    panel: PanelRoute;
  }) =>
    contractId && panel.installmentId ? (
      <div data-testid="panel-stub">
        open: {panel.installmentId} of {contractId}
        <button
          onClick={() =>
            panel.openInstallment(
              panel.neighbors(panel.installmentId ?? "").next ?? ""
            )
          }
          type="button"
        >
          próxima
        </button>
        <button
          onClick={() => panel.openHistory({ closePanel: true })}
          type="button"
        >
          Histórico
        </button>
      </div>
    ) : null,
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  getRouteApi: () => ({ useSearch: () => nav.search }),
  useRouter: () => ({
    state: { location: { state: {} } },
    history: { back: gone },
    subscribe: () => () => undefined,
  }),
  useNavigate:
    () =>
    (opts: {
      search?: (prev: Record<string, unknown>) => Record<string, unknown>;
      to?: string;
      params?: unknown;
    }) => {
      if (opts.to) {
        nav.to = { to: opts.to, params: opts.params, search: opts.search };
        return Promise.resolve();
      }
      nav.search = opts.search ? opts.search(nav.search) : nav.search;
      nav.rerender();
      return Promise.resolve();
    },
}));

import { InstallmentsPage } from "@/features/installments/components/installments-page";

const OVERDUE = listInstallment({
  installmentId: "o1",
  contractId: "cm",
  contractTitle: "Moto do Rafa",
  dueDate: "2026-09-03",
  direction: "receive",
  counterpartyName: "Rafael Prado",
  amountCents: 48_000,
});
const WEEK = listInstallment({
  installmentId: "w1",
  contractId: "cc",
  contractTitle: "Empréstimo do Carlos",
  dueDate: "2026-10-08",
});
const LATER = listInstallment({
  installmentId: "l1",
  contractId: "ca",
  contractTitle: "Celular da Ana",
  dueDate: "2026-10-18",
  direction: "receive",
  counterpartyName: "Ana Rocha",
});

async function renderPage() {
  getList.mockResolvedValue({
    data: {
      today: "2026-10-08",
      hasContracts: true,
      items: [OVERDUE, WEEK, LATER],
    },
    error: null,
  });
  const view = renderWithProviders(<InstallmentsPage />);
  nav.rerender = () => view.rerender(<InstallmentsPage />);
  await screen.findByText("Moto do Rafa");
  return view;
}

describe("InstallmentsPage", () => {
  beforeEach(() => {
    nav.search = { month: "2026-10" };
    nav.to = null;
    getList.mockReset();
    gone.mockReset();
  });

  it("agrupa por urgência, com o total de cada grupo", async () => {
    await renderPage();
    expect(screen.getByTestId("installments-group-overdue")).toBeVisible();
    expect(screen.getByTestId("installments-group-week")).toBeVisible();
    expect(screen.getByTestId("installments-group-month")).toBeVisible();
    expect(screen.getByText("Ainda em outubro")).toBeVisible();
    expect(screen.getByText("Vence hoje")).toBeVisible();
  });

  it("tocar na linha abre o painel com ?installment e ?contract", async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByTestId("installment-row-w1"));
    expect(nav.search).toMatchObject({ installment: "w1", contract: "cc" });
    expect(await screen.findByTestId("panel-stub")).toHaveTextContent(
      "w1 of cc"
    );
  });

  it("↑ ↓ seguem a ordem da tela, de um contrato para outro", async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByTestId("installment-row-o1"));
    await user.click(await screen.findByRole("button", { name: "próxima" }));
    expect(nav.search).toMatchObject({ installment: "w1", contract: "cc" });
    await user.click(await screen.findByRole("button", { name: "próxima" }));
    expect(nav.search).toMatchObject({ installment: "l1", contract: "ca" });
  });

  it("Histórico leva à aba do contrato", async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByTestId("installment-row-w1"));
    await user.click(await screen.findByRole("button", { name: "Histórico" }));
    expect(nav.to).toMatchObject({
      to: "/contracts/$id",
      params: { id: "cc" },
    });
  });

  it("o chip A receber esconde as de pagar e escreve ?filter=receive", async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole("radio", { name: "A receber" }));
    expect(nav.search).toMatchObject({ filter: "receive" });
    await waitFor(() =>
      expect(screen.queryByText("Empréstimo do Carlos")).toBeNull()
    );
    expect(screen.getByText("Celular da Ana")).toBeVisible();
  });

  it("‹ volta um mês e Este mês aparece", async () => {
    const user = userEvent.setup();
    await renderPage();
    expect(screen.queryByRole("button", { name: "Este mês" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(nav.search).toMatchObject({ month: "2026-09" });
  });

  it("atrasadas do mesmo contrato: uma linha por parcela, sem accordion", async () => {
    const run = [3, 4].map((sequence) =>
      listInstallment({
        installmentId: `r${sequence}`,
        contractId: "cn",
        contractTitle: "Notebook da Marina",
        counterpartyName: "Marina Pires",
        direction: "receive",
        dueDate: `2026-0${sequence + 3}-10`,
        sequence,
        installmentsCount: 12,
      })
    );
    getList.mockResolvedValue({
      data: { today: "2026-10-08", hasContracts: true, items: run },
      error: null,
    });
    renderWithProviders(<InstallmentsPage />);
    const first = await screen.findByTestId("installment-row-r3");
    expect(first).toHaveTextContent("Notebook da Marina");
    expect(screen.getByTestId("installment-row-r4")).toHaveTextContent(
      "Notebook da Marina"
    );
    expect(screen.queryByTestId("installment-run-r3")).toBeNull();
    // The month Select is the only control that expands: no row opens a group.
    expect(
      document.querySelectorAll("[aria-expanded]:not([role='combobox'])")
    ).toHaveLength(0);
  });

  it("um mês futuro vazio oferece voltar ao mês de hoje, não o próximo", async () => {
    const user = userEvent.setup();
    nav.search = { month: "2026-12" };
    getList.mockResolvedValue({
      data: { today: "2026-10-08", hasContracts: true, items: [] },
      error: null,
    });
    const view = renderWithProviders(<InstallmentsPage />);
    nav.rerender = () => view.rerender(<InstallmentsPage />);
    await user.click(
      await screen.findByRole("button", { name: "Voltar para outubro" })
    );
    expect(nav.search.month).toBeUndefined();
    expect(screen.queryByRole("button", { name: "Ver janeiro" })).toBeNull();
  });
});

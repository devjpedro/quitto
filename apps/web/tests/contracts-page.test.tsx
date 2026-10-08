import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContractsPage } from "@/features/contracts/components/contracts-page";
import { tourStore } from "@/features/tour/lib/tour-store";
import { listItem } from "./contracts-fixtures";
import { renderWithProviders } from "./test-utils";

const { getContracts, nav } = vi.hoisted(() => ({
  getContracts: vi.fn(),
  nav: {
    search: {} as Record<string, unknown>,
    rerender: (() => undefined) as () => void,
  },
}));

vi.mock("@/lib/api", () => ({
  api: { api: { contracts: { get: () => getContracts() } } },
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({
    children,
    className,
    params,
    to,
    ...rest
  }: {
    children: ReactNode;
    className?: string;
    params?: { id: string };
    to: string;
  }) => (
    <a
      className={className}
      data-testid={(rest as { "data-testid"?: string })["data-testid"]}
      href={params ? to.replace("$id", params.id) : to}
    >
      {children}
    </a>
  ),
  getRouteApi: () => ({
    useSearch: () => nav.search,
    useNavigate: () => (opts: { search: Record<string, unknown> }) => {
      nav.search = opts.search;
      nav.rerender();
    },
  }),
}));

const TO_PAY = /a pagar$/;

const PAY = listItem({ id: "pay", title: "Empréstimo do Carlos" });
const RECEIVE = listItem({
  id: "rec",
  title: "Notebook da Marina",
  direction: "receive",
  counterpartyName: "Marina Pires",
  remainingCents: 400_000,
});
const DONE = listItem({
  id: "done",
  title: "Geladeira do Carlos",
  settled: true,
  remainingCents: 0,
  endDate: "2026-08-10",
});

async function renderPage(items: ReturnType<typeof listItem>[]) {
  getContracts.mockResolvedValue({ data: items, error: null });
  const view = renderWithProviders(<ContractsPage />);
  nav.rerender = () => view.rerender(<ContractsPage />);
  await screen.findByTestId("contracts-toolbar").catch(() => undefined);
  return view;
}

describe("ContractsPage", () => {
  beforeEach(() => {
    nav.search = {};
    getContracts.mockReset();
  });

  it("trocar para Concluídos mostra só o quitado e escreve ?show=done", async () => {
    const user = userEvent.setup();
    await renderPage([PAY, DONE]);
    expect(await screen.findByText("Empréstimo do Carlos")).toBeVisible();
    await user.click(screen.getByRole("radio", { name: "Concluídos 1" }));
    expect(nav.search).toMatchObject({ show: "done" });
    expect(await screen.findByText("Geladeira do Carlos")).toBeVisible();
    expect(screen.queryByText("Empréstimo do Carlos")).toBeNull();
    expect(screen.getByText("Quitado")).toBeVisible();
  });

  it("Recebo esconde o contrato que você paga e o chip a pagar", async () => {
    const user = userEvent.setup();
    await renderPage([PAY, RECEIVE]);
    expect(await screen.findByText(TO_PAY)).toBeVisible();
    await user.click(screen.getByRole("radio", { name: "Recebo" }));
    expect(screen.queryByText("Empréstimo do Carlos")).toBeNull();
    expect(screen.getByText("Notebook da Marina")).toBeVisible();
    expect(screen.queryByText(TO_PAY)).toBeNull();
  });

  it("sem contratos: o palco sem cartão fantasma, Novo contrato e o tour", async () => {
    await renderPage([]);
    expect(await screen.findByText("Nenhum contrato ainda")).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Novo contrato" })).toHaveLength(
      1
    );
    // The tour starts from the empty state of a new account.
    await userEvent.click(screen.getByRole("button", { name: "Fazer o tour" }));
    expect(tourStore.isOpen()).toBe(true);
    tourStore.close();
  });

  it("tudo quitado: o anel cheio com ✓ diz que é o fim, e Ver concluídos abre a aba", async () => {
    const { container } = await renderPage([DONE]);
    expect(await screen.findByText("Nenhum contrato ativo")).toBeVisible();
    expect(
      screen.getByText("Todos os seus contratos foram quitados.")
    ).toBeVisible();
    expect(container.querySelector(".border-dashed")).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Ver concluídos" })
    );
    expect(nav.search).toMatchObject({ show: "done" });
  });

  it("o valor da célula não corta: o R$ vai pequeno e o número inteiro", async () => {
    await renderPage([listItem({ id: "big", remainingCents: 1_440_000 })]);
    const card = await screen.findByTestId("contract-card-big");
    expect(card).toHaveTextContent("R$14.400,00");
  });

  it("o cartão leva ao contrato", async () => {
    await renderPage([PAY]);
    const card = await screen.findByTestId("contract-card-pay");
    expect(card).toHaveAttribute("href", "/contracts/pay");
  });
});

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContractsPage } from "@/features/contracts/components/contracts-page";
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

  it("sem contratos: os contornos e Novo contrato", async () => {
    await renderPage([]);
    expect(await screen.findByText("Seus acordos aparecem aqui")).toBeVisible();
    expect(
      screen.getAllByRole("link", { name: "Novo contrato" }).length
    ).toBeGreaterThan(0);
  });

  it("o cartão leva ao contrato", async () => {
    await renderPage([PAY]);
    const card = await screen.findByTestId("contract-card-pay");
    expect(card).toHaveAttribute("href", "/contracts/pay");
  });
});

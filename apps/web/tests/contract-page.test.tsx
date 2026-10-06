import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContractPage } from "@/features/contracts/components/contract-page";
import type { ContractDetail } from "@/features/contracts/types";
import { queryKeys } from "@/lib/query-keys";
import { motoDetail } from "./contract-fixtures";
import { makeTestQueryClient, renderWithProviders } from "./test-utils";

const { navigate, route, served } = vi.hoisted(() => ({
  navigate: vi.fn(),
  route: { search: {} as Record<string, unknown> },
  served: {
    response: { data: null, error: null } as {
      data: unknown;
      error: unknown;
    },
    get: vi.fn(),
  },
}));

vi.mock("@/lib/api", () => ({
  api: {
    api: {
      contracts: () => ({ get: () => served.get() }),
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
  useNavigate: () => navigate,
  useParams: () => ({ id: "c-moto" }),
  useSearch: () => route.search,
}));

const TERMS = "R$ 480,00 todo dia 30 · 10 parcelas · com confirmação";
const PERCENT = /\d+\s?%/;
const CONFIRMATION = /com confirmação/;

function renderContract(detail: ContractDetail | null) {
  const client = makeTestQueryClient();
  // Held as on the page (the test client's gcTime 0 would drop it).
  client.setQueryDefaults(queryKeys.contract("c-moto"), {
    gcTime: Number.POSITIVE_INFINITY,
  });
  if (detail) {
    client.setQueryData(queryKeys.contract("c-moto"), detail);
    served.response = { data: detail, error: null };
  }
  return renderWithProviders(<ContractPage />, { client });
}

beforeEach(() => {
  // Only Date: user-event keeps its real timers.
  vi.useFakeTimers({ now: new Date("2026-10-05T15:00:00Z"), toFake: ["Date"] });
  navigate.mockReset();
  route.search = {};
  served.get.mockReset();
  served.get.mockImplementation(() => Promise.resolve(served.response));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ContractPage (mockup 14, topo)", () => {
  it("topo: título, quem paga, as condições uma vez, Falta receber R$ 3.840,00 de R$ 4.800,00, a legenda com a contagem e 'termina em mar/2027'", () => {
    renderContract(motoDetail());
    expect(
      screen.getByRole("heading", { level: 1, name: "Moto do Rafa" })
    ).toBeVisible();
    expect(screen.getByText("Rafael Prado").parentElement).toHaveTextContent(
      "Rafael Prado te paga"
    );
    // Said once, in the other party's line (on a phone it wraps to its own line).
    const terms = screen.getByText(TERMS);
    expect(terms.parentElement).toHaveTextContent(
      `Rafael Prado te paga${TERMS}`
    );
    expect(terms).toHaveClass("max-md:basis-full");

    const hero = within(screen.getByTestId("contract-hero"));
    expect(hero.getByText("Falta receber")).toBeVisible();
    expect(hero.getByText("R$ 3.840,00")).toBeInTheDocument();
    expect(hero.getByText("de R$ 4.800,00")).toBeVisible();
    // The bar (8 px) once, one segment per installment, and its key in words.
    const bar = screen
      .getByTestId("contract-hero")
      .querySelectorAll("[data-status]");
    expect(bar).toHaveLength(10);
    const key = hero.getByText("termina em mar/2027").parentElement;
    expect(key).toHaveTextContent(
      "2 confirmadas1 atrasada1 para conferir6 a recebertermina em mar/2027"
    );
  });

  it("sem chips de status ao lado do título, e nada de faixa de números", () => {
    renderContract(motoDetail());
    const titleRow = screen.getByRole("heading", { level: 1 })
      .parentElement as HTMLElement;
    // The title and the two filled buttons, nothing else (the counts live in the bar's key).
    expect(titleRow.children).toHaveLength(2);
    expect(titleRow.querySelector(".rounded-full")).toBeNull();
    expect(within(titleRow).queryByText("atrasada")).toBeNull();
    // No strip of numbers: no paid total, no %, no installment count beside the hero.
    expect(screen.queryByText("R$ 960,00")).toBeNull();
    expect(screen.queryByText(PERCENT)).toBeNull();
    expect(screen.getAllByText("R$ 3.840,00")).toHaveLength(1);
    expect(screen.getAllByText(TERMS)).toHaveLength(1);
  });

  it("o espectador: Você acompanha, os dois rostos, quem paga quem, Falta quitar e as condições sem 'com confirmação' (F5)", () => {
    renderContract(
      motoDetail({ role: "viewer", isOwner: false, isApprover: false })
    );
    expect(screen.getByText("Você acompanha")).toBeVisible();
    expect(screen.getByText("RP")).toBeInTheDocument();
    expect(screen.getByText("JS")).toBeInTheDocument();
    expect(screen.getByText("Rafael Prado").parentElement).toHaveTextContent(
      "Rafael Prado paga João Souza"
    );
    expect(
      screen.getByText("R$ 480,00 todo dia 30 · 10 parcelas")
    ).toBeVisible();
    expect(screen.queryByText(CONFIRMATION)).toBeNull();
    expect(
      within(screen.getByTestId("contract-hero")).getByText("Falta quitar")
    ).toBeVisible();
  });

  it("o dono vê Exportar e o ⋯ com Editar, Excluir; quem não é dono vê só Sair do contrato", async () => {
    const user = userEvent.setup();
    const { unmount } = renderContract(motoDetail());
    await user.click(screen.getByRole("button", { name: "Exportar" }));
    expect(
      await screen.findByRole("menuitem", { name: "Extrato em PDF" })
    ).toHaveAttribute("href", "/api/contracts/c-moto/statement.pdf");
    expect(
      screen.getByRole("menuitem", { name: "Planilha .csv" })
    ).toHaveAttribute("href", "/api/contracts/c-moto/statement.csv");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Ações do contrato" }));
    expect(
      await screen.findByRole("menuitem", { name: "Editar título e descrição" })
    ).toBeVisible();
    expect(
      screen.getByRole("menuitem", { name: "Excluir contrato" })
    ).toBeVisible();
    expect(
      screen.queryByRole("menuitem", { name: "Sair do contrato" })
    ).toBeNull();
    unmount();

    renderContract(
      motoDetail({
        role: "buyer",
        isOwner: false,
        isPayer: true,
        isApprover: false,
      })
    );
    await user.click(screen.getByRole("button", { name: "Ações do contrato" }));
    expect(
      await screen.findByRole("menuitem", { name: "Sair do contrato" })
    ).toBeVisible();
    expect(screen.getAllByRole("menuitem")).toHaveLength(1);
  });

  it("trocar de aba navega com tab=people sem replace e sem rolar ao topo; voltar para Parcelas tira o tab", async () => {
    const user = userEvent.setup();
    const { unmount } = renderContract(motoDetail());
    // Pessoas carries the count; Parcelas none.
    expect(screen.getByRole("radio", { name: "Parcelas" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    await user.click(screen.getByRole("radio", { name: "Pessoas 3" }));
    expect(navigate).toHaveBeenCalledTimes(1);
    const toPeople = navigate.mock.calls[0]?.[0];
    expect(toPeople.replace).toBeUndefined();
    // The tabs sit below the hero: the page stays where the tap was.
    expect(toPeople.resetScroll).toBe(false);
    expect(toPeople.search({ installment: "i4" })).toEqual({
      installment: "i4",
      tab: "people",
    });
    unmount();

    navigate.mockReset();
    route.search = { tab: "people" };
    renderContract(motoDetail());
    await user.click(screen.getByRole("radio", { name: "Parcelas" }));
    const toInstallments = navigate.mock.calls[0]?.[0];
    expect(toInstallments.replace).toBeUndefined();
    expect(toInstallments.resetScroll).toBe(false);
    expect(toInstallments.search({ tab: "people" })).toEqual({
      tab: undefined,
    });
  });

  it("404 mostra Contrato não encontrado com o link para Contratos", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    served.response = {
      data: null,
      error: {
        status: 404,
        value: {
          error: { code: "NOT_FOUND", message: "Contrato não encontrado" },
        },
      },
    };
    renderContract(null);
    const notFound = await screen.findByTestId("contract-not-found");
    expect(
      within(notFound).getByRole("heading", { name: "Contrato não encontrado" })
    ).toBeVisible();
    expect(
      within(notFound).getByText(
        "Ele foi excluído, ou você não participa dele."
      )
    ).toBeVisible();
    expect(
      within(notFound).getByRole("link", { name: "Contratos" })
    ).toHaveAttribute("href", "/contracts");
    // A 404 is not worth retrying: no "Tentar de novo".
    expect(screen.queryByRole("button", { name: "Tentar de novo" })).toBeNull();
    // An answer, not an error: nothing thrown into the boundary.
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("o 404 que chega do SSR (o contrato null no cache) já mostra o não-encontrado, sem pedir de novo", () => {
    const client = makeTestQueryClient();
    client.setQueryDefaults(queryKeys.contract("c-moto"), {
      gcTime: Number.POSITIVE_INFINITY,
      staleTime: Number.POSITIVE_INFINITY,
    });
    client.setQueryData(queryKeys.contract("c-moto"), null);
    renderWithProviders(<ContractPage />, { client });
    expect(screen.getByTestId("contract-not-found")).toBeVisible();
    expect(served.get).not.toHaveBeenCalled();
  });
});

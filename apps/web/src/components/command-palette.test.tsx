import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

const contractsQuery = vi.fn();
vi.mock("@/hooks/use-contracts", () => ({
  useContractsQuery: () => contractsQuery(),
}));

// O better-auth abre um client de rede na importação; no jsdom basta o signOut.
const signOut = vi.fn();
vi.mock("@/lib/auth-client", () => ({
  signOut: () => signOut(),
}));

import { CommandPalette } from "@/components/command-palette";

interface Contrato {
  description: string | null;
  id: string;
  nextDueDate: string | null;
  overdueCount: number;
  participantNames: string[];
  title: string;
}

function makeContrato(over: Partial<Contrato> & { id: string }): Contrato {
  return {
    title: `Contrato ${over.id}`,
    description: null,
    participantNames: [],
    overdueCount: 0,
    nextDueDate: null,
    ...over,
  };
}

const ALUGUEL = makeContrato({
  id: "c1",
  title: "Aluguel do apê",
  description: "Repasse do condomínio",
  participantNames: ["João Silva"],
  nextDueDate: "2026-09-10",
});

const DESKTOP_WIDTH = 1024;
const MOBILE_WIDTH = 375;

function setViewport(width: number) {
  (window as unknown as { innerWidth: number }).innerWidth = width;
}

function renderPalette(contracts: Contrato[] | undefined) {
  contractsQuery.mockReturnValue({ data: contracts });
  return render(<CommandPalette onOpenChange={() => undefined} open={true} />);
}

/** Títulos dos grupos renderizados — "Contratos" também é o rótulo de um item de "Ir para". */
function groupHeadings(): string[] {
  return Array.from(document.querySelectorAll("[cmdk-group-heading]")).map(
    (el) => el.textContent ?? ""
  );
}

const INPUT = "combobox";
const CRIAR_ZZZZ = /Criar contrato "zzzz"/;
const CRIAR_QUALQUER = /Criar contrato "/;
const CONTRATO_DE_TESTE = /Em dia|Atrasado/;

describe("CommandPalette", () => {
  beforeEach(() => {
    navigate.mockReset();
    signOut.mockReset();
    contractsQuery.mockReset();
    setViewport(DESKTOP_WIDTH);
  });

  afterEach(() => {
    setViewport(DESKTOP_WIDTH);
  });

  it("mostra Ir para e Ações mesmo sem contratos carregados", () => {
    renderPalette(undefined);
    expect(groupHeadings()).toEqual(["Ir para", "Ações"]);
    expect(screen.getByText("Criar contrato")).toBeInTheDocument();
  });

  it("abre o grupo Contratos assim que a lista chega", () => {
    renderPalette([ALUGUEL]);
    expect(groupHeadings()).toEqual(["Contratos", "Ir para", "Ações"]);
  });

  it("dá um nome acessível pt-BR ao diálogo, ao campo e à lista", () => {
    renderPalette([ALUGUEL]);
    expect(screen.getByRole("heading", { name: "Buscar" })).toBeInTheDocument();
    expect(screen.getByRole(INPUT)).toHaveAccessibleName("Buscar");
    expect(screen.getByRole("listbox")).toHaveAccessibleName("Sugestões");
  });

  it("acha contrato pelo nome do participante, sem acento", async () => {
    renderPalette([ALUGUEL, makeContrato({ id: "c2", title: "Empréstimo" })]);
    await userEvent.type(screen.getByRole(INPUT), "joao");
    expect(screen.getByText("Aluguel do apê")).toBeVisible();
    expect(screen.queryByText("Empréstimo")).not.toBeInTheDocument();
  });

  it("acha contrato pela descrição, sem acento", async () => {
    renderPalette([ALUGUEL]);
    await userEvent.type(screen.getByRole(INPUT), "condominio");
    expect(screen.getByText("Aluguel do apê")).toBeVisible();
  });

  it("lista no máximo 5 contratos no estado vazio, os vencidos primeiro", () => {
    renderPalette([
      makeContrato({ id: "a", title: "Em dia 1", nextDueDate: "2026-01-01" }),
      makeContrato({ id: "b", title: "Em dia 2", nextDueDate: "2026-02-01" }),
      makeContrato({ id: "c", title: "Em dia 3", nextDueDate: "2026-03-01" }),
      makeContrato({ id: "d", title: "Em dia 4", nextDueDate: "2026-04-01" }),
      makeContrato({ id: "e", title: "Em dia 5", nextDueDate: "2026-05-01" }),
      makeContrato({
        id: "f",
        title: "Atrasado",
        overdueCount: 2,
        nextDueDate: "2026-12-01",
      }),
    ]);

    const itens = screen
      .getAllByRole("option")
      .map((el) => el.textContent ?? "");
    const contratos = itens.filter((t) => CONTRATO_DE_TESTE.test(t));

    expect(contratos).toHaveLength(5);
    expect(contratos[0]).toContain("Atrasado");
    expect(contratos[0]).toContain("2 vencidas");
    expect(contratos.at(-1)).toContain("Em dia 4");
  });

  it("sem resultado, oferece criar com o texto digitado", async () => {
    renderPalette([ALUGUEL]);
    await userEvent.type(screen.getByRole(INPUT), "zzzz");
    // `toBeVisible` e não `toBeInTheDocument`: o cmdk marca o grupo com
    // `hidden` quando nenhum item dele passou no filtro.
    expect(screen.getByText(CRIAR_ZZZZ)).toBeVisible();
    expect(screen.queryByText("Aluguel do apê")).not.toBeInTheDocument();
  });

  it("o item de criar some assim que a busca volta a casar", async () => {
    renderPalette([ALUGUEL]);
    const input = screen.getByRole(INPUT);
    await userEvent.type(input, "zzzz");
    await userEvent.clear(input);
    await userEvent.type(input, "aluguel");
    expect(screen.queryByText(CRIAR_QUALQUER)).not.toBeInTheDocument();
  });

  it("navega para o detalhe do contrato escolhido", async () => {
    renderPalette([ALUGUEL]);
    await userEvent.click(screen.getByText("Aluguel do apê"));
    expect(navigate).toHaveBeenCalledWith({
      to: "/contracts/$id",
      params: { id: "c1" },
      search: { installment: undefined },
    });
  });

  it("sem resultado, criar leva o texto digitado no ?title=", async () => {
    renderPalette([ALUGUEL]);
    await userEvent.type(screen.getByRole(INPUT), "zzzz");
    await userEvent.click(screen.getByText(CRIAR_ZZZZ));
    expect(navigate).toHaveBeenCalledWith({
      to: "/contracts/new",
      search: { title: "zzzz" },
    });
  });

  it("acha as páginas e as ações por palavra-chave sem acento", async () => {
    renderPalette([]);
    await userEvent.type(screen.getByRole(INPUT), "notificacoes");
    expect(screen.getByText("Notificações")).toBeVisible();
  });

  it("no mobile a paleta abre no sheet, não no dialog", () => {
    setViewport(MOBILE_WIDTH);
    renderPalette([ALUGUEL]);
    // O Sheet entra pela direita; o Dialog é centralizado. A classe do
    // contêiner é o que distingue os dois no DOM.
    const painel = screen.getByRole("dialog");
    expect(painel.className).toContain("inset-y-0");
    expect(screen.getByRole(INPUT)).toBeInTheDocument();
  });

  it("no desktop a paleta abre no dialog", () => {
    renderPalette([ALUGUEL]);
    const painel = screen.getByRole("dialog");
    expect(painel.className).toContain("-translate-x-1/2");
  });
});

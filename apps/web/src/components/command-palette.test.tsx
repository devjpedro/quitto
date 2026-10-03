import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "react-error-boundary";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import {
  parseIdentityCookie,
  serializeIdentityCookie,
} from "@/lib/identity-cookie";
import { makeQueryClient } from "@/lib/query";
import { queryKeys } from "@/lib/query-keys";

const navigate = vi.fn();
const openNotifications = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

// A paleta consome `contractsQueryOptions`, e o que precisa ser observado é a
// `queryFn` — é ela que dispara o `GET /api/contracts`. Mockar o hook esconderia
// exatamente a pergunta desta suíte: a paleta busca com a paleta fechada?
// A promessa nunca resolve: a `queryFn` aqui é ponto de observação, não fonte
// de dados; quem entrega dados é o cache semeado em `renderPalette`.
const contractsQueryFn = vi.fn(
  (): Promise<unknown> => new Promise(() => undefined)
);
vi.mock("@/hooks/use-contracts", () => ({
  contractsQueryOptions: {
    queryKey: queryKeys.contracts,
    queryFn: () => contractsQueryFn(),
  },
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

/**
 * Monta a paleta sobre um QueryClient de verdade. `contracts` semeia a MESMA
 * queryKey que a lista de contratos usa — é assim que a paleta reaproveita o
 * que já foi buscado em vez de disparar um GET próprio. `undefined` deixa o
 * cache frio, que é o cenário em que um fetch indevido aparece.
 */
function renderPalette(
  contracts: Contrato[] | undefined,
  { open = true }: { open?: boolean } = {}
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  if (contracts !== undefined) {
    client.setQueryData(queryKeys.contracts, contracts);
  }
  return render(
    <QueryClientProvider client={client}>
      <CommandPalette
        onOpenChange={() => undefined}
        onOpenNotifications={openNotifications}
        open={open}
      />
    </QueryClientProvider>
  );
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
    openNotifications.mockReset();
    signOut.mockReset();
    contractsQueryFn.mockClear();
    setViewport(DESKTOP_WIDTH);
  });

  afterEach(() => {
    setViewport(DESKTOP_WIDTH);
  });

  it("não busca contratos enquanto está fechada", () => {
    // A paleta monta em toda rota do `_app`: buscar aqui seria um
    // `GET /api/contracts` por página, sempre que o cache estivesse frio.
    renderPalette(undefined, { open: false });
    expect(contractsQueryFn).not.toHaveBeenCalled();
  });

  it("busca contratos quando abre com o cache frio", () => {
    renderPalette(undefined, { open: true });
    expect(contractsQueryFn).toHaveBeenCalled();
  });

  it("lista os contratos que já estavam no cache da mesma queryKey", () => {
    renderPalette([ALUGUEL]);
    expect(screen.getByText("Aluguel do apê")).toBeVisible();
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

  it("Notificações abre o painel do sino, sem navegar", async () => {
    renderPalette([]);
    await userEvent.type(screen.getByRole(INPUT), "notificacoes");
    await userEvent.click(screen.getByText("Notificações"));
    expect(openNotifications).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
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

  it("Sair encerra a sessão e apaga o cookie de identidade antes de ir pro login", async () => {
    // biome-ignore lint/suspicious/noDocumentCookie: jsdom test setup, the hint written while signed in
    document.cookie = serializeIdentityCookie(
      { id: "u1", name: "Maria", email: "m@e.com", image: null },
      { secure: false }
    );
    const seen: { href?: string; cookie?: string } = {};
    vi.stubGlobal("location", {
      protocol: "http:",
      set href(value: string) {
        seen.href = value;
        seen.cookie = document.cookie;
      },
    });
    try {
      renderPalette([]);
      await userEvent.click(screen.getByText("Sair"));
      await vi.waitFor(() => expect(seen.href).toBe("/login"));
      expect(signOut).toHaveBeenCalledTimes(1);
      expect(parseIdentityCookie(seen.cookie)).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

const SERVER_ERROR = new ApiError({
  code: "INTERNAL",
  httpStatus: 500,
  message: "Erro interno",
});
const ROUTE_ERROR = "Ops, algo deu errado";

/**
 * The palette inside a stand-in for the `_app` shell, on the app's own
 * QueryClient: its `throwOnError` throws every non-401 error, and the boundary
 * plays the route's error screen, which takes the whole shell with it.
 */
function renderInShell({ open }: { open: boolean }) {
  const client = makeQueryClient();
  // The app retries a failed read once, a second later; these tests only need
  // the final error.
  client.setQueryDefaults(queryKeys.contracts, { retry: false });
  render(
    <QueryClientProvider client={client}>
      <ErrorBoundary fallback={<p>{ROUTE_ERROR}</p>}>
        <p>shell</p>
        <CommandPalette
          onOpenChange={() => undefined}
          onOpenNotifications={openNotifications}
          open={open}
        />
      </ErrorBoundary>
    </QueryClientProvider>
  );
  return client;
}

describe("CommandPalette com o /api/contracts falhando", () => {
  beforeEach(() => {
    navigate.mockReset();
    contractsQueryFn.mockReset();
    contractsQueryFn.mockImplementation(() => new Promise(() => undefined));
    setViewport(DESKTOP_WIDTH);
  });

  it("fechada: a falha da lista nunca derruba o shell", async () => {
    const client = renderInShell({ open: false });
    // The list failed somewhere else (the contracts page, or a fetch the
    // palette started before it closed): the error lands in the cache entry
    // the palette shares.
    await act(async () => {
      await client.prefetchQuery({
        queryKey: queryKeys.contracts,
        queryFn: () => Promise.reject(SERVER_ERROR),
      });
    });
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(client.getQueryState(queryKeys.contracts)?.status).toBe("error");
    expect(screen.getByText("shell")).toBeVisible();
    expect(screen.queryByText(ROUTE_ERROR)).toBeNull();
  });

  it("aberta: a lista falha ali dentro e os comandos fixos continuam", async () => {
    contractsQueryFn.mockRejectedValueOnce(SERVER_ERROR);
    renderInShell({ open: true });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar os contratos."
    );
    expect(screen.getByText("shell")).toBeVisible();
    expect(screen.queryByText(ROUTE_ERROR)).toBeNull();
    for (const name of [
      "Agora",
      "Contratos",
      "Conta",
      "Criar contrato",
      "Notificações",
    ]) {
      expect(screen.getByRole("option", { name })).toBeVisible();
    }

    await userEvent.click(
      screen.getByRole("option", { name: "Criar contrato" })
    );
    expect(navigate).toHaveBeenCalledWith({ to: "/contracts/new" });
  });

  it("aberta: Tentar de novo busca a lista outra vez e a mostra", async () => {
    contractsQueryFn
      .mockRejectedValueOnce(SERVER_ERROR)
      .mockResolvedValueOnce([ALUGUEL]);
    renderInShell({ open: true });

    await userEvent.click(
      await screen.findByRole("button", { name: "Tentar de novo" })
    );

    expect(
      await screen.findByRole("option", { name: "Aluguel do apê" })
    ).toBeVisible();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(contractsQueryFn).toHaveBeenCalledTimes(2);
  });
});

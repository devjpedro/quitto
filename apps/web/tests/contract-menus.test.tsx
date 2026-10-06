import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContractActionsMenu } from "@/features/contracts/components/contract-menus";
import { ContractMobileMenu } from "@/features/contracts/components/contract-mobile-menu";
import { queryKeys } from "@/lib/query-keys";
import { motoDetail } from "./contract-fixtures";
import { makeTestQueryClient, renderWithProviders } from "./test-utils";

const { contractGet, hydration, navigate, patch } = vi.hoisted(() => ({
  contractGet: vi.fn(),
  hydration: { done: true },
  navigate: vi.fn(),
  patch: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    api: {
      contracts: () => ({
        get: () => contractGet(),
        patch: (body: unknown) => patch(body),
      }),
    },
  },
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useHydrated: () => hydration.done,
  useNavigate: () => navigate,
}));

const ACTIONS = "Ações do contrato";
const MOBILE_ACTIONS = "Exportar e ações do contrato";
const NEEDS_NAME = "Dê um nome ao contrato.";

beforeEach(() => {
  hydration.done = true;
  contractGet.mockReset();
  navigate.mockReset();
  patch.mockReset();
  patch.mockResolvedValue({
    data: { id: "c-moto", title: "x", description: null, pixKey: null },
    error: null,
  });
});

async function openEditDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: ACTIONS }));
  await user.click(
    await screen.findByRole("menuitem", { name: "Editar título e descrição" })
  );
  return screen.findByRole("dialog", { name: "Editar título e descrição" });
}

describe("EditContractDialog (pelo ⋯ do dono)", () => {
  it("título só com espaços: pede o nome e não chama o PATCH", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ContractActionsMenu detail={motoDetail()} variant="desktop" />
    );
    await openEditDialog(user);
    const title = screen.getByRole("textbox", { name: "Nome do contrato" });
    await user.clear(title);
    await user.type(title, "   ");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText(NEEDS_NAME)).toBeVisible();
    expect(patch).not.toHaveBeenCalled();
  });

  it("envia o título aparado e a descrição vazia como null, fecha e devolve o foco ao ⋯", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ContractActionsMenu detail={motoDetail()} variant="desktop" />
    );
    await openEditDialog(user);
    const title = screen.getByRole("textbox", { name: "Nome do contrato" });
    await user.clear(title);
    await user.type(title, "  Moto do Rafael  ");
    await user.clear(
      screen.getByRole("textbox", { name: "Descrição (opcional)" })
    );
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith({
        title: "Moto do Rafael",
        description: null,
      })
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: ACTIONS })).toHaveFocus()
    );
  });
});

describe("ContractMobileMenu (a barra de cima do celular)", () => {
  function renderMenu() {
    const client = makeTestQueryClient();
    client.setQueryDefaults(queryKeys.contract("c-moto"), {
      gcTime: Number.POSITIVE_INFINITY,
    });
    return renderWithProviders(<ContractMobileMenu contractId="c-moto" />, {
      client,
    });
  }

  it("desabilitado antes de hidratar e enquanto o contrato não chegou", () => {
    hydration.done = false;
    contractGet.mockReturnValue(new Promise(() => undefined));
    renderMenu();
    expect(screen.getByRole("button", { name: MOBILE_ACTIONS })).toBeDisabled();
  });

  it("com o contrato: Extrato, Planilha, um separador e as ações do dono", async () => {
    const user = userEvent.setup();
    contractGet.mockResolvedValue({ data: motoDetail(), error: null });
    renderMenu();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: MOBILE_ACTIONS })).toBeEnabled()
    );
    await user.click(screen.getByRole("button", { name: MOBILE_ACTIONS }));
    const items = await screen.findAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Extrato em PDF",
      "Planilha .csv",
      "Editar título e descrição",
      "Convidar pessoa",
      "Excluir contrato",
    ]);
    // Exportar first, then a rule, then the ones that change the contract.
    expect(screen.getAllByRole("separator").length).toBeGreaterThan(0);
  });

  it("contrato que não existe (404): nenhum ⋯ morto na barra", async () => {
    contractGet.mockResolvedValue({
      data: null,
      error: {
        status: 404,
        value: {
          error: { code: "NOT_FOUND", message: "Contrato não encontrado" },
        },
      },
    });
    renderMenu();
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: MOBILE_ACTIONS })).toBeNull()
    );
  });
});

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useContractRoute } from "@/features/contracts/hooks/use-contract-route";

type Search = Record<string, unknown>;

const { navigate, router, search } = vi.hoisted(() => ({
  navigate: vi.fn(),
  /** The router's current entry (its history state) and its history. */
  router: {
    state: { location: { state: {} as Record<string, unknown> } },
    history: { back: vi.fn() },
    subscribe: vi.fn(),
  },
  search: { current: {} as Record<string, unknown> },
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => navigate,
  useParams: () => ({ id: "c-moto" }),
  useRouter: () => router,
  useSearch: () => search.current,
}));

beforeEach(() => {
  navigate.mockReset();
  router.history.back.mockReset();
  router.subscribe.mockReset();
  router.state.location.state = {};
  search.current = { tab: "people" };
});

const lastNavigation = () =>
  navigate.mock.calls.at(-1)?.[0] as {
    replace?: boolean;
    resetScroll?: boolean;
    search: (prev: Search) => Search;
    state?: unknown;
  };

/** The interface the list (Task 7) and the panel (Task 9) step through. */
describe("useContractRoute", () => {
  it("abrir uma parcela com o painel fechado empilha uma entrada marcada (o Voltar do celular fecha o sheet) e não rola a página ao topo", () => {
    const { result } = renderHook(() => useContractRoute());
    result.current.openInstallment("i8");
    expect(navigate).toHaveBeenCalledTimes(1);
    const toInstallment = lastNavigation();
    expect(toInstallment.replace).toBeFalsy();
    expect(toInstallment.state).toEqual({ panel: true });
    expect(toInstallment.resetScroll).toBe(false);
    expect(toInstallment.search({ tab: "people" })).toEqual({
      tab: "people",
      installment: "i8",
    });
  });

  it("com o painel aberto (↑ ↓, outra linha), a parcela substitui a entrada e mantém a marca dela", () => {
    search.current = { installment: "i4" };
    const { result } = renderHook(() => useContractRoute());
    result.current.openInstallment("i5");
    const step = lastNavigation();
    expect(step.replace).toBe(true);
    expect(step.state).toBe(true);
    expect(step.resetScroll).toBe(false);
    expect(step.search({ installment: "i4" })).toEqual({ installment: "i5" });
  });

  it("fechar a entrada que o painel empilhou volta no histórico (o ✕ e o Voltar dão no mesmo), e a promessa só resolve com a entrada de baixo resolvida", async () => {
    search.current = { installment: "i4" };
    router.state.location.state = { panel: true };
    let resolved: (() => void) | undefined;
    const unsubscribe = vi.fn();
    router.subscribe.mockImplementation((event: string, fn: () => void) => {
      if (event === "onResolved") {
        resolved = fn;
      }
      return unsubscribe;
    });
    const { result } = renderHook(() => useContractRoute());
    let settled = false;
    const closing = Promise.resolve(result.current.closeInstallment()).then(
      () => {
        settled = true;
      }
    );
    expect(router.history.back).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(settled).toBe(false);
    resolved?.();
    await closing;
    expect(settled).toBe(true);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("fechar um painel aberto por link direto (sem a marca: notificação, cartão da home) substitui a entrada e não rola a página ao topo", () => {
    search.current = { installment: "i8" };
    const { result } = renderHook(() => useContractRoute());
    result.current.closeInstallment();
    expect(router.history.back).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledTimes(1);
    const toClosed = lastNavigation();
    expect(toClosed.replace).toBe(true);
    expect(toClosed.resetScroll).toBe(false);
    expect(toClosed.search({ tab: "people", installment: "i8" })).toEqual({
      tab: "people",
      installment: undefined,
    });
  });

  it("trocar de aba empilha no histórico, mantém o painel e não rola a página ao topo", () => {
    const { result } = renderHook(() => useContractRoute());
    result.current.setTab("history");
    const toHistory = lastNavigation();
    expect(toHistory.replace).toBeUndefined();
    expect(toHistory.resetScroll).toBe(false);
    expect(toHistory.search({ installment: "i8" })).toEqual({
      installment: "i8",
      tab: "history",
    });
  });

  it("'Histórico' do sheet (closePanel): a aba sai sem o painel; a entrada que o painel empilhou cede o lugar à aba (o Voltar volta às parcelas, não ao painel)", () => {
    search.current = { installment: "i8" };
    const { result } = renderHook(() => useContractRoute());
    result.current.setTab("history", { closePanel: true });
    const fromDeepLink = lastNavigation();
    expect(fromDeepLink.replace).toBeUndefined();
    expect(fromDeepLink.search({ installment: "i8" })).toEqual({
      installment: undefined,
      tab: "history",
    });

    router.state.location.state = { panel: true };
    result.current.setTab("history", { closePanel: true });
    const fromList = lastNavigation();
    expect(fromList.replace).toBe(true);
    expect(fromList.resetScroll).toBe(false);
    expect(fromList.search({ installment: "i8" })).toEqual({
      installment: undefined,
      tab: "history",
    });
    expect(router.history.back).not.toHaveBeenCalled();
  });
});

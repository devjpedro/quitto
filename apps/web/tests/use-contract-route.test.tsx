import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useContractRoute } from "@/features/contracts/hooks/use-contract-route";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => navigate,
  useParams: () => ({ id: "c-moto" }),
  useSearch: () => ({ tab: "people" }),
}));

beforeEach(() => {
  navigate.mockReset();
});

/** The interface the list (Task 7) and the panel (Task 9) step through. */
describe("useContractRoute", () => {
  it("abrir uma parcela substitui a entrada e não rola a página ao topo", () => {
    const { result } = renderHook(() => useContractRoute());
    result.current.openInstallment("i8");
    expect(navigate).toHaveBeenCalledTimes(1);
    const toInstallment = navigate.mock.calls[0]?.[0];
    expect(toInstallment.replace).toBe(true);
    expect(toInstallment.resetScroll).toBe(false);
    expect(toInstallment.search({ tab: "people" })).toEqual({
      tab: "people",
      installment: "i8",
    });
  });

  it("fechar a parcela substitui a entrada e não rola a página ao topo", () => {
    const { result } = renderHook(() => useContractRoute());
    result.current.closeInstallment();
    expect(navigate).toHaveBeenCalledTimes(1);
    const toClosed = navigate.mock.calls[0]?.[0];
    expect(toClosed.replace).toBe(true);
    expect(toClosed.resetScroll).toBe(false);
    expect(toClosed.search({ tab: "people", installment: "i8" })).toEqual({
      tab: "people",
      installment: undefined,
    });
  });

  it("trocar de aba empilha no histórico e não rola a página ao topo", () => {
    const { result } = renderHook(() => useContractRoute());
    result.current.setTab("history");
    const toHistory = navigate.mock.calls[0]?.[0];
    expect(toHistory.replace).toBeUndefined();
    expect(toHistory.resetScroll).toBe(false);
    expect(toHistory.search({ installment: "i8" })).toEqual({
      installment: "i8",
      tab: "history",
    });
  });

  it("'Histórico' do sheet (closePanel): a aba sai sem o painel, na mesma navegação", () => {
    const { result } = renderHook(() => useContractRoute());
    result.current.setTab("history", { closePanel: true });
    const toHistory = navigate.mock.calls[0]?.[0];
    expect(toHistory.resetScroll).toBe(false);
    expect(toHistory.search({ installment: "i8" })).toEqual({
      installment: undefined,
      tab: "history",
    });
  });
});

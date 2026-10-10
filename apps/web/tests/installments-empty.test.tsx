import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { InstallmentsEmpty } from "@/features/installments/components/installments-empty";
import { tourStore } from "@/features/tour/lib/tour-store";
import { renderWithProviders } from "./test-utils";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children }: { children: ReactNode }) => <a href="/c">{children}</a>,
}));

const NOTHING_DUE = /^Nada vence em outubro/;
const SEE_NEXT = /^Ver novembro/;
const BACK_TO_TODAY = /^Voltar para outubro/;
const NOTHING_FILTERED = /^Nada com esse filtro em/;

function renderEmpty(
  over: Partial<Parameters<typeof InstallmentsEmpty>[0]> = {}
) {
  const onMonth = vi.fn();
  const onClearFilter = vi.fn();
  renderWithProviders(
    <InstallmentsEmpty
      currentMonth="2026-10"
      filtered={false}
      hasContracts
      locale="pt-BR"
      month="2026-10"
      onClearFilter={onClearFilter}
      onMonth={onMonth}
      {...over}
    />
  );
  return { onClearFilter, onMonth };
}

describe("InstallmentsEmpty", () => {
  it("sem contratos: 'Nenhuma parcela ainda', Novo contrato e o tour", async () => {
    renderEmpty({ hasContracts: false });
    expect(screen.getByText("Nenhuma parcela ainda")).toBeVisible();
    expect(screen.getByRole("link", { name: "Novo contrato" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Fazer o tour" }));
    expect(tourStore.isOpen()).toBe(true);
    tourStore.close();
  });

  it("mês sem nada a vencer: 'Nada vence em outubro de 2026' e Ver o mês seguinte", async () => {
    const { onMonth } = renderEmpty();
    expect(screen.getByText(NOTHING_DUE)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: SEE_NEXT }));
    expect(onMonth).toHaveBeenCalledWith("2026-11");
  });

  it("num mês futuro vazio o botão volta ao mês de hoje, não avança", async () => {
    const { onMonth } = renderEmpty({ month: "2026-12" });
    await userEvent.click(screen.getByRole("button", { name: BACK_TO_TODAY }));
    expect(onMonth).toHaveBeenCalledWith(undefined);
  });

  it("filtro sem resultado: 'Ver todas' limpa o filtro", async () => {
    const { onClearFilter } = renderEmpty({ filtered: true });
    expect(screen.getByText(NOTHING_FILTERED)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Ver todas" }));
    expect(onClearFilter).toHaveBeenCalled();
  });
});

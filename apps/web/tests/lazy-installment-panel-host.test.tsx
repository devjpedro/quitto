import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InstallmentPanelHost } from "@/features/installments/components/lazy-installment-panel-host";

vi.mock("@/features/installments/components/installment-panel-host", () => ({
  InstallmentPanelHost: () => <p>painel carregado</p>,
}));

const contract = {} as never;
const route = (installmentId: string | null) => ({ installmentId }) as never;

describe("InstallmentPanelHost (lazy)", () => {
  it("draws nothing, and fetches nothing, while no installment is open", () => {
    render(<InstallmentPanelHost contract={contract} route={route(null)} />);
    expect(screen.queryByText("painel carregado")).not.toBeInTheDocument();
  });

  it("loads the panel once an installment is open", async () => {
    render(<InstallmentPanelHost contract={contract} route={route("i1")} />);
    expect(await screen.findByText("painel carregado")).toBeInTheDocument();
  });

  it("keeps it mounted after the installment closes (the sheet slides out)", async () => {
    const { rerender } = render(
      <InstallmentPanelHost contract={contract} route={route("i1")} />
    );
    await screen.findByText("painel carregado");
    rerender(<InstallmentPanelHost contract={contract} route={route(null)} />);
    expect(screen.getByText("painel carregado")).toBeInTheDocument();
  });
});

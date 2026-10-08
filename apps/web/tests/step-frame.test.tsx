import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StepFrame, StepHeader } from "@/components/layout/step-frame";

describe("StepFrame", () => {
  it("uma árvore só: coluna, palco, resumo, formulário e barra de ação, todos no HTML (o CSS escolhe pela largura)", () => {
    render(
      <StepFrame
        footer={<button type="button">Continuar</button>}
        header={<StepHeader onClose={vi.fn()} title="Novo contrato" />}
        onClose={vi.fn()}
        progress={<p>progresso</p>}
        rail={<aside data-testid="rail">passos</aside>}
        stage={<section data-testid="stage">palco</section>}
        summary={<div data-testid="summary">resumo</div>}
      >
        <p>corpo</p>
      </StepFrame>
    );
    // In the HTML at every width; which one shows is CSS, checked on the screenshots.
    expect(screen.getByTestId("rail")).toBeInTheDocument();
    expect(screen.getByTestId("stage")).toBeInTheDocument();
    expect(screen.getByTestId("summary")).toBeInTheDocument();
    expect(screen.getByTestId("wizard-form")).toContainElement(
      screen.getByText("corpo")
    );
    expect(screen.getByTestId("wizard-footer")).toContainElement(
      screen.getByRole("button", { name: "Continuar" })
    );
  });

  it("o ✕ do desktop fica no canto do bloco, fora da coluna que rola", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <StepFrame
        header={<p>topo</p>}
        onClose={onClose}
        rail={<aside>passos</aside>}
      >
        <p>corpo</p>
      </StepFrame>
    );
    const close = screen.getByRole("button", { name: "Fechar" });
    expect(screen.getByTestId("wizard-form")).not.toContainElement(close);
    await user.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("no celular a barra de ação ocupa o próprio espaço (sticky): nunca cobre as últimas linhas", () => {
    render(
      <StepFrame
        footer={<button type="button">Continuar</button>}
        header={<p>topo</p>}
        onClose={vi.fn()}
        rail={<aside>passos</aside>}
      >
        <p>corpo</p>
      </StepFrame>
    );
    const bar = screen.getByTestId("wizard-footer");
    expect(bar).toHaveClass("sticky");
    expect(bar).not.toHaveClass("fixed");
  });

  it("StepHeader: Voltar só com onBack; o ✕ do celular, com nome", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onClose = vi.fn();
    const { rerender } = render(
      <StepHeader onClose={onClose} title="Novo contrato" />
    );
    expect(screen.queryByRole("button", { name: "Voltar" })).toBeNull();
    rerender(
      <StepHeader onBack={onBack} onClose={onClose} title="Novo contrato" />
    );
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  useCanGoBack: () => false,
  useNavigate: () => vi.fn(),
  useRouter: () => ({ history: { back: vi.fn() } }),
}));
vi.mock("@/hooks/use-identity", () => ({ useIdentity: () => null }));

import { StepAbout } from "@/features/contract-wizard/components/step-about";
import { useContractWizard } from "@/features/contract-wizard/hooks/use-contract-wizard";

function Harness() {
  const wizard = useContractWizard();
  return (
    <>
      <StepAbout wizard={wizard} />
      <button onClick={wizard.next} type="button">
        Continuar
      </button>
      <output data-testid="step">{wizard.step}</output>
    </>
  );
}

describe("StepAbout", () => {
  it("Continuar vazio: as frases do produto e o foco no primeiro inválido", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Escolha se você paga ou recebe.")).toBeVisible();
    expect(
      screen.getByText("Dê um nome ao contrato, como “Notebook da Renata”.")
    ).toBeVisible();
    expect(screen.getByRole("radio", { name: "Eu pago" })).toHaveFocus();
    expect(screen.getByTestId("step")).toHaveTextContent("1");
  });

  it("escolher, nomear e continuar", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("radio", { name: "Eu recebo" }));
    await user.type(
      screen.getByRole("textbox", { name: "Nome do contrato" }),
      "Notebook da Renata"
    );
    await user.type(
      screen.getByRole("textbox", { name: "Descrição opcional" }),
      "Dell Inspiron 15"
    );
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByTestId("step")).toHaveTextContent("2");
  });
});

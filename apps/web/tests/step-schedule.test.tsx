import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  useCanGoBack: () => false,
  useNavigate: () => vi.fn(),
  useRouter: () => ({ history: { back: vi.fn() } }),
}));
vi.mock("@/hooks/use-identity", () => ({ useIdentity: () => null }));

import { AdjustInstallments } from "@/features/contract-wizard/components/adjust-installments";
import { AdjustSum } from "@/features/contract-wizard/components/adjust-sum";
import { StepSchedule } from "@/features/contract-wizard/components/step-schedule";
import { NOTEBOOK, renderWizard, toStep } from "./wizard-harness";

const SPLIT = /valor total/i;
const ADJUST = /Ajustar uma a uma/;
const AMOUNT_ROWS = /^Valor da parcela/;
// The whole text: "2" alone also matches "2-adjust".
const ONLY_STEP_2 = /^2$/;
const ONLY_STEP_3 = /^3$/;

function schedule() {
  return renderWizard((wizard) => (
    <>
      {wizard.step === 2 && !wizard.adjusting ? (
        <StepSchedule wizard={wizard} />
      ) : null}
      {wizard.adjusting ? <AdjustInstallments wizard={wizard} /> : null}
      {wizard.adjusting ? <AdjustSum wizard={wizard} /> : null}
    </>
  ));
}

describe("StepSchedule", () => {
  it("Continuar sem escolher: 'Escolha como o pagamento foi combinado.'", async () => {
    const user = userEvent.setup();
    const { wizard } = schedule();
    toStep(wizard, 2, {
      ...NOTEBOOK,
      mode: null,
      totalCents: null,
      count: null,
      firstDueDate: "",
    });
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(
      screen.getByText("Escolha como o pagamento foi combinado.")
    ).toBeVisible();
    expect(screen.getByTestId("step")).toHaveTextContent(ONLY_STEP_2);
  });

  it("valor total, 12 parcelas e o dia da semana na ajuda do 1º vencimento", async () => {
    const user = userEvent.setup();
    const { wizard } = schedule();
    toStep(wizard, 2, {
      ...NOTEBOOK,
      mode: null,
      totalCents: null,
      count: null,
      firstDueDate: "",
    });
    await user.click(screen.getByRole("radio", { name: SPLIT }));
    await user.type(
      screen.getByRole("textbox", { name: "Valor total" }),
      "6000"
    );
    await user.type(screen.getByRole("textbox", { name: "Parcelas" }), "12");
    // 10/12/2030 is a Tuesday, years ahead: the help stays "terça" whatever today is.
    act(() => wizard().setValue("firstDueDate", "2030-12-10"));
    expect(screen.getByLabelText("1º vencimento")).toHaveAccessibleDescription(
      "terça"
    );
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByTestId("step")).toHaveTextContent(ONLY_STEP_3);
    expect(wizard().values.totalCents).toBe(600_000);
  });

  it("total zero bloqueia; data no passado é aviso e não bloqueia", async () => {
    const user = userEvent.setup();
    const { wizard } = schedule();
    toStep(wizard, 2, {
      ...NOTEBOOK,
      totalCents: 0,
      firstDueDate: "2020-09-10",
    });
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(
      screen.getByText("O total precisa ser maior que zero.")
    ).toBeVisible();
    expect(
      screen.getByText(
        "Essa data já passou: as parcelas antes de hoje entram como atrasadas."
      )
    ).toBeVisible();
    act(() => wizard().setValue("totalCents", 600_000));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByTestId("step")).toHaveTextContent(ONLY_STEP_3);
  });

  it("'Ajustar uma a uma' com o cronograma incompleto: mostra o que falta e não abre", async () => {
    const user = userEvent.setup();
    const { wizard } = schedule();
    toStep(wizard, 2, { ...NOTEBOOK, totalCents: null });
    await user.click(screen.getByRole("button", { name: ADJUST }));
    expect(screen.getByTestId("step")).toHaveTextContent(ONLY_STEP_2);
    expect(screen.getByText("Informe o valor total combinado.")).toBeVisible();
  });
});

describe("Ajustar uma a uma", () => {
  it("a soma passa: bloqueia, foco na frase, e 'Tirar R$ 1.100,00 das outras 11' fecha", async () => {
    const user = userEvent.setup();
    const { wizard } = schedule();
    toStep(wizard, 2, NOTEBOOK);
    await user.click(screen.getByRole("button", { name: ADJUST }));
    expect(screen.getByTestId("step")).toHaveTextContent("2-adjust");
    expect(screen.getAllByRole("textbox", { name: AMOUNT_ROWS })).toHaveLength(
      12
    );
    const first = screen.getByRole("textbox", { name: "Valor da parcela 1" });
    await user.clear(first);
    await user.type(first, "1600");
    await user.tab();
    expect(screen.getByText("R$ 1.100,00 a mais")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByTestId("step")).toHaveTextContent("2-adjust");
    expect(document.getElementById("wizard-installments")).toHaveFocus();
    await user.click(
      screen.getByRole("button", { name: "Tirar R$ 1.100,00 das outras 11" })
    );
    expect(screen.getByText("Confere")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByTestId("step")).toHaveTextContent(ONLY_STEP_3);
  });

  it("'Usar R$ 7.100,00 como total' troca o total e mantém a lista", async () => {
    const user = userEvent.setup();
    const { wizard } = schedule();
    toStep(wizard, 2, NOTEBOOK);
    await user.click(screen.getByRole("button", { name: ADJUST }));
    const first = screen.getByRole("textbox", { name: "Valor da parcela 1" });
    await user.clear(first);
    await user.type(first, "1600");
    await user.tab();
    await user.click(
      screen.getByRole("button", { name: "Usar R$ 7.100,00 como total" })
    );
    expect(wizard().values.totalCents).toBe(710_000);
    expect(wizard().values.installments?.[0]?.amountCents).toBe(160_000);
    expect(screen.getByText("Confere")).toBeVisible();
  });

  it("sair do uma a uma com a soma errada e Continuar volta à lista com a frase", async () => {
    const user = userEvent.setup();
    const { wizard } = schedule();
    toStep(wizard, 2, NOTEBOOK);
    await user.click(screen.getByRole("button", { name: ADJUST }));
    const first = screen.getByRole("textbox", { name: "Valor da parcela 1" });
    await user.clear(first);
    await user.type(first, "1600");
    await user.tab();
    act(() => wizard().back());
    expect(screen.getByTestId("step")).toHaveTextContent(ONLY_STEP_2);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByTestId("step")).toHaveTextContent("2-adjust");
    expect(document.getElementById("wizard-installments")).toHaveFocus();
    expect(screen.getByText("R$ 1.100,00 a mais")).toBeVisible();
  });

  it("com 1 parcela: 'Soma da parcela', nunca 'Soma das 1 parcelas'", async () => {
    const user = userEvent.setup();
    const { wizard } = schedule();
    toStep(wizard, 2, { ...NOTEBOOK, count: 1 });
    await user.click(screen.getByRole("button", { name: ADJUST }));
    expect(screen.getByText("Soma da parcela")).toBeVisible();
  });

  it("voltar ao passo 2 e mudar a quantidade descarta a lista (decisão 24)", async () => {
    const user = userEvent.setup();
    const { wizard } = schedule();
    toStep(wizard, 2, NOTEBOOK);
    await user.click(screen.getByRole("button", { name: ADJUST }));
    act(() => wizard().back());
    expect(wizard().values.installments).toHaveLength(12);
    act(() => wizard().setValue("count", 10));
    expect(wizard().values.installments).toBeNull();
  });
});

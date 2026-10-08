import { act, render } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  type ContractWizard,
  useContractWizard,
} from "@/features/contract-wizard/hooks/use-contract-wizard";
import {
  emptyValues,
  type WizardStep,
  type WizardValues,
} from "@/features/contract-wizard/lib/wizard-values";

/** Renders steps around the real hook, with a "Continuar" and the current step in a test id. */
export function renderWizard(
  body: (wizard: ContractWizard) => ReactNode,
  options: { onSubmit?: (values: WizardValues) => void } = {}
) {
  const holder: { current: ContractWizard | null } = { current: null };
  function Harness() {
    const wizard = useContractWizard({ onSubmit: options.onSubmit });
    holder.current = wizard;
    return (
      <>
        {body(wizard)}
        <button onClick={wizard.next} type="button">
          Continuar
        </button>
        <output data-testid="step">
          {`${wizard.step}${wizard.adjusting ? "-adjust" : ""}`}
        </output>
      </>
    );
  }
  const view = render(<Harness />);
  return { ...view, wizard: () => holder.current as ContractWizard };
}

/** The credible contract of mockup 15, filled up to `step`. */
export const NOTEBOOK: WizardValues = {
  ...emptyValues(),
  ownerRole: "seller",
  title: "Notebook da Renata",
  description: "Dell Inspiron 15, usado, com carregador",
  mode: "split",
  totalCents: 600_000,
  count: 12,
  // Far ahead and a Tuesday: no test turns into "already past" as the months go by.
  firstDueDate: "2030-12-10",
};

/** Puts the wizard on `step` with `values` (each earlier step valid). */
export function toStep(
  wizard: () => ContractWizard,
  step: WizardStep,
  values: WizardValues
): void {
  act(() => wizard().replace(values));
  for (let at = 1; at < step; at += 1) {
    act(() => wizard().next());
  }
}

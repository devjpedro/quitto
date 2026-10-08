import { ShieldCheck } from "@phosphor-icons/react";
import { StepRail } from "@/components/layout/step-rail";
import type { StepState } from "@/components/ui/step-anchor";
import { m } from "@/paraglide/messages.js";
import type { ContractWizard } from "../hooks/use-contract-wizard";
import { WIZARD_STEPS, type WizardStep } from "../lib/wizard-values";

export const STEP_LABEL: Record<WizardStep, () => string> = {
  1: () => m.wizard_step_about(),
  2: () => m.wizard_step_schedule(),
  3: () => m.wizard_step_party(),
  4: () => m.wizard_step_review(),
};

function stateOf(step: WizardStep, current: WizardStep): StepState {
  if (step < current) {
    return "done";
  }
  return step === current ? "next" : "todo";
}

/** "Passo 3 de 4 · opcional" over "Com quem": the wizard's rail. */
export function WizardRail({ wizard }: { wizard: ContractWizard }) {
  const total = WIZARD_STEPS.length;
  return (
    <StepRail
      footer={m.wizard_rail_footer()}
      footerIcon={ShieldCheck}
      group={m.nav_new_contract()}
      order="meta-first"
      steps={WIZARD_STEPS.map((step) => ({
        label: STEP_LABEL[step](),
        meta:
          step === 3
            ? m.wizard_step_of_optional({ n: step, total })
            : m.wizard_step_of({ n: step, total }),
        state: stateOf(step, wizard.step),
        onSelect: step < wizard.step ? () => wizard.goTo(step) : undefined,
      }))}
    />
  );
}

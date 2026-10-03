import type { HomeOnboarding } from "../types";

export type OnboardingStepId =
  | "account"
  | "contract"
  | "pix"
  | "counterparty"
  | "reminders";

export type HeroStepId = "contract" | "pix" | "reminders";

export interface OnboardingStep {
  done: boolean;
  id: OnboardingStepId;
  optional: boolean;
}

export interface OnboardingView {
  doneCount: number;
  next: HeroStepId | null;
  steps: OnboardingStep[];
  total: number;
  visible: boolean;
}

function isHeroStep(id: OnboardingStepId | undefined): id is HeroStepId {
  return id === "contract" || id === "pix" || id === "reminders";
}

/** "Comece por aqui": progress counts the required steps only; it hides once those are done or it is dismissed. */
export function onboardingView(o: HomeOnboarding): OnboardingView {
  const steps: OnboardingStep[] = [
    { id: "account", done: true, optional: false },
    { id: "contract", done: o.hasContract, optional: false },
    { id: "pix", done: o.hasPixKey, optional: false },
    { id: "counterparty", done: o.hasCounterparty, optional: true },
  ];
  if (o.remindersAvailable) {
    steps.push({ id: "reminders", done: o.remindersOn, optional: false });
  }
  const required = steps.filter((s) => !s.optional);
  const doneCount = required.filter((s) => s.done).length;
  const next = required.find((s) => !s.done)?.id;
  return {
    steps,
    doneCount,
    total: required.length,
    next: isHeroStep(next) ? next : null,
    visible: o.dismissedAt === null && doneCount < required.length,
  };
}

export type StepTarget =
  | { kind: "new_contract" }
  | { kind: "settings" }
  | { contractId: string; kind: "contract" };

/** Where a step leads. "Outra parte" goes to the user's latest contract, where participants are managed. */
export function stepTarget(
  id: OnboardingStepId,
  o: HomeOnboarding
): StepTarget | null {
  switch (id) {
    case "contract":
      return { kind: "new_contract" };
    case "pix":
    case "reminders":
      return { kind: "settings" };
    case "counterparty":
      return o.counterpartyContractId
        ? { kind: "contract", contractId: o.counterpartyContractId }
        : { kind: "new_contract" };
    default:
      return null;
  }
}

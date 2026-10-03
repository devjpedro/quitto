import type { Home, HomeAction } from "../types";

export interface ContractWithInstallments {
  installments: { id: string; status: string }[];
}

export function withoutAction(home: Home, actionId: string): Home {
  return {
    ...home,
    actions: home.actions.filter((action) => action.id !== actionId),
  };
}

/** Puts one action back where it was (clamped to the list), unless it is already there. */
export function withAction(
  home: Home,
  action: HomeAction,
  index: number
): Home {
  if (home.actions.some((item) => item.id === action.id)) {
    return home;
  }
  const actions = [...home.actions];
  actions.splice(Math.min(Math.max(index, 0), actions.length), 0, action);
  return { ...home, actions };
}

export function withOnboardingDismissed(home: Home, dismissedAt: string): Home {
  return { ...home, onboarding: { ...home.onboarding, dismissedAt } };
}

/** Puts the updated installment's status into a cached contract detail, if one is cached. */
export function applyInstallment<T extends ContractWithInstallments>(
  contract: T | undefined,
  installment: { id: string; status: string }
): T | undefined {
  if (!contract) {
    return contract;
  }
  return {
    ...contract,
    installments: contract.installments.map((it) =>
      it.id === installment.id ? { ...it, status: installment.status } : it
    ),
  };
}

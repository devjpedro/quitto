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

/** Sets when the guide was dismissed; `null` brings the guide back (a failed dismissal). */
export function withOnboardingDismissed(
  home: Home,
  dismissedAt: string | null
): Home {
  return { ...home, onboarding: { ...home.onboarding, dismissedAt } };
}

/** Optimistic writes on the home that are still waiting for the API. */
export interface PendingHomeWrites {
  actionIds: readonly string[];
  /** The optimistic dismissal time while the dismissal is in flight, else null. */
  dismissedAt: string | null;
}

/**
 * Keeps the effect of the writes still in flight on a home just read from the
 * server, which may predate them: their actions stay out and a pending
 * dismissal stays dismissed. Once a write settles, its own rollback or
 * refetch decides.
 */
export function withPendingWrites(
  home: Home,
  pending: PendingHomeWrites
): Home {
  let next = home;
  if (pending.actionIds.length > 0) {
    const leaving = new Set(pending.actionIds);
    next = {
      ...next,
      actions: next.actions.filter((action) => !leaving.has(action.id)),
    };
  }
  if (pending.dismissedAt !== null && next.onboarding.dismissedAt === null) {
    next = withOnboardingDismissed(next, pending.dismissedAt);
  }
  return next;
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

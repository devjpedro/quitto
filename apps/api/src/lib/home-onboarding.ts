import type { HomeContractRows } from "./home-parties";

export interface HomeOnboarding {
  /** Most recent contract the user owns: where "invite the other party" leads. */
  counterpartyContractId: string | null;
  dismissedAt: string | null;
  hasContract: boolean;
  hasCounterparty: boolean;
  hasPixKey: boolean;
  /** false when the server has e-mail reminders off: the step is hidden. */
  remindersAvailable: boolean;
  remindersOn: boolean;
}

/**
 * Raw facts for the "Comece por aqui" checklist; the web derives progress and
 * visibility. A cancelled contract counts for nothing. Taking part in a
 * contract, an invited one included, counts as having one.
 */
export function onboardingFacts(
  userId: string,
  rows: HomeContractRows,
  profile: {
    emailRemindersOptIn: boolean;
    onboardingDismissedAt: Date | null;
    pixKey: string | null;
  },
  remindersAvailable: boolean
): HomeOnboarding {
  const live = rows.contracts.filter((c) => c.status !== "cancelled");
  const liveIds = new Set(live.map((c) => c.id));
  const owned = live
    .filter((c) => c.ownerId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return {
    hasContract: live.length > 0,
    hasPixKey: profile.pixKey !== null,
    hasCounterparty: rows.participants.some(
      (p) => liveIds.has(p.contractId) && p.linkedUserId !== userId
    ),
    remindersOn: profile.emailRemindersOptIn,
    remindersAvailable,
    counterpartyContractId: owned[0]?.id ?? null,
    dismissedAt: profile.onboardingDismissedAt?.toISOString() ?? null,
  };
}

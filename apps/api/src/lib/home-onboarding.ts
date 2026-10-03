import { type HomeContractRows, partyContracts } from "./home-parties";

export interface HomeOnboarding {
  /** Most recent contract the user owns: where "invite the other party" leads. */
  counterpartyContractId: string | null;
  dismissedAt: string | null;
  hasContract: boolean;
  /** Someone holds the opposite slot (buyer/seller) in a contract the user is a party to. */
  hasCounterparty: boolean;
  hasPixKey: boolean;
  /** false when the server has e-mail reminders off: the step is hidden. */
  remindersAvailable: boolean;
  remindersOn: boolean;
}

/**
 * In a contract where the user pays or receives, the opposite slot is taken,
 * with an account or not. A viewer is never the other party, and neither is
 * anyone in a contract the user only follows (partyContracts drops those).
 */
function hasOtherParty(userId: string, rows: HomeContractRows): boolean {
  return partyContracts(userId, rows).some((party) => {
    const opposite = party.caps.role === "buyer" ? "seller" : "buyer";
    return rows.participants.some(
      (p) => p.contractId === party.contract.id && p.role === opposite
    );
  });
}

/**
 * Raw facts for the "Comece por aqui" checklist; the web derives progress and
 * visibility. A cancelled contract counts for nothing. Taking part in a
 * contract, an invited or a followed one included, counts as having one.
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
  const owned = live
    .filter((c) => c.ownerId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return {
    hasContract: live.length > 0,
    hasPixKey: profile.pixKey !== null,
    hasCounterparty: hasOtherParty(userId, rows),
    remindersOn: profile.emailRemindersOptIn,
    remindersAvailable,
    counterpartyContractId: owned[0]?.id ?? null,
    dismissedAt: profile.onboardingDismissedAt?.toISOString() ?? null,
  };
}

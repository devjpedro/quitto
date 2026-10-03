import { CONTRACT_STATUS, isoDateInTimeZone } from "@quitto/shared";
import {
  type HomeContractRows,
  type PartyContract,
  partyContracts,
} from "./home-parties";

export interface HomeOnboarding {
  /** The day the account was created, on São Paulo's calendar: the web hides the guide after 30 days. */
  accountCreatedOn: string;
  /** Active contracts the user pays or receives in (followed and cancelled ones don't count): the guide hides itself at 3. */
  activePartyContracts: number;
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
function hasOtherParty(
  parties: PartyContract[],
  rows: HomeContractRows
): boolean {
  return parties.some((party) => {
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
    createdAt: Date;
  },
  remindersAvailable: boolean
): HomeOnboarding {
  const live = rows.contracts.filter((c) => c.status !== "cancelled");
  const owned = live
    .filter((c) => c.ownerId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const parties = partyContracts(userId, rows);
  const activePartyContracts = parties.filter(
    (party) => party.contract.status === CONTRACT_STATUS.active
  ).length;
  return {
    accountCreatedOn: isoDateInTimeZone(profile.createdAt),
    activePartyContracts,
    hasContract: live.length > 0,
    hasPixKey: profile.pixKey !== null,
    hasCounterparty: hasOtherParty(parties, rows),
    remindersOn: profile.emailRemindersOptIn,
    remindersAvailable,
    counterpartyContractId: owned[0]?.id ?? null,
    dismissedAt: profile.onboardingDismissedAt?.toISOString() ?? null,
  };
}

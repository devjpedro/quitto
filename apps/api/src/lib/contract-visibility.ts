import { eq, inArray, or } from "drizzle-orm";
import { db } from "../db/client";
import { contract, participant } from "../db/schema";

/**
 * Who sees a contract: its owner and anyone linked to one of its slots, in any
 * role (a viewer included). An invite that was not accepted is not enough. One
 * rule for the contract list and the home; the linked contracts come from a
 * subquery, in the same round trip.
 */
export function visibleContractsWhere(userId: string) {
  return or(
    eq(contract.ownerId, userId),
    inArray(
      contract.id,
      db
        .select({ contractId: participant.contractId })
        .from(participant)
        .where(eq(participant.linkedUserId, userId))
    )
  );
}

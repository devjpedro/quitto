import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "../db/client";
import { contract, notification, participant } from "../db/schema";

/**
 * Who sees a contract: its owner and anyone linked to one of its slots, in any
 * role (a viewer included). An invite that was not accepted is not enough. One
 * rule for the contract list, the home and the notifications; the linked
 * contracts come from a subquery, in the same round trip.
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

/**
 * The user's notifications on contracts they still see. Leaving a contract, or
 * being removed from it, keeps the rows but hides them, so the list, the unread
 * counts and "mark all as read" agree. Every notification belongs to a contract
 * (contract_id is NOT NULL), so there is no contract-less case to keep.
 */
export function visibleNotificationsWhere(userId: string) {
  return and(
    eq(notification.userId, userId),
    inArray(
      notification.contractId,
      db
        .select({ id: contract.id })
        .from(contract)
        .where(visibleContractsWhere(userId))
    )
  );
}

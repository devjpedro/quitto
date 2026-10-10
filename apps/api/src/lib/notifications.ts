import { eq } from "drizzle-orm";
import type { db } from "../db/client";
import { contract, notification, participant } from "../db/schema";
import { inBatches, STATEMENT_BATCH } from "./batches";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Exec = typeof db | Tx;

interface ParticipantLike {
  linkedUserId: string | null;
  role: string;
}

/** Linked user ids that can PAY (buyer slot, or owner inheriting when no linked buyer). */
export function resolvePayerUserIds(
  people: ParticipantLike[],
  ownerId: string
): Set<string> {
  const hasLinkedBuyer = people.some(
    (p) => p.role === "buyer" && p.linkedUserId !== null
  );
  const out = new Set<string>();
  for (const p of people) {
    if (!p.linkedUserId) {
      continue;
    }
    if (p.role === "buyer") {
      out.add(p.linkedUserId);
    }
    if (p.linkedUserId === ownerId && !hasLinkedBuyer) {
      out.add(p.linkedUserId);
    }
  }
  return out;
}

/** Linked user ids that can APPROVE (seller slot, or owner inheriting when no linked seller). */
export function resolveApproverUserIds(
  people: ParticipantLike[],
  ownerId: string
): Set<string> {
  const hasLinkedSeller = people.some(
    (p) => p.role === "seller" && p.linkedUserId !== null
  );
  const out = new Set<string>();
  for (const p of people) {
    if (!p.linkedUserId) {
      continue;
    }
    if (p.role === "seller") {
      out.add(p.linkedUserId);
    }
    if (p.linkedUserId === ownerId && !hasLinkedSeller) {
      out.add(p.linkedUserId);
    }
  }
  return out;
}

export type RecipientTarget = "payer" | "approver";

export interface NotificationInput {
  contractId: string;
  dedupeKey?: string | null;
  installmentId?: string | null;
  metadata?: Record<string, unknown> | null;
  type: string;
  userId: string;
}

/**
 * Resolves the linked user ids of `target` for a contract, EXCLUDING the actor.
 * Reads contract owner + participants; reuses the pure resolvers above.
 */
export async function recipientsFor(
  exec: Exec,
  contractId: string,
  target: RecipientTarget,
  actorUserId: string
): Promise<string[]> {
  const [c] = await exec
    .select({ ownerId: contract.ownerId })
    .from(contract)
    .where(eq(contract.id, contractId))
    .limit(1);
  if (!c) {
    return [];
  }
  const people = await exec
    .select({ role: participant.role, linkedUserId: participant.linkedUserId })
    .from(participant)
    .where(eq(participant.contractId, contractId));
  const set =
    target === "payer"
      ? resolvePayerUserIds(people, c.ownerId)
      : resolveApproverUserIds(people, c.ownerId);
  set.delete(actorUserId);
  return [...set];
}

function toRow(i: NotificationInput) {
  return {
    userId: i.userId,
    type: i.type,
    contractId: i.contractId,
    installmentId: i.installmentId ?? null,
    metadata: i.metadata ?? null,
    dedupeKey: i.dedupeKey ?? null,
  };
}

/**
 * Inserts notifications in bulk, joining an existing tx, one statement per
 * `batch` rows (lib/batches.ts). `onConflictDoNothing` makes reminder
 * dedupeKeys idempotent (event rows leave dedupeKey null).
 */
export async function createNotifications(
  exec: Exec,
  inputs: NotificationInput[],
  batch = STATEMENT_BATCH
): Promise<void> {
  await inBatches(inputs, batch, async (rows) => {
    await exec
      .insert(notification)
      .values(rows.map(toRow))
      .onConflictDoNothing();
    return [];
  });
}

export interface InsertedNotification {
  contractId: string;
  installmentId: string | null;
  type: string;
  userId: string;
}

/** Como createNotifications, mas devolve só as linhas de fato inseridas (dedupe já filtrado). */
export function insertNotificationsReturning(
  exec: Exec,
  inputs: NotificationInput[],
  batch = STATEMENT_BATCH
): Promise<InsertedNotification[]> {
  return inBatches(inputs, batch, (rows) =>
    exec
      .insert(notification)
      .values(rows.map(toRow))
      .onConflictDoNothing()
      .returning({
        userId: notification.userId,
        type: notification.type,
        contractId: notification.contractId,
        installmentId: notification.installmentId,
      })
  );
}

/** Convenience: resolve recipients for a target and build event notifications. */
export async function notifyTarget(
  exec: Exec,
  args: {
    contractId: string;
    installmentId: string;
    actorUserId: string;
    target: RecipientTarget;
    type: string;
    metadata?: Record<string, unknown> | null;
  }
): Promise<void> {
  const userIds = await recipientsFor(
    exec,
    args.contractId,
    args.target,
    args.actorUserId
  );
  await createNotifications(
    exec,
    userIds.map((userId) => ({
      userId,
      type: args.type,
      contractId: args.contractId,
      installmentId: args.installmentId,
      metadata: args.metadata ?? null,
    }))
  );
}

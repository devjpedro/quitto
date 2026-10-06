import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { contract, participant, user as userTable } from "../db/schema";
import { NotFoundError } from "./errors";

export type ParticipantSlot = "buyer" | "seller" | "viewer";

export interface ContractAccess {
  /** Contract owner (management), derived from contract.ownerId. */
  isOwner: boolean;
  /** The user's real slot in the contract. */
  role: ParticipantSlot;
}

export interface Capabilities extends ContractAccess {
  /** Can confirm/dispute. */
  isApprover: boolean;
  /** Can pay/attach proof/mark as paid. */
  isPayer: boolean;
}

export interface ParticipantRow {
  linkedUserId: string | null;
  role: string;
}

interface OwnedContract {
  ownerId: string;
  ownerRole: string;
}

/**
 * The caller's slot: their first linked row that is not a legacy "owner" row,
 * else the owner's ownerRole (buyer/seller). null = no access. Shared by
 * getContractRole and capabilitiesFromRows, so every door reads the same slot.
 */
function slotOf(
  userId: string,
  c: OwnedContract,
  people: ParticipantRow[]
): ParticipantSlot | null {
  const linked = people.find(
    (p) => p.linkedUserId === userId && p.role !== "owner"
  );
  if (
    linked?.role === "buyer" ||
    linked?.role === "seller" ||
    linked?.role === "viewer"
  ) {
    return linked.role;
  }
  // Safety net: an owner without a participant row (legacy) falls back to ownerRole.
  if (
    c.ownerId === userId &&
    (c.ownerRole === "buyer" || c.ownerRole === "seller")
  ) {
    return c.ownerRole;
  }
  return null;
}

/**
 * Capability follows the slot. The owner inherits the opposite side ONLY while
 * that slot has no counterparty with a linked account (linkedUserId !== null).
 * `people` must be EVERY participant row of the contract, not just the caller's:
 * with a partial list the owner would inherit a side someone else already holds.
 * Pure, so the per-contract check and the batched home share one rule.
 * null = the user has no slot in the contract.
 */
export function capabilitiesFromRows(
  userId: string,
  c: OwnedContract,
  people: ParticipantRow[]
): Capabilities | null {
  const role = slotOf(userId, c, people);
  if (!role) {
    return null;
  }
  const isOwner = c.ownerId === userId;
  const hasLinkedBuyer = people.some(
    (p) => p.role === "buyer" && p.linkedUserId !== null
  );
  const hasLinkedSeller = people.some(
    (p) => p.role === "seller" && p.linkedUserId !== null
  );
  return {
    role,
    isOwner,
    isPayer: role === "buyer" || (isOwner && !hasLinkedBuyer),
    isApprover: role === "seller" || (isOwner && !hasLinkedSeller),
  };
}

export interface Recebedor {
  displayName: string | null;
  /** The receiver has an account in the contract: only that account's key counts. */
  hasAccount: boolean;
  /** The key that pays them: the account's with an account, else the one kept on the contact. */
  key: string | null;
  /** Where `key` came from; null without a key. */
  keySource: "account" | "contact" | null;
}

const NO_RECEIVER: Recebedor = {
  displayName: null,
  hasAccount: false,
  key: null,
  keySource: null,
};

function fromAccount(
  displayName: string | null,
  pixKey: string | null
): Recebedor {
  return {
    displayName,
    hasAccount: true,
    key: pixKey,
    keySource: pixKey ? "account" : null,
  };
}

/**
 * Who receives the money and the key that pays them, from rows already
 * loaded (owner's decision, 2026-10-05): with an account, the account's key;
 * a contact without one, the key kept on the contact; else none. The old
 * per-contract key no longer counts (planner's decision 1). `users` must hold
 * the owner (seller-owned contracts) and the linked seller.
 */
export function pickRecebedor(
  c: OwnedContract,
  people: {
    displayName: string;
    linkedUserId: string | null;
    pixKey: string | null;
    role: string;
  }[],
  users: ReadonlyMap<string, { name: string; pixKey: string | null }>
): Recebedor {
  if (c.ownerRole === "seller") {
    const owner = users.get(c.ownerId);
    return fromAccount(owner?.name ?? null, owner?.pixKey ?? null);
  }
  const sellers = people.filter((p) => p.role === "seller");
  const [seller] = sellers;
  if (sellers.length !== 1 || !seller) {
    return NO_RECEIVER;
  }
  if (seller.linkedUserId) {
    return fromAccount(
      seller.displayName,
      users.get(seller.linkedUserId)?.pixKey ?? null
    );
  }
  return {
    displayName: seller.displayName,
    hasAccount: false,
    key: seller.pixKey,
    keySource: seller.pixKey ? "contact" : null,
  };
}

/** The receiver's contact row (a seller with no account, in a contract the owner pays): where their key is kept. */
export function receiverContactId(
  c: { ownerRole: string },
  people: { id: string; linkedUserId: string | null; role: string }[]
): string | null {
  if (c.ownerRole !== "buyer") {
    return null;
  }
  const sellers = people.filter((p) => p.role === "seller");
  const [seller] = sellers;
  return sellers.length === 1 && seller && seller.linkedUserId === null
    ? seller.id
    : null;
}

/** The accounts whose key may pay: the owner of a seller-owned contract, else the linked seller. */
export async function receiverUsers(
  c: OwnedContract,
  people: { linkedUserId: string | null; role: string }[]
): Promise<Map<string, { name: string; pixKey: string | null }>> {
  const ids =
    c.ownerRole === "seller"
      ? [c.ownerId]
      : people.flatMap((p) =>
          p.role === "seller" && p.linkedUserId ? [p.linkedUserId] : []
        );
  if (ids.length === 0) {
    return new Map();
  }
  const rows = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      pixKey: userTable.pixKey,
    })
    .from(userTable)
    .where(inArray(userTable.id, ids));
  return new Map(rows.map((u) => [u.id, u]));
}

/** Who receives the money in the contract, and the key that pays them. */
export async function resolveRecebedor(c: {
  id: string;
  ownerId: string;
  ownerRole: string;
}): Promise<Recebedor> {
  const people =
    c.ownerRole === "seller"
      ? []
      : await db
          .select({
            displayName: participant.displayName,
            linkedUserId: participant.linkedUserId,
            pixKey: participant.pixKey,
            role: participant.role,
          })
          .from(participant)
          .where(
            and(
              eq(participant.contractId, c.id),
              eq(participant.role, "seller")
            )
          );
  return pickRecebedor(c, people, await receiverUsers(c, people));
}

/** The contract's owner fields. Throws NotFoundError when it doesn't exist. */
async function findOwnedContract(contractId: string): Promise<OwnedContract> {
  const [row] = await db
    .select({ ownerId: contract.ownerId, ownerRole: contract.ownerRole })
    .from(contract)
    .where(eq(contract.id, contractId))
    .limit(1);
  if (!row) {
    throw new NotFoundError("Contrato não encontrado");
  }
  return row;
}

/**
 * The user's real slot and whether they own the contract. Throws NotFoundError
 * when the contract doesn't exist OR the user has no access (doesn't leak existence).
 */
export async function getContractRole(
  userId: string,
  contractId: string
): Promise<ContractAccess> {
  const row = await findOwnedContract(contractId);
  const ownRows = await db
    .select({ role: participant.role, linkedUserId: participant.linkedUserId })
    .from(participant)
    .where(
      and(
        eq(participant.contractId, contractId),
        eq(participant.linkedUserId, userId)
      )
    );
  const role = slotOf(userId, row, ownRows);
  if (!role) {
    throw new NotFoundError("Contrato não encontrado");
  }
  return { role, isOwner: row.ownerId === userId };
}

/** The user's capabilities in the contract. Throws NotFoundError without access. */
export async function getCapabilities(
  userId: string,
  contractId: string
): Promise<Capabilities> {
  const row = await findOwnedContract(contractId);
  const people = await db
    .select({ role: participant.role, linkedUserId: participant.linkedUserId })
    .from(participant)
    .where(eq(participant.contractId, contractId));
  const caps = capabilitiesFromRows(userId, row, people);
  if (!caps) {
    throw new NotFoundError("Contrato não encontrado");
  }
  return caps;
}

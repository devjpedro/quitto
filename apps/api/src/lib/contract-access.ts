import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { contract, participant, user as userTable } from "../db/schema";
import { NotFoundError } from "./errors";

export type ParticipantSlot = "buyer" | "seller" | "viewer";

export interface ContractAccess {
  /** Dono do contrato (gestão), derivado de contract.ownerId. */
  isOwner: boolean;
  /** Vaga real do usuário no contrato. */
  role: ParticipantSlot;
}

export interface Capabilities extends ContractAccess {
  /** Pode confirmar/contestar. */
  isApprover: boolean;
  /** Pode pagar/anexar comprovante/marcar paga. */
  isPayer: boolean;
}

export interface ParticipantRow {
  linkedUserId: string | null;
  role: string;
}

export interface Recebedor {
  displayName: string | null;
  profileKey: string | null;
}

interface OwnedContract {
  ownerId: string;
  ownerRole: string;
}

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
 * Capacidade segue a vaga. O dono herda o lado oposto SOMENTE enquanto a outra
 * vaga não tiver contraparte com conta vinculada (linkedUserId !== null).
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

/**
 * Who receives the money and their profile key, from rows already loaded.
 * `users` must hold the owner (seller-owned contracts) and the linked seller.
 */
export function pickRecebedor(
  c: OwnedContract,
  people: { displayName: string; linkedUserId: string | null; role: string }[],
  users: ReadonlyMap<string, { name: string; pixKey: string | null }>
): Recebedor {
  if (c.ownerRole === "seller") {
    const owner = users.get(c.ownerId);
    return {
      displayName: owner?.name ?? null,
      profileKey: owner?.pixKey ?? null,
    };
  }
  const sellers = people.filter((p) => p.role === "seller");
  const [seller] = sellers;
  if (sellers.length !== 1 || !seller) {
    return { displayName: null, profileKey: null };
  }
  const linked = seller.linkedUserId
    ? users.get(seller.linkedUserId)
    : undefined;
  return {
    displayName: seller.displayName,
    profileKey: linked?.pixKey ?? null,
  };
}

/** Resolve quem recebe o dinheiro no contrato e sua chave de perfil. */
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
            role: participant.role,
          })
          .from(participant)
          .where(
            and(
              eq(participant.contractId, c.id),
              eq(participant.role, "seller")
            )
          );
  const userIds =
    c.ownerRole === "seller"
      ? [c.ownerId]
      : people.flatMap((p) => (p.linkedUserId ? [p.linkedUserId] : []));
  const rows =
    userIds.length === 0
      ? []
      : await db
          .select({
            id: userTable.id,
            name: userTable.name,
            pixKey: userTable.pixKey,
          })
          .from(userTable)
          .where(inArray(userTable.id, userIds));
  return pickRecebedor(c, people, new Map(rows.map((u) => [u.id, u])));
}

/**
 * Resolve a vaga real do usuário + se ele é o dono. Lança NotFoundError quando o
 * contrato não existe OU o usuário não tem acesso (não vaza existência).
 */
export async function getContractRole(
  userId: string,
  contractId: string
): Promise<ContractAccess> {
  const found = await db
    .select()
    .from(contract)
    .where(eq(contract.id, contractId))
    .limit(1);
  const row = found[0];
  if (!row) {
    throw new NotFoundError("Contrato não encontrado");
  }
  const isOwner = row.ownerId === userId;
  const link = await db
    .select()
    .from(participant)
    .where(
      and(
        eq(participant.contractId, contractId),
        eq(participant.linkedUserId, userId)
      )
    )
    .limit(1);
  const slot = link[0]?.role;
  if (slot && slot !== "owner") {
    return { role: slot, isOwner };
  }
  // Safety net: dono sem linha de participante (inconsistência legada) cai no ownerRole.
  if (isOwner && (row.ownerRole === "buyer" || row.ownerRole === "seller")) {
    return { role: row.ownerRole, isOwner: true };
  }
  throw new NotFoundError("Contrato não encontrado");
}

/** Capacidades do usuário no contrato. Lança NotFoundError sem acesso. */
export async function getCapabilities(
  userId: string,
  contractId: string
): Promise<Capabilities> {
  const [row] = await db
    .select({ ownerId: contract.ownerId, ownerRole: contract.ownerRole })
    .from(contract)
    .where(eq(contract.id, contractId))
    .limit(1);
  if (!row) {
    throw new NotFoundError("Contrato não encontrado");
  }
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

import { and, eq } from "drizzle-orm";
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

/** Resolve quem recebe o dinheiro no contrato e sua chave de perfil. */
export async function resolveRecebedor(c: {
  id: string;
  ownerId: string;
  ownerRole: string;
}): Promise<{ displayName: string | null; profileKey: string | null }> {
  if (c.ownerRole === "seller") {
    const [owner] = await db
      .select({ name: userTable.name, pixKey: userTable.pixKey })
      .from(userTable)
      .where(eq(userTable.id, c.ownerId))
      .limit(1);
    return {
      displayName: owner?.name ?? null,
      profileKey: owner?.pixKey ?? null,
    };
  }

  const sellers = await db
    .select({
      displayName: participant.displayName,
      linkedUserId: participant.linkedUserId,
    })
    .from(participant)
    .where(
      and(eq(participant.contractId, c.id), eq(participant.role, "seller"))
    );
  if (sellers.length !== 1) {
    return { displayName: null, profileKey: null };
  }
  const seller = sellers[0];
  if (!seller) {
    return { displayName: null, profileKey: null };
  }
  if (!seller.linkedUserId) {
    return { displayName: seller.displayName, profileKey: null };
  }

  const [linked] = await db
    .select({ pixKey: userTable.pixKey })
    .from(userTable)
    .where(eq(userTable.id, seller.linkedUserId))
    .limit(1);
  return {
    displayName: seller.displayName,
    profileKey: linked?.pixKey ?? null,
  };
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

/**
 * Capacidade segue a vaga. O dono herda o lado oposto SOMENTE enquanto a outra
 * vaga não tiver contraparte com conta vinculada (linkedUserId !== null).
 */
export async function getCapabilities(
  userId: string,
  contractId: string
): Promise<Capabilities> {
  const access = await getContractRole(userId, contractId);
  const people = await db
    .select({
      role: participant.role,
      linkedUserId: participant.linkedUserId,
    })
    .from(participant)
    .where(eq(participant.contractId, contractId));
  const hasLinkedBuyer = people.some(
    (p) => p.role === "buyer" && p.linkedUserId !== null
  );
  const hasLinkedSeller = people.some(
    (p) => p.role === "seller" && p.linkedUserId !== null
  );
  const isPayer =
    access.role === "buyer" || (access.isOwner && !hasLinkedBuyer);
  const isApprover =
    access.role === "seller" || (access.isOwner && !hasLinkedSeller);
  return { ...access, isPayer, isApprover };
}

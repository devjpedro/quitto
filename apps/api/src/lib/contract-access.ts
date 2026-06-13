import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { contract, participant } from "../db/schema";
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
  if (isOwner) {
    return {
      role: row.ownerRole === "seller" ? "seller" : "buyer",
      isOwner: true,
    };
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

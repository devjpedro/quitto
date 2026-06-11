import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { contract, participant } from "../db/schema";
import { NotFoundError } from "./errors";

export type ContractRole = "owner" | "buyer" | "seller" | "viewer";

/**
 * Resolves the user's role on a contract. Throws NotFoundError when the contract does not exist
 * OR the user has no access (não vaza existência). Owner is derived from contract.ownerId.
 */
export async function getContractRole(
  userId: string,
  contractId: string
): Promise<ContractRole> {
  const found = await db
    .select()
    .from(contract)
    .where(eq(contract.id, contractId))
    .limit(1);
  const row = found[0];
  if (!row) {
    throw new NotFoundError("Contrato não encontrado");
  }
  if (row.ownerId === userId) {
    return "owner";
  }
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
  const role = link[0]?.role;
  if (!role || role === "owner") {
    throw new NotFoundError("Contrato não encontrado");
  }
  return role;
}

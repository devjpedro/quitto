import { eq, inArray, max } from "drizzle-orm";
import { db } from "../db/client";
import {
  contract,
  installment,
  invite,
  participant,
  proof,
  user as userTable,
} from "../db/schema";
import { visibleContractsWhere } from "./contract-visibility";
import type {
  HomeContractRow,
  HomeContractRows,
  HomeParticipantRow,
} from "./home-parties";

export interface ListContractRow extends HomeContractRow {
  description: string | null;
  monthlyAmountCents: number | null;
}

export interface SlotInviteRow {
  acceptedAt: Date | null;
  createdAt: Date;
  declinedAt: Date | null;
  /** Already normalized when stored. */
  email: string;
  expiresAt: Date;
  participantId: string;
}

export interface ListParticipantRow extends HomeParticipantRow {
  /** The slot: invites point at it. */
  id: string;
}

export interface AccountRow {
  email: string;
  id: string;
  name: string;
}

export interface ContractRows
  extends Omit<HomeContractRows, "contracts" | "participants"> {
  /** Owners and every linked buyer/seller of the caller's contracts. */
  accounts: AccountRow[];
  contracts: ListContractRow[];
  /** Every invite of the caller's contracts. */
  invites: SlotInviteRow[];
  participants: ListParticipantRow[];
}

const EMPTY_ROWS: ContractRows = {
  accounts: [],
  contracts: [],
  installments: [],
  invites: [],
  participants: [],
  users: [],
};

/**
 * Contracts the user sees (owned or linked), with every row the lists and the
 * home need. 3 sequential round trips at most. Callers filter by their own
 * session user: the visibility rule lives here, once.
 */
export async function loadContractRows(userId: string): Promise<ContractRows> {
  const contracts = await db
    .select({
      id: contract.id,
      title: contract.title,
      description: contract.description,
      monthlyAmountCents: contract.monthlyAmountCents,
      ownerId: contract.ownerId,
      ownerRole: contract.ownerRole,
      requiresConfirmation: contract.requiresConfirmation,
      status: contract.status,
      installmentsCount: contract.installmentsCount,
      createdAt: contract.createdAt,
    })
    .from(contract)
    .where(visibleContractsWhere(userId));
  if (contracts.length === 0) {
    return EMPTY_ROWS;
  }
  const ids = contracts.map((c) => c.id);
  const [installmentRows, participants, proofs, invites] = await Promise.all([
    db
      .select({
        id: installment.id,
        contractId: installment.contractId,
        sequence: installment.sequence,
        amountCents: installment.amountCents,
        dueDate: installment.dueDate,
        status: installment.status,
        paidAt: installment.paidAt,
      })
      .from(installment)
      .where(inArray(installment.contractId, ids)),
    db
      .select({
        id: participant.id,
        contractId: participant.contractId,
        displayName: participant.displayName,
        role: participant.role,
        linkedUserId: participant.linkedUserId,
        pixKey: participant.pixKey,
      })
      .from(participant)
      .where(inArray(participant.contractId, ids)),
    // Latest proof per installment: when the payer acted in a contract with
    // confirmation ("Tudo em dia" counts it, not the confirmation time).
    db
      .select({ installmentId: proof.installmentId, at: max(proof.createdAt) })
      .from(proof)
      .innerJoin(installment, eq(proof.installmentId, installment.id))
      .where(inArray(installment.contractId, ids))
      .groupBy(proof.installmentId),
    db
      .select({
        participantId: invite.participantId,
        email: invite.email,
        createdAt: invite.createdAt,
        expiresAt: invite.expiresAt,
        acceptedAt: invite.acceptedAt,
        declinedAt: invite.declinedAt,
      })
      .from(invite)
      .where(inArray(invite.contractId, ids)),
  ]);
  const lastProofAt = new Map(proofs.map((p) => [p.installmentId, p.at]));
  const installments = installmentRows.map((row) => ({
    ...row,
    lastProofAt: lastProofAt.get(row.id) ?? null,
  }));
  // Owners (seller-owned receive key + name) and every linked buyer/seller.
  const userIds = [
    ...new Set([
      ...contracts.map((c) => c.ownerId),
      ...participants.flatMap((p) =>
        (p.role === "buyer" || p.role === "seller") && p.linkedUserId
          ? [p.linkedUserId]
          : []
      ),
    ]),
  ];
  const accounts = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      pixKey: userTable.pixKey,
    })
    .from(userTable)
    .where(inArray(userTable.id, userIds));
  return {
    contracts,
    installments,
    participants,
    invites,
    users: accounts.map(({ id, name, pixKey }) => ({ id, name, pixKey })),
    accounts: accounts.map(({ id, name, email }) => ({ id, name, email })),
  };
}

import { randomBytes } from "node:crypto";
import { isPaidStatus, type PublicReceipt } from "@quitto/shared";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../db/client";
import {
  contract,
  installment,
  participant,
  proof,
  receiptShare,
  user,
} from "../db/schema";
import {
  buildReceiptModel,
  type ReceiptModel,
  type ReceiptProof,
  toModelInstallment,
} from "./documents/model";
import { NotFoundError } from "./errors";

const WHITESPACE_RE = /\s+/;

/** 256 bits aleatórios em base64url (43 chars) — inviável de enumerar. */
export function newShareToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function findActiveShare(
  installmentId: string
): Promise<{ token: string; createdAt: Date } | null> {
  const [row] = await db
    .select({ token: receiptShare.token, createdAt: receiptShare.createdAt })
    .from(receiptShare)
    .where(
      and(
        eq(receiptShare.installmentId, installmentId),
        isNull(receiptShare.revokedAt)
      )
    )
    .limit(1);
  return row ?? null;
}

/**
 * The newest proof of the installment, as the fact the receipt states: the
 * sender's first name and the instant. No proof, or one whose sender's account
 * is gone, is no line (the file itself never leaves here).
 */
export async function latestProofOf(
  installmentId: string
): Promise<ReceiptProof | null> {
  const [row] = await db
    .select({ at: proof.createdAt, name: user.name })
    .from(proof)
    .innerJoin(user, eq(user.id, proof.uploadedBy))
    .where(eq(proof.installmentId, installmentId))
    .orderBy(desc(proof.createdAt))
    .limit(1);
  const by = row?.name.trim().split(WHITESPACE_RE)[0];
  return row && by ? { at: row.at.toISOString(), by } : null;
}

const UNAVAILABLE = "Recibo não disponível";

/**
 * token → share ATIVO → parcela PAGA → modelo do recibo. Qualquer falha é o
 * mesmo 404: não revela se o link existe, foi revogado ou a parcela mudou.
 */
export async function resolvePublicReceipt(
  token: string
): Promise<{ model: ReceiptModel; ownerId: string }> {
  const [share] = await db
    .select({ installmentId: receiptShare.installmentId })
    .from(receiptShare)
    .where(and(eq(receiptShare.token, token), isNull(receiptShare.revokedAt)))
    .limit(1);
  if (!share) {
    throw new NotFoundError(UNAVAILABLE);
  }
  const [inst] = await db
    .select()
    .from(installment)
    .where(eq(installment.id, share.installmentId))
    .limit(1);
  if (!(inst && isPaidStatus(inst.status))) {
    throw new NotFoundError(UNAVAILABLE);
  }
  const [c] = await db
    .select({
      title: contract.title,
      installmentsCount: contract.installmentsCount,
      ownerId: contract.ownerId,
    })
    .from(contract)
    .where(eq(contract.id, inst.contractId))
    .limit(1);
  if (!c) {
    throw new NotFoundError(UNAVAILABLE);
  }
  const people = await db
    .select({ role: participant.role, displayName: participant.displayName })
    .from(participant)
    .where(eq(participant.contractId, inst.contractId));
  return {
    model: buildReceiptModel(
      c,
      toModelInstallment(inst),
      people,
      await latestProofOf(inst.id)
    ),
    ownerId: c.ownerId,
  };
}

/** Achata o modelo nos campos permitidos — nunca espalhar `...model`. */
export function toPublicReceipt(model: ReceiptModel): PublicReceipt {
  return {
    contractTitle: model.contractTitle,
    sequence: model.sequence,
    installmentsCount: model.installmentsCount,
    amountCents: model.amountCents,
    paidAt: model.paidAt,
    payerName: model.parties.payerName,
    receiverName: model.parties.receiverName,
    proofBy: model.proof?.by ?? null,
    proofAt: model.proof?.at ?? null,
  };
}

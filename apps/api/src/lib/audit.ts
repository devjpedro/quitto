import type { db } from "../db/client";
import { auditEvent } from "../db/schema";

export type AuditType =
  | "proof_submitted"
  | "payment_confirmed"
  | "payment_disputed"
  | "installment_paid";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Appends an immutable audit event. Pass a tx to join an existing transaction. */
export async function recordEvent(
  exec: typeof db | Tx,
  input: {
    contractId: string;
    installmentId?: string;
    actorUserId: string;
    type: AuditType;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await exec.insert(auditEvent).values({
    contractId: input.contractId,
    installmentId: input.installmentId ?? null,
    actorUserId: input.actorUserId,
    type: input.type,
    metadata: input.metadata ?? null,
  });
}

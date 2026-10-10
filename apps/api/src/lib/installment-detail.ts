import { AUDIT_TYPE, INSTALLMENT_STATUS } from "@quitto/shared";

interface Dated {
  createdAt: Date;
}

interface EventLike extends Dated {
  metadata: unknown;
  type: string;
}

export interface ProofState {
  reason: string | null;
  state: "current" | "disputed";
}

function reasonOf(event: EventLike): string | null {
  const metadata = event.metadata as { reason?: unknown } | null;
  return typeof metadata?.reason === "string" ? metadata.reason : null;
}

const byTime = (a: Dated, b: Dated) =>
  a.createdAt.getTime() - b.createdAt.getTime();

/**
 * Each proof's standing (planner's decision 6): a proof is disputed when a
 * dispute came after it and before the next upload; the others are current.
 * The state machine only takes a new proof after a dispute, so at most one
 * is current. The reason comes from the dispute event.
 */
export function proofStates(
  proofs: ({ id: string } & Dated)[],
  events: EventLike[]
): Map<string, ProofState> {
  const sorted = [...proofs].sort(byTime);
  const disputes = events
    .filter((e) => e.type === AUDIT_TYPE.paymentDisputed)
    .sort(byTime);
  const out = new Map<string, ProofState>();
  for (const [index, proof] of sorted.entries()) {
    const next = sorted[index + 1]?.createdAt.getTime() ?? null;
    const dispute = disputes.find(
      (d) =>
        d.createdAt.getTime() >= proof.createdAt.getTime() &&
        (next === null || d.createdAt.getTime() < next)
    );
    out.set(
      proof.id,
      dispute
        ? { state: "disputed", reason: reasonOf(dispute) }
        : { state: "current", reason: null }
    );
  }
  return out;
}

/** The dispute a payer reads on a disputed installment (P6): the last one, flattened. */
export function latestDispute(
  status: string,
  events: (EventLike & {
    actorName: string | null;
    actorUserId: string | null;
  })[],
  viewerId: string
): {
  at: string;
  byMe: boolean;
  byName: string | null;
  reason: string | null;
} | null {
  if (status !== INSTALLMENT_STATUS.disputed) {
    return null;
  }
  const last = events
    .filter((e) => e.type === AUDIT_TYPE.paymentDisputed)
    .sort(byTime)
    .at(-1);
  return last
    ? {
        reason: reasonOf(last),
        byName: last.actorName,
        byMe: last.actorUserId === viewerId,
        at: last.createdAt.toISOString(),
      }
    : null;
}

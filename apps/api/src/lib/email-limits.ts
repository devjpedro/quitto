import { captureMessage } from "@sentry/bun";
import { and, count, eq, gt, isNull } from "drizzle-orm";
import { db } from "../db/client";
import { invite } from "../db/schema";
import { ConflictError, RateLimitedError } from "./errors";
import { createRateLimiter, rateLimitOn } from "./rate-limit";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Pending (open, not expired) invites one slot may carry at a time. */
export const MAX_PENDING_INVITES_PER_PARTICIPANT = 3;

/** Every invite email costs money and reputation: caps per user and per invite. */
const inviteLimiter = createRateLimiter({ max: 20, windowMs: DAY });
const resendLimiter = createRateLimiter({ max: 3, windowMs: DAY });
const resendCooldown = createRateLimiter({ max: 1, windowMs: 10 * MINUTE });

/** Counts one invite email against the user's day; 429 past 20. */
export function checkInviteQuota(userId: string): void {
  if (rateLimitOn() && !inviteLimiter.hit(userId)) {
    throw new RateLimitedError("Muitos convites hoje. Tente amanhã.");
  }
}

/** A resend is 3 a day per invite and never twice within 10 minutes. */
export function checkResendQuota(inviteId: string): void {
  if (!rateLimitOn()) {
    return;
  }
  if (!resendCooldown.hit(inviteId)) {
    throw new RateLimitedError("Espere 10 minutos para reenviar de novo.");
  }
  if (!resendLimiter.hit(inviteId)) {
    throw new RateLimitedError("Muitos reenvios hoje. Tente amanhã.");
  }
}

/** 409 when the slot already has the maximum of pending invites. */
export async function assertPendingInviteRoom(
  participantId: string
): Promise<void> {
  const [row] = await db
    .select({ n: count() })
    .from(invite)
    .where(
      and(
        eq(invite.participantId, participantId),
        isNull(invite.acceptedAt),
        isNull(invite.declinedAt),
        gt(invite.expiresAt, new Date())
      )
    );
  if ((row?.n ?? 0) >= MAX_PENDING_INVITES_PER_PARTICIPANT) {
    throw new ConflictError("Convites pendentes demais para esta vaga");
  }
}

/** Global ceiling on emails a day (in memory, one process): fails closed rather than burn the sender's reputation. */
export const EMAIL_DAILY_CAP = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

let capWindow = { sent: 0, resetAt: 0, alerted: false };

/** Counts one email against the day's cap; false (and one Sentry message per window) once it is spent. */
export function takeEmailSlot(now: number = Date.now()): boolean {
  if (capWindow.resetAt <= now) {
    capWindow = { sent: 0, resetAt: now + DAY_MS, alerted: false };
  }
  if (capWindow.sent >= EMAIL_DAILY_CAP) {
    if (!capWindow.alerted) {
      capWindow.alerted = true;
      captureMessage("Cota diária de e-mail esgotada", "warning");
    }
    return false;
  }
  capWindow.sent += 1;
  return true;
}

export function resetEmailCap(): void {
  capWindow = { sent: 0, resetAt: 0, alerted: false };
}

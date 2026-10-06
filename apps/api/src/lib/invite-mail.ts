import { randomBytes } from "node:crypto";
import { env } from "../env";
import { inviteEmail } from "./email-templates";
import { sendEmail } from "./mailer";
import { ROLE_LABEL } from "./role-label";

export const INVITE_TTL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 256 random bits, in hex: the invite link's secret. */
export function newInviteToken(): string {
  return randomBytes(32).toString("hex");
}

/** When an invite sent (or resent) now stops working. */
export function inviteExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + INVITE_TTL_DAYS * DAY_MS);
}

export interface InviteEmailInput {
  contractTitle: string;
  email: string;
  inviterName: string;
  role: string;
  token: string;
}

export async function sendInviteEmail(args: InviteEmailInput): Promise<void> {
  const acceptUrl = `${env.WEB_ORIGIN}/invites/${args.token}`;
  const { subject, html } = inviteEmail({
    acceptUrl,
    inviterName: args.inviterName,
    contractTitle: args.contractTitle,
    roleLabel: ROLE_LABEL[args.role] ?? args.role,
  });
  await sendEmail({ to: args.email, subject, html });
}

/**
 * Best-effort, after the commit: a mail failure never undoes the invite (the
 * owner copies the link or resends from the contract). True when it left.
 */
export async function trySendInviteEmail(
  args: InviteEmailInput
): Promise<boolean> {
  try {
    await sendInviteEmail(args);
    return true;
  } catch (err) {
    console.warn(`[invite] falha ao enviar e-mail do convite: ${err}`);
    return false;
  }
}

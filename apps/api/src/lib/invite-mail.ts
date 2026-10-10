import { randomBytes } from "node:crypto";
import { env } from "../env";
import { inviteEmail } from "./email-templates";
import { EMAIL_TEXT } from "./email-text";
import { loadInviteTerms } from "./invite-terms";
import { localeOfEmail, pickLocale, userLocale } from "./locale";
import { sendEmail } from "./mailer";

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
  contractId: string;
  contractTitle: string;
  email: string;
  inviterId: string;
  inviterName: string;
  role: string;
  token: string;
}

export async function sendInviteEmail(args: InviteEmailInput): Promise<void> {
  const acceptUrl = `${env.WEB_ORIGIN}/invites/${args.token}`;
  const locale = pickLocale(
    await localeOfEmail(args.email),
    await userLocale(args.inviterId)
  );
  const text = EMAIL_TEXT[locale].invite;
  const terms = (await loadInviteTerms([args.contractId])).get(args.contractId);
  const { subject, html } = inviteEmail({
    acceptUrl,
    contractTitle: args.contractTitle || text.aContract,
    inviterName: args.inviterName || text.someone,
    locale,
    role: args.role,
    terms,
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

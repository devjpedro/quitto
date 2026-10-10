import { normalizeEmail } from "./email";
import type { InviteTerms } from "./invite-terms";

export type InviteStatus = "pending" | "accepted" | "declined" | "expired";
export type InviteViewer =
  | "invitee"
  | "owner"
  | "otherAccount"
  | "alreadyParticipant";

interface InviteDates {
  acceptedAt: Date | null;
  declinedAt: Date | null;
  expiresAt: Date;
}

/**
 * Accepted (this copy, or the slot already taken through another copy of
 * the invite: accepting this one would fail), then declined, then expired,
 * else pending (planner's decision 11).
 */
export function inviteStatus(
  row: InviteDates,
  now: Date,
  slotTaken = false
): InviteStatus {
  if (row.acceptedAt || slotTaken) {
    return "accepted";
  }
  if (row.declinedAt) {
    return "declined";
  }
  return row.expiresAt.getTime() < now.getTime() ? "expired" : "pending";
}

/**
 * Who opened the link: the owner; the invited e-mail (unless it already
 * takes part through another slot, where accepting would fail); someone in
 * the contract; anyone else.
 */
export function inviteViewer(input: {
  inviteEmail: string;
  ownerId: string;
  participates: boolean;
  status: InviteStatus;
  userEmail: string;
  userId: string;
}): InviteViewer {
  if (input.userId === input.ownerId) {
    return "owner";
  }
  const invited = normalizeEmail(input.userEmail) === input.inviteEmail;
  if (invited && (input.status === "accepted" || !input.participates)) {
    return "invitee";
  }
  return input.participates ? "alreadyParticipant" : "otherAccount";
}

/** "j•••@exemplo.com": the first letter and the domain. */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) {
    return "•••";
  }
  return `${email.slice(0, 1)}•••${email.slice(at)}`;
}

export interface InviteView {
  acceptedAt: string | null;
  contract: { createdAt: string; description: string | null; title: string };
  contractId: string;
  declinedAt: string | null;
  /** The full address, only for the invitee and the owner. */
  email: string | null;
  emailMasked: string;
  expiresAt: string;
  inviteeName: string | null;
  inviterName: string;
  participantId: string;
  requiresConfirmation: boolean;
  /** The role the invite offers: buyer, seller or viewer. */
  role: string;
  schedulePreview: { amountCents: number; dueDate: string; sequence: number }[];
  sentAt: string;
  status: InviteStatus;
  /** Null (and no schedule) for another account once the invite ended, as the public preview. */
  terms: InviteTerms | null;
  viewer: InviteViewer;
}

export interface InviteViewInput {
  contract: {
    createdAt: Date;
    description: string | null;
    id: string;
    ownerId: string;
    requiresConfirmation: boolean;
    title: string;
  };
  inviterName: string;
  now: Date;
  participates: boolean;
  row: InviteDates & { createdAt: Date; email: string; participantId: string };
  schedulePreview: { amountCents: number; dueDate: string; sequence: number }[];
  /** `taken`: someone is already linked to the slot. */
  slot: { displayName: string; role: string; taken: boolean };
  terms: InviteTerms;
  user: { email: string; id: string };
}

export function buildInviteView(input: InviteViewInput): InviteView {
  const status = inviteStatus(input.row, input.now, input.slot.taken);
  const viewer = inviteViewer({
    inviteEmail: input.row.email,
    ownerId: input.contract.ownerId,
    participates: input.participates,
    status,
    userEmail: input.user.email,
    userId: input.user.id,
  });
  const seesEmail = viewer === "invitee" || viewer === "owner";
  // A leaked link opened by any account shows no more than the public
  // preview: the money of an ended invite stays with who is in it.
  const seesTerms = viewer !== "otherAccount" || status === "pending";
  return {
    status,
    viewer,
    contractId: input.contract.id,
    participantId: input.row.participantId,
    inviterName: input.inviterName,
    contract: {
      title: input.contract.title,
      // No screen of another account draws it: it stays with who is in the contract.
      description:
        viewer === "otherAccount" ? null : input.contract.description,
      createdAt: input.contract.createdAt.toISOString(),
    },
    role: input.slot.role,
    requiresConfirmation: input.contract.requiresConfirmation,
    terms: seesTerms ? input.terms : null,
    schedulePreview: seesTerms ? input.schedulePreview : [],
    sentAt: input.row.createdAt.toISOString(),
    expiresAt: input.row.expiresAt.toISOString(),
    acceptedAt: input.row.acceptedAt?.toISOString() ?? null,
    declinedAt: input.row.declinedAt?.toISOString() ?? null,
    email: seesEmail ? input.row.email : null,
    emailMasked: maskEmail(input.row.email),
    inviteeName: viewer === "owner" ? input.slot.displayName : null,
  };
}

/**
 * Before signing in (owner's decision 13): the minimum, never the
 * description, the parties or the full e-mail. The terms only while the
 * invite is pending: an ended invite shows who and what, never the money of
 * a contract that is running.
 */
export interface PublicInvitePreview {
  contractTitle: string;
  emailMasked: string;
  expiresAt: string;
  inviterName: string;
  role: string;
  status: InviteStatus;
  terms: {
    amountCents: number | null;
    firstDueDate: string | null;
    installmentsCount: number;
    totalCents: number;
  } | null;
}

export function buildPublicPreview(input: {
  contractTitle: string;
  inviterName: string;
  now: Date;
  role: string;
  row: InviteDates & { email: string };
  slotTaken: boolean;
  terms: InviteTerms;
}): PublicInvitePreview {
  const status = inviteStatus(input.row, input.now, input.slotTaken);
  return {
    status,
    inviterName: input.inviterName,
    contractTitle: input.contractTitle,
    role: input.role,
    terms:
      status === "pending"
        ? {
            installmentsCount: input.terms.installmentsCount,
            amountCents: input.terms.amountCents,
            totalCents: input.terms.totalCents,
            firstDueDate: input.terms.firstDueDate,
          }
        : null,
    emailMasked: maskEmail(input.row.email),
    expiresAt: input.row.expiresAt.toISOString(),
  };
}

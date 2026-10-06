import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/client";
import {
  contract,
  installment,
  invite,
  participant,
  user as userTable,
} from "../db/schema";
import { NotFoundError } from "./errors";
import { loadInviteTerms } from "./invite-terms";
import {
  buildInviteView,
  buildPublicPreview,
  type InviteView,
  type PublicInvitePreview,
} from "./invite-view";

export type InviteRow = typeof invite.$inferSelect;

export async function findInvite(
  token: string
): Promise<InviteRow | undefined> {
  const [row] = await db
    .select()
    .from(invite)
    .where(eq(invite.token, token))
    .limit(1);
  return row;
}

/** The contract, the invited slot and who invited, in one read. */
async function loadSubject(row: InviteRow) {
  const [subject] = await db
    .select({
      id: contract.id,
      title: contract.title,
      description: contract.description,
      ownerId: contract.ownerId,
      requiresConfirmation: contract.requiresConfirmation,
      createdAt: contract.createdAt,
      slotName: participant.displayName,
      slotRole: participant.role,
      slotLinkedUserId: participant.linkedUserId,
      inviterName: userTable.name,
    })
    .from(contract)
    .innerJoin(participant, eq(participant.id, row.participantId))
    .innerJoin(userTable, eq(userTable.id, contract.ownerId))
    .where(eq(contract.id, row.contractId))
    .limit(1);
  if (!subject) {
    throw new NotFoundError("Convite não encontrado");
  }
  return subject;
}

async function loadSchedulePreview(contractId: string) {
  return await db
    .select({
      sequence: installment.sequence,
      dueDate: installment.dueDate,
      amountCents: installment.amountCents,
    })
    .from(installment)
    .where(eq(installment.contractId, contractId))
    .orderBy(asc(installment.sequence))
    .limit(3);
}

async function participatesIn(contractId: string, userId: string) {
  const [mine] = await db
    .select({ id: participant.id })
    .from(participant)
    .where(
      and(
        eq(participant.contractId, contractId),
        eq(participant.linkedUserId, userId)
      )
    )
    .limit(1);
  return Boolean(mine);
}

/** GET /invites/:token and the decline's answer, for the signed-in user. */
export async function inviteViewFor(
  row: InviteRow,
  user: { email: string; id: string }
): Promise<InviteView> {
  const [subject, terms, schedulePreview, participates] = await Promise.all([
    loadSubject(row),
    loadInviteTerms([row.contractId]),
    loadSchedulePreview(row.contractId),
    participatesIn(row.contractId, user.id),
  ]);
  const contractTerms = terms.get(row.contractId);
  if (!contractTerms) {
    throw new NotFoundError("Convite não encontrado");
  }
  return buildInviteView({
    contract: subject,
    inviterName: subject.inviterName,
    now: new Date(),
    participates,
    row,
    schedulePreview,
    slot: {
      displayName: subject.slotName,
      role: subject.slotRole,
      taken: subject.slotLinkedUserId !== null,
    },
    terms: contractTerms,
    user,
  });
}

/** GET /invites/:token/preview: no session, the minimum. */
export async function publicPreviewFor(
  row: InviteRow
): Promise<PublicInvitePreview> {
  const [subject, terms] = await Promise.all([
    loadSubject(row),
    loadInviteTerms([row.contractId]),
  ]);
  const contractTerms = terms.get(row.contractId);
  if (!contractTerms) {
    throw new NotFoundError("Convite não encontrado");
  }
  return buildPublicPreview({
    contractTitle: subject.title,
    inviterName: subject.inviterName,
    now: new Date(),
    role: subject.slotRole,
    row,
    slotTaken: subject.slotLinkedUserId !== null,
    terms: contractTerms,
  });
}

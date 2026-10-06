import {
  buildSchedule,
  type ContractRequest,
  oppositeRole,
  type ScheduleRow,
  toScheduleInput,
} from "@quitto/shared";
import { db } from "../db/client";
import { contract, installment, invite, participant } from "../db/schema";
import { normalizeEmail } from "./email";
import { inviteExpiry, newInviteToken } from "./invite-mail";

export interface CreatedContract {
  id: string;
  /** The invite to e-mail after the commit; null with no other party or no e-mail. */
  invite: { email: string; role: "buyer" | "seller"; token: string } | null;
}

function requestRows(body: ContractRequest): ScheduleRow[] {
  const schedule = toScheduleInput(body.schedule);
  if (schedule) {
    return buildSchedule(schedule, body.installments);
  }
  if (body.schedule.mode !== "custom") {
    return [];
  }
  return body.schedule.installments.map((row, index) => ({
    sequence: index + 1,
    amountCents: row.amountCents,
    dueDate: row.dueDate,
  }));
}

/**
 * The contract, its installments, the owner's slot, the other party's slot
 * (the opposite role, planner's decision 7) and its invite, in one
 * transaction. The e-mail goes after the commit (the caller sends it).
 */
export async function createContract(
  owner: { id: string; name: string },
  body: ContractRequest
): Promise<CreatedContract> {
  const rows = requestRows(body);
  const schedule = toScheduleInput(body.schedule);
  const party = body.counterparty ?? null;
  const email = party?.email ? normalizeEmail(party.email) : null;
  const totalAmountCents = rows.reduce((sum, row) => sum + row.amountCents, 0);

  return await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(contract)
      .values({
        ownerId: owner.id,
        title: body.title,
        description: body.description?.trim() || null,
        ownerRole: body.ownerRole,
        totalAmountCents,
        installmentsCount: rows.length,
        requiresConfirmation: body.requiresConfirmation,
        // Adjusted one by one, it is no longer a fixed monthly amount (decision 8).
        monthlyAmountCents:
          schedule?.mode === "monthly" && !body.installments
            ? schedule.monthlyAmountCents
            : null,
      })
      .returning({ id: contract.id });
    if (!created) {
      throw new Error("contract insert returned no row");
    }
    await tx.insert(installment).values(
      rows.map((row) => ({
        contractId: created.id,
        sequence: row.sequence,
        amountCents: row.amountCents,
        dueDate: row.dueDate,
      }))
    );
    await tx.insert(participant).values({
      contractId: created.id,
      displayName: owner.name,
      role: body.ownerRole,
      linkedUserId: owner.id,
    });
    if (!party) {
      return { id: created.id, invite: null };
    }
    const role = oppositeRole(body.ownerRole);
    const [slot] = await tx
      .insert(participant)
      .values({ contractId: created.id, displayName: party.name, role })
      .returning({ id: participant.id });
    if (!(slot && email)) {
      return { id: created.id, invite: null };
    }
    const token = newInviteToken();
    await tx.insert(invite).values({
      contractId: created.id,
      participantId: slot.id,
      email,
      token,
      expiresAt: inviteExpiry(),
    });
    return { id: created.id, invite: { email, role, token } };
  });
}

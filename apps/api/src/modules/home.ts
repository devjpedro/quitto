import { todayISO } from "@quitto/shared";
import { and, count, desc, eq, gt, isNull } from "drizzle-orm";
import { Elysia } from "elysia";
import { db } from "../db/client";
import {
  contract,
  invite,
  notification,
  participant,
  user as userTable,
} from "../db/schema";
import { loadContractRows } from "../lib/contract-rows";
import { visibleNotificationsWhere } from "../lib/contract-visibility";
import { normalizeEmail } from "../lib/email";
import { emailRemindersEnabled } from "../lib/email-reminders";
import { buildAgenda } from "../lib/home";
import { buildMilestones } from "../lib/home-milestones";
import { onboardingFacts } from "../lib/home-onboarding";
import { partyContracts } from "../lib/home-parties";
import { activeContracts } from "../lib/home-progress";
import { sidebarContracts } from "../lib/home-sidebar";
import type { HomeInviteRow } from "../lib/home-types";
import { loadInviteTerms } from "../lib/invite-terms";
import { requireAuth } from "../lib/session";
import { homeSchema } from "./home-schema";

/** Pending invites for the session e-mail: not accepted, not declined, not expired, slot still open. One per slot, and its latest copy decides. */
async function loadInvites(email: string): Promise<HomeInviteRow[]> {
  const rows = await db
    .select({
      participantId: invite.participantId,
      token: invite.token,
      contractId: invite.contractId,
      createdAt: invite.createdAt,
      declinedAt: invite.declinedAt,
      contractTitle: contract.title,
      role: participant.role,
      inviterName: userTable.name,
    })
    .from(invite)
    .innerJoin(contract, eq(invite.contractId, contract.id))
    .innerJoin(participant, eq(invite.participantId, participant.id))
    .innerJoin(userTable, eq(contract.ownerId, userTable.id))
    .where(
      and(
        eq(invite.email, normalizeEmail(email)),
        isNull(invite.acceptedAt),
        gt(invite.expiresAt, new Date()),
        // Someone else already took the slot: accepting would fail with 422.
        isNull(participant.linkedUserId)
      )
    )
    .orderBy(desc(invite.createdAt));
  // The owner may have invited the same slot twice: only the latest copy
  // counts. If it was declined, the slot is gone, even when an older copy is
  // still pending (the decline used to mark just the copy it was called with).
  const seen = new Set<string>();
  const pending = rows.flatMap(({ participantId, declinedAt, ...row }) => {
    if (seen.has(participantId)) {
      return [];
    }
    seen.add(participantId);
    return declinedAt === null ? [row] : [];
  });
  // "4 parcelas de R$ 300,00 · a partir de 10/11" (owner's decision 5). Runs
  // in the invites' branch, beside the contracts' reads: no sequential trip.
  const terms = await loadInviteTerms(pending.map((row) => row.contractId));
  return pending.map((row) => {
    const t = terms.get(row.contractId);
    return {
      ...row,
      installmentsCount: t?.installmentsCount ?? 0,
      totalCents: t?.totalCents ?? 0,
      firstDueDate: t?.firstDueDate ?? null,
      // One amount per installment, or null when they differ (the card shows the total).
      amountCents: t?.amountCents ?? null,
    };
  });
}

async function loadProfile(userId: string) {
  const [row] = await db
    .select({
      pixKey: userTable.pixKey,
      emailRemindersOptIn: userTable.emailRemindersOptIn,
      onboardingDismissedAt: userTable.onboardingDismissedAt,
      createdAt: userTable.createdAt,
    })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  return (
    row ?? {
      pixKey: null,
      emailRemindersOptIn: false,
      onboardingDismissedAt: null,
      createdAt: new Date(),
    }
  );
}

async function loadUnreadCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(notification)
    .where(and(visibleNotificationsWhere(userId), isNull(notification.readAt)));
  return row?.value ?? 0;
}

export const homeModule = new Elysia({ prefix: "/api" }).get(
  "/home",
  async ({ request }) => {
    const { user } = await requireAuth(request.headers);
    const today = todayISO();
    const [rows, invites, profile, unreadCount] = await Promise.all([
      loadContractRows(user.id),
      loadInvites(user.email),
      loadProfile(user.id),
      loadUnreadCount(user.id),
    ]);
    // Accepting would fail with "you already participate": not an action.
    const mine = new Set(rows.contracts.map((c) => c.id));
    const openInvites = invites.filter((i) => !mine.has(i.contractId));
    const parties = partyContracts(user.id, rows);
    return {
      today,
      ...buildAgenda(parties, openInvites, today),
      milestones: buildMilestones(parties, today),
      onboarding: onboardingFacts(
        user.id,
        rows,
        profile,
        emailRemindersEnabled()
      ),
      unreadCount,
      // Sidebar count: every active contract the user takes part in, the
      // followed ones included (parties drops viewers, so count the rows);
      // a paid-off one is not active.
      activeContractsCount: activeContracts(rows).length,
      // "Contratos ativos" in the sidebar: no extra read, the rows are loaded (planner's decision 1).
      activeContracts: sidebarContracts(rows, today),
    };
  },
  { response: homeSchema }
);

import { CONTRACT_STATUS, todayISO } from "@quitto/shared";
import {
  and,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  max,
  or,
} from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db/client";
import {
  contract,
  installment,
  invite,
  notification,
  participant,
  proof,
  user as userTable,
} from "../db/schema";
import { normalizeEmail } from "../lib/email";
import { emailRemindersEnabled } from "../lib/email-reminders";
import { buildAgenda, type HomeInviteRow } from "../lib/home";
import { buildMilestones } from "../lib/home-milestones";
import { onboardingFacts } from "../lib/home-onboarding";
import { type HomeContractRows, partyContracts } from "../lib/home-parties";
import { requireAuth } from "../lib/session";

const EMPTY_ROWS: HomeContractRows = {
  contracts: [],
  installments: [],
  participants: [],
  users: [],
};

/** Contracts the user owns or is linked to, with every row the home needs. 4 sequential round trips at most. */
async function loadContractRows(userId: string): Promise<HomeContractRows> {
  const linked = await db
    .select({ contractId: participant.contractId })
    .from(participant)
    .where(eq(participant.linkedUserId, userId));
  const linkedIds = linked.map((l) => l.contractId);
  const contracts = await db
    .select({
      id: contract.id,
      title: contract.title,
      ownerId: contract.ownerId,
      ownerRole: contract.ownerRole,
      requiresConfirmation: contract.requiresConfirmation,
      status: contract.status,
      pixKey: contract.pixKey,
      installmentsCount: contract.installmentsCount,
      createdAt: contract.createdAt,
    })
    .from(contract)
    .where(
      linkedIds.length > 0
        ? or(eq(contract.ownerId, userId), inArray(contract.id, linkedIds))
        : eq(contract.ownerId, userId)
    );
  if (contracts.length === 0) {
    return EMPTY_ROWS;
  }
  const ids = contracts.map((c) => c.id);
  const [installmentRows, participants, proofs] = await Promise.all([
    db
      .select({
        id: installment.id,
        contractId: installment.contractId,
        sequence: installment.sequence,
        amountCents: installment.amountCents,
        dueDate: installment.dueDate,
        status: installment.status,
        paidAt: installment.paidAt,
      })
      .from(installment)
      .where(inArray(installment.contractId, ids)),
    db
      .select({
        contractId: participant.contractId,
        displayName: participant.displayName,
        role: participant.role,
        linkedUserId: participant.linkedUserId,
      })
      .from(participant)
      .where(inArray(participant.contractId, ids)),
    // Latest proof per installment: when the payer acted in a contract with
    // confirmation ("Tudo em dia" counts it, not the confirmation time).
    db
      .select({ installmentId: proof.installmentId, at: max(proof.createdAt) })
      .from(proof)
      .innerJoin(installment, eq(proof.installmentId, installment.id))
      .where(inArray(installment.contractId, ids))
      .groupBy(proof.installmentId),
  ]);
  const lastProofAt = new Map(proofs.map((p) => [p.installmentId, p.at]));
  const installments = installmentRows.map((row) => ({
    ...row,
    lastProofAt: lastProofAt.get(row.id) ?? null,
  }));
  // Owners (seller-owned receive key + name) and linked sellers (their key).
  const userIds = [
    ...new Set([
      ...contracts.map((c) => c.ownerId),
      ...participants.flatMap((p) =>
        p.role === "seller" && p.linkedUserId ? [p.linkedUserId] : []
      ),
    ]),
  ];
  const users = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      pixKey: userTable.pixKey,
    })
    .from(userTable)
    .where(inArray(userTable.id, userIds));
  return { contracts, installments, participants, users };
}

/** Pending invites for the session e-mail: not accepted, not declined, not expired, slot still open. One per slot. */
async function loadInvites(email: string): Promise<HomeInviteRow[]> {
  const rows = await db
    .select({
      participantId: invite.participantId,
      token: invite.token,
      contractId: invite.contractId,
      createdAt: invite.createdAt,
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
        isNull(invite.declinedAt),
        gt(invite.expiresAt, new Date()),
        // Someone else already took the slot: accepting would fail with 422.
        isNull(participant.linkedUserId)
      )
    )
    .orderBy(desc(invite.createdAt));
  // The owner may have invited the same slot twice: show only the latest.
  const seen = new Set<string>();
  return rows.flatMap(({ participantId, ...row }) => {
    if (seen.has(participantId)) {
      return [];
    }
    seen.add(participantId);
    return [row];
  });
}

async function loadProfile(userId: string) {
  const [row] = await db
    .select({
      pixKey: userTable.pixKey,
      emailRemindersOptIn: userTable.emailRemindersOptIn,
      onboardingDismissedAt: userTable.onboardingDismissedAt,
    })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  return (
    row ?? {
      pixKey: null,
      emailRemindersOptIn: false,
      onboardingDismissedAt: null,
    }
  );
}

async function loadUnreadCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(notification)
    .where(and(eq(notification.userId, userId), isNull(notification.readAt)));
  return row?.value ?? 0;
}

const directionSchema = t.Union([t.Literal("pay"), t.Literal("receive")]);
const nullableString = t.Union([t.String(), t.Null()]);

const upcomingItemSchema = t.Object({
  installmentId: t.String(),
  contractId: t.String(),
  contractTitle: t.String(),
  sequence: t.Integer(),
  installmentsCount: t.Integer(),
  amountCents: t.Integer(),
  dueDate: t.String(),
  direction: directionSchema,
  status: t.String(),
});

const installmentActionSchema = t.Object({
  id: t.String(),
  kind: t.Union([
    t.Literal("overdue"),
    t.Literal("review"),
    t.Literal("disputed"),
    t.Literal("due_soon"),
  ]),
  installmentId: t.String(),
  contractId: t.String(),
  contractTitle: t.String(),
  sequence: t.Integer(),
  installmentsCount: t.Integer(),
  amountCents: t.Integer(),
  dueDate: t.String(),
  direction: directionSchema,
  status: t.String(),
  counterpartyName: nullableString,
  pixCode: nullableString,
  canMarkPaid: t.Boolean(),
  canConfirm: t.Boolean(),
});

const inviteActionSchema = t.Object({
  id: t.String(),
  kind: t.Literal("invite"),
  token: t.String(),
  contractTitle: t.String(),
  role: t.String(),
  inviterName: t.String(),
});

const homeSchema = t.Object({
  today: t.String(),
  actions: t.Array(t.Union([installmentActionSchema, inviteActionSchema])),
  upcoming: t.Object({
    items: t.Array(upcomingItemSchema),
    moreCount: t.Integer(),
    toPayCents: t.Integer(),
    toReceiveCents: t.Integer(),
  }),
  nextDue: t.Union([upcomingItemSchema, t.Null()]),
  milestones: t.Object({
    closestToPayoff: t.Union([
      t.Object({
        contractId: t.String(),
        title: t.String(),
        paidCount: t.Integer(),
        totalCount: t.Integer(),
        percent: t.Integer(),
      }),
      t.Null(),
    ]),
    monthToDate: t.Object({
      month: t.String(),
      paidCents: t.Integer(),
      receivedCents: t.Integer(),
    }),
    previousMonthAllClear: t.Union([
      t.Object({ month: t.String(), paidCount: t.Integer() }),
      t.Null(),
    ]),
    settled: t.Object({
      paidCents: t.Integer(),
      receivedCents: t.Integer(),
    }),
  }),
  onboarding: t.Object({
    hasContract: t.Boolean(),
    hasPixKey: t.Boolean(),
    hasCounterparty: t.Boolean(),
    remindersOn: t.Boolean(),
    remindersAvailable: t.Boolean(),
    counterpartyContractId: nullableString,
    dismissedAt: nullableString,
  }),
  unreadCount: t.Integer(),
  activeContractsCount: t.Integer(),
});

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
      // followed ones included (parties drops viewers, so count the rows).
      activeContractsCount: rows.contracts.filter(
        (c) => c.status === CONTRACT_STATUS.active
      ).length,
    };
  },
  { response: homeSchema }
);

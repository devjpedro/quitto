import { t } from "elysia";

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

const barStatusSchema = t.Union([
  t.Literal("paid"),
  t.Literal("overdue"),
  t.Literal("review"),
  t.Literal("today"),
  t.Literal("open"),
]);

const contractSummarySchema = t.Object({
  paidCount: t.Integer(),
  overdueCount: t.Integer(),
  remainingCents: t.Integer(),
  statuses: t.Union([t.Array(barStatusSchema), t.Null()]),
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
  count: t.Integer(),
  installmentIds: t.Array(t.String()),
  sequences: t.Array(t.Integer()),
  totalCents: t.Integer(),
  contract: contractSummarySchema,
});

const inviteActionSchema = t.Object({
  id: t.String(),
  kind: t.Literal("invite"),
  token: t.String(),
  contractTitle: t.String(),
  role: t.String(),
  inviterName: t.String(),
  installmentsCount: t.Integer(),
  amountCents: t.Union([t.Integer(), t.Null()]),
  totalCents: t.Integer(),
  firstDueDate: nullableString,
});

export const homeSchema = t.Object({
  today: t.String(),
  actions: t.Array(t.Union([installmentActionSchema, inviteActionSchema])),
  overdue: t.Object({
    toPayCents: t.Integer(),
    toReceiveCents: t.Integer(),
  }),
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
        remainingCount: t.Integer(),
        nextDueDate: nullableString,
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
      payableTotalCents: t.Integer(),
      receivableTotalCents: t.Integer(),
    }),
  }),
  onboarding: t.Object({
    accountCreatedOn: t.String(),
    activePartyContracts: t.Integer(),
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
  activeContracts: t.Array(
    t.Object({
      contractId: t.String(),
      title: t.String(),
      paidCount: t.Integer(),
      totalCount: t.Integer(),
      hasOverdue: t.Boolean(),
    })
  ),
});

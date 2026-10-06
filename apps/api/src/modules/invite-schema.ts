import { t } from "elysia";

// Explicit literal unions: mapping over an array widens to TSchema[] and
// breaks Eden's inference (same note as participants.ts).
const status = t.Union([
  t.Literal("pending"),
  t.Literal("accepted"),
  t.Literal("declined"),
  t.Literal("expired"),
]);

const viewer = t.Union([
  t.Literal("invitee"),
  t.Literal("owner"),
  t.Literal("otherAccount"),
  t.Literal("alreadyParticipant"),
]);

const nullableInt = t.Union([t.Integer(), t.Null()]);
const nullableString = t.Union([t.String(), t.Null()]);

export const inviteViewSchema = t.Object({
  status,
  viewer,
  contractId: t.String(),
  participantId: t.String(),
  inviterName: t.String(),
  contract: t.Object({
    title: t.String(),
    description: nullableString,
    createdAt: t.String(),
  }),
  role: t.String(),
  requiresConfirmation: t.Boolean(),
  terms: t.Object({
    amountCents: nullableInt,
    dayOfMonth: nullableInt,
    firstDueDate: nullableString,
    installmentsCount: t.Integer(),
    lastDueDate: nullableString,
    maxCents: nullableInt,
    minCents: nullableInt,
    totalCents: t.Integer(),
  }),
  schedulePreview: t.Array(
    t.Object({
      sequence: t.Integer(),
      dueDate: t.String(),
      amountCents: t.Integer(),
    })
  ),
  sentAt: t.String(),
  expiresAt: t.String(),
  acceptedAt: nullableString,
  declinedAt: nullableString,
  email: nullableString,
  emailMasked: t.String(),
  inviteeName: nullableString,
});

export const publicInvitePreviewSchema = t.Object({
  status,
  inviterName: t.String(),
  contractTitle: t.String(),
  role: t.String(),
  // Only while pending (planner's decision 13).
  terms: t.Union([
    t.Object({
      installmentsCount: t.Integer(),
      amountCents: nullableInt,
      totalCents: t.Integer(),
      firstDueDate: nullableString,
    }),
    t.Null(),
  ]),
  emailMasked: t.String(),
  expiresAt: t.String(),
});

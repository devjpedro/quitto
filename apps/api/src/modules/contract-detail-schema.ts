import { t } from "elysia";

/** The response shapes of the contract detail module (kept apart so the handlers stay readable). */
const eventSchema = t.Object({
  id: t.String(),
  type: t.String(),
  installmentId: t.Union([t.String(), t.Null()]),
  installmentSequence: t.Union([t.Integer(), t.Null()]),
  actorName: t.Union([t.String(), t.Null()]),
  isMe: t.Boolean(),
  metadata: t.Union([t.Record(t.String(), t.Unknown()), t.Null()]),
  createdAt: t.String(),
});

const pixSchema = t.Union([
  t.Object({
    key: t.String(),
    keyType: t.String(),
    source: t.Union([t.Literal("account"), t.Literal("contact")]),
  }),
  t.Null(),
]);

const inviteSchema = t.Union([
  t.Object({
    status: t.Union([
      t.Literal("pending"),
      t.Literal("expired"),
      t.Literal("declined"),
    ]),
    sentAt: t.String(),
    url: t.Union([t.String(), t.Null()]),
  }),
  t.Null(),
]);

export const contractDetailResponse = t.Object({
  role: t.String(),
  isOwner: t.Boolean(),
  isPayer: t.Boolean(),
  isApprover: t.Boolean(),
  contract: t.Object({
    id: t.String(),
    title: t.String(),
    description: t.Union([t.String(), t.Null()]),
    ownerRole: t.String(),
    requiresConfirmation: t.Boolean(),
    status: t.String(),
    monthlyAmountCents: t.Union([t.Integer(), t.Null()]),
    pixKey: t.Union([t.String(), t.Null()]),
    recebedor: t.Union([
      t.Object({
        name: t.Union([t.String(), t.Null()]),
        hasKey: t.Boolean(),
      }),
      t.Null(),
    ]),
    createdAt: t.String(),
    ownerName: t.Union([t.String(), t.Null()]),
  }),
  receiver: t.Object({
    name: t.Union([t.String(), t.Null()]),
    hasAccount: t.Boolean(),
    contactParticipantId: t.Union([t.String(), t.Null()]),
    pix: pixSchema,
  }),
  progress: t.Object({
    totalCents: t.Integer(),
    paidCents: t.Integer(),
    remainingCents: t.Integer(),
    percent: t.Integer(),
    overdueCount: t.Integer(),
  }),
  installments: t.Array(
    t.Object({
      id: t.String(),
      sequence: t.Integer(),
      amountCents: t.Integer(),
      dueDate: t.String(),
      status: t.String(),
      paidAt: t.Union([t.String(), t.Null()]),
    })
  ),
  participants: t.Array(
    t.Object({
      id: t.String(),
      displayName: t.String(),
      role: t.String(),
      linked: t.Boolean(),
      isOwner: t.Boolean(),
      isMe: t.Boolean(),
      email: t.Union([t.String(), t.Null()]),
      invite: inviteSchema,
      joinedAt: t.Union([t.String(), t.Null()]),
    })
  ),
  recentEvents: t.Array(eventSchema),
});

export const eventsPageResponse = t.Object({
  items: t.Array(eventSchema),
  nextBefore: t.Union([t.String(), t.Null()]),
});

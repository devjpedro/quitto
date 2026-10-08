import { t } from "elysia";
import {
  barStatusSchema,
  directionSchema,
  nullableString,
} from "./home-schema";

export const contractListItemSchema = t.Object({
  // kept (⌘K and the old list; the old ones leave in phase 6)
  id: t.String(),
  title: t.String(),
  description: nullableString,
  participantNames: t.Array(t.String()),
  ownerRole: t.String(),
  status: t.String(),
  totalCents: t.Integer(),
  paidCents: t.Integer(),
  percent: t.Integer(),
  overdueCount: t.Integer(),
  installmentsCount: t.Integer(),
  nextDueDate: nullableString,
  // new (phase 4)
  createdAt: t.String(),
  direction: t.Union([directionSchema, t.Null()]),
  counterpartyName: nullableString,
  paidCount: t.Integer(),
  remainingCents: t.Integer(),
  statuses: t.Union([t.Array(barStatusSchema), t.Null()]),
  reviewCount: t.Integer(),
  disputedCount: t.Integer(),
  installmentAmountCents: t.Union([t.Integer(), t.Null()]),
  monthly: t.Boolean(),
  next: t.Union([
    t.Object({
      sequence: t.Integer(),
      dueDate: t.String(),
      amountCents: t.Integer(),
      status: t.String(),
    }),
    t.Null(),
  ]),
  oldestOverdue: t.Union([
    t.Object({ sequence: t.Integer(), dueDate: t.String() }),
    t.Null(),
  ]),
  endDate: nullableString,
  settled: t.Boolean(),
});

const installmentListItemSchema = t.Object({
  installmentId: t.String(),
  contractId: t.String(),
  contractTitle: t.String(),
  sequence: t.Integer(),
  installmentsCount: t.Integer(),
  amountCents: t.Integer(),
  dueDate: t.String(),
  status: t.String(),
  direction: directionSchema,
  counterpartyName: nullableString,
  paidAt: nullableString,
});

export const installmentListSchema = t.Object({
  today: t.String(),
  hasContracts: t.Boolean(),
  items: t.Array(installmentListItemSchema),
});

const personContractSchema = t.Object({
  contractId: t.String(),
  title: t.String(),
  direction: directionSchema,
  installmentsCount: t.Integer(),
  paidCount: t.Integer(),
  remainingCents: t.Integer(),
  overdueCount: t.Integer(),
  reviewCount: t.Integer(),
  nextDueDate: nullableString,
  settled: t.Boolean(),
});

export const peopleSchema = t.Object({
  people: t.Array(
    t.Object({
      key: t.String(),
      name: t.String(),
      account: t.Union([
        t.Literal("linked"),
        t.Literal("invited"),
        t.Literal("none"),
      ]),
      email: nullableString,
      owesYouCents: t.Integer(),
      youOweCents: t.Integer(),
      overdueCount: t.Integer(),
      reviewCount: t.Integer(),
      lastContractAt: t.String(),
      contracts: t.Array(personContractSchema),
    })
  ),
});

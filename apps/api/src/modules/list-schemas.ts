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

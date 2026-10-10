import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  pixKey: text("pix_key"),
  emailRemindersOptIn: boolean("email_reminders_opt_in")
    .notNull()
    .default(false),
  // null = the user never chose a language; the browser decides until they do.
  locale: text("locale"),
  // Set when the user dismisses the "Comece por aqui" checklist on the home.
  onboardingDismissedAt: timestamp("onboarding_dismissed_at"),
  // Set when the user finishes or skips the guided tour (first access); null = it shows once. "Refazer" in Ajustes clears it.
  tourCompletedAt: timestamp("tour_completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const ownerRoleEnum = pgEnum("owner_role", [
  "buyer",
  "seller",
  "neutral",
]);
export const contractStatusEnum = pgEnum("contract_status", [
  "active",
  "completed",
  "cancelled",
]);
export const installmentStatusEnum = pgEnum("installment_status", [
  "pending",
  "awaiting_confirmation",
  "confirmed",
  "disputed",
  "paid",
]);
export const participantRoleEnum = pgEnum("participant_role", [
  "owner",
  "buyer",
  "seller",
  "viewer",
]);

export const contract = pgTable(
  "contract",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    ownerRole: ownerRoleEnum("owner_role").notNull(),
    totalAmountCents: integer("total_amount_cents").notNull(),
    installmentsCount: integer("installments_count").notNull(),
    monthlyAmountCents: integer("monthly_amount_cents"),
    pixKey: text("pix_key"),
    requiresConfirmation: boolean("requires_confirmation")
      .notNull()
      .default(false),
    status: contractStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("contract_owner_id_idx").on(table.ownerId)]
);

export const installment = pgTable(
  "installment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contract.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    amountCents: integer("amount_cents").notNull(),
    dueDate: date("due_date").notNull(),
    status: installmentStatusEnum("status").notNull().default("pending"),
    paidAt: timestamp("paid_at"),
    confirmedAt: timestamp("confirmed_at"),
    // Already paid when the contract was created: no proof, approval or reminder.
    registeredOnCreate: boolean("registered_on_create")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("installment_contract_id_idx").on(table.contractId)]
);

export const participant = pgTable(
  "participant",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contract.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    role: participantRoleEnum("role").notNull(),
    linkedUserId: text("linked_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    // The receiver's Pix key kept on a contact without an account (owner's
    // decision, 2026-10-05). Once the contact has an account, the account's
    // key counts and this one stays stored, unused.
    pixKey: text("pix_key"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("participant_contract_id_idx").on(table.contractId),
    index("participant_linked_user_id_idx").on(table.linkedUserId),
  ]
);

export const proof = pgTable(
  "proof",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    installmentId: uuid("installment_id")
      .notNull()
      .references(() => installment.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedBy: text("uploaded_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("proof_installment_id_idx").on(table.installmentId)]
);

export const auditEvent = pgTable(
  "audit_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contract.id, { onDelete: "cascade" }),
    installmentId: uuid("installment_id").references(() => installment.id, {
      onDelete: "cascade",
    }),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("audit_event_installment_id_idx").on(table.installmentId),
    index("audit_event_contract_id_idx").on(table.contractId),
  ]
);

export const invite = pgTable(
  "invite",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contract.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participant.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedByUserId: text("accepted_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    acceptedAt: timestamp("accepted_at"),
    declinedAt: timestamp("declined_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("invite_token_idx").on(table.token),
    index("invite_email_idx").on(table.email),
  ]
);

export const notification = pgTable(
  "notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contract.id, { onDelete: "cascade" }),
    installmentId: uuid("installment_id").references(() => installment.id, {
      onDelete: "cascade",
    }),
    metadata: jsonb("metadata"),
    dedupeKey: text("dedupe_key"),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("notification_user_id_created_at_idx").on(
      table.userId,
      table.createdAt
    ),
    unique("notification_dedupe_key_key").on(table.dedupeKey),
  ]
);

/**
 * Link público de UM recibo (ADR-0006). Um ativo por parcela (índice parcial);
 * revogar = `revokedAt`. Sem expiração no v1.
 */
export const receiptShare = pgTable(
  "receipt_share",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    installmentId: uuid("installment_id")
      .notNull()
      .references(() => installment.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    revokedAt: timestamp("revoked_at"),
  },
  (table) => [
    uniqueIndex("receipt_share_active_installment_uq")
      .on(table.installmentId)
      .where(sql`${table.revokedAt} is null`),
  ]
);

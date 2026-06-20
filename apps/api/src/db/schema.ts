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
  uuid,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
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

export const contract = pgTable("contract", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  ownerRole: ownerRoleEnum("owner_role").notNull(),
  totalAmountCents: integer("total_amount_cents").notNull(),
  installmentsCount: integer("installments_count").notNull(),
  requiresConfirmation: boolean("requires_confirmation")
    .notNull()
    .default(false),
  status: contractStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

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
  (table) => [index("invite_token_idx").on(table.token)]
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

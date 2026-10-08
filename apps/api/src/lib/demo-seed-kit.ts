import { createHash } from "node:crypto";
import { generateMonthlySchedule, NOTIFICATION_TYPE } from "@quitto/shared";
import { addDays } from "./dates";

export const DEMO_DOMAIN = "demo.quitto.dev";
export const DEMO_PASSWORD = "quitto123";

export type DemoAccountKey =
  | "agora"
  | "atraso"
  | "novo"
  | "tres"
  | "bia"
  | "rafa"
  | "silvia";

export interface DemoAccount {
  createdDaysAgo: number;
  email: string;
  key: DemoAccountKey;
  name: string;
  pixKey: string | null;
}

export interface DemoInstallment {
  amountCents: number;
  /** ISO instant of the confirmation, in a contract that asks for one. */
  confirmedAt: string | null;
  dueDate: string;
  /** ISO instant: paid on the due date, at noon in São Paulo. */
  paidAt: string | null;
  sequence: number;
  status: "pending" | "paid" | "confirmed" | "awaiting_confirmation";
}

/** A proof file the seed uploads (a PDF that reads like a Pix receipt). */
export interface DemoProof {
  /** ISO instant of the upload. */
  at: string;
  fileName: string;
  /** ISO instant the PDF prints as the payment's date, when it is not the upload's (a receipt that belongs to another installment). */
  paidAt?: string;
  sequence: number;
}

/** An audit row, written as the product writes it (lib/audit.ts). */
export interface DemoEvent {
  /** Who acted: the owner, the linked counterpart, or nobody (an account that is gone). */
  actor: "owner" | "counterpart" | null;
  at: string;
  metadata: Record<string, unknown> | null;
  sequence: number | null;
  type: string;
}

/** Someone invited to watch, still pending (the "Convite pendente" row). */
export interface DemoViewer {
  displayName: string;
  invite: DemoAccountKey;
  invitedAt: string;
}

export interface DemoContract {
  counterpart: {
    /** The counterpart's demo account when they have one (linked, invite accepted at `joinedAt`). */
    account: DemoAccountKey | null;
    displayName: string;
    joinedAt: string | null;
    /** The receiver's key kept on the contact (owner's decision, 2026-10-05). */
    pixKey: string | null;
    role: "buyer" | "seller";
  };
  /** Exact ISO instant of the creation, for the history; null uses createdDaysAgo. */
  createdAt: string | null;
  createdDaysAgo: number;
  events: DemoEvent[];
  installments: DemoInstallment[];
  /** The counterpart's slot is invited by e-mail to this account (left pending). */
  invite: DemoAccountKey | null;
  /** Same, to an e-mail that has no account (the invite stays pending; "Convite pendente" in Pessoas). Wins over `invite`. */
  inviteEmail?: string;
  /** How the pending `invite` ended; omitted, it is pending (the invite page's states, phase 3). Accepted is `counterpart.account`/`joinedAt`. */
  inviteState?: "declined" | "expired";
  key: string;
  owner: DemoAccountKey;
  ownerRole: "buyer" | "seller";
  proofs: DemoProof[];
  receiptShares: { at: string; sequence: number }[];
  requiresConfirmation: boolean;
  title: string;
  viewers: DemoViewer[];
}

export interface DemoNotification {
  account: DemoAccountKey;
  /** ISO instant. */
  at: string;
  contract: string;
  metadata: Record<string, unknown> | null;
  read: boolean;
  sequence: number | null;
  type: string;
}

export interface DemoScenario {
  accounts: DemoAccount[];
  contracts: DemoContract[];
  notifications: DemoNotification[];
}

/**
 * `iso` moved by whole months, back or forth, the day clamped to the month's
 * end. The shared addMonths is only right for positive months (its % goes
 * negative across a year): planner's decision 19.
 */
export function shiftMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = index - year * 12 + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

export interface MonthlySpec {
  amountCents: number;
  /** A contract with confirmation: its paid installments are "confirmed", as the product makes them. */
  confirmed?: boolean;
  firstDueDate: string;
  months: number;
  paid: number;
  /** The installment whose proof waits for the receiver. */
  review?: number;
  /** The installment that falls due today (pinned, whatever the month lengths). */
  today?: { sequence: number; todayISO: string };
}

function statusOf(
  sequence: number,
  spec: MonthlySpec
): DemoInstallment["status"] {
  if (sequence <= spec.paid) {
    return spec.confirmed ? "confirmed" : "paid";
  }
  return sequence === spec.review ? "awaiting_confirmation" : "pending";
}

export function monthly(spec: MonthlySpec): DemoInstallment[] {
  return generateMonthlySchedule({
    monthlyAmountCents: spec.amountCents,
    months: spec.months,
    firstDueDate: spec.firstDueDate,
  }).map((row) => {
    const status = statusOf(row.sequence, spec);
    const dueDate =
      row.sequence === spec.today?.sequence ? spec.today.todayISO : row.dueDate;
    const paid = status === "paid" || status === "confirmed";
    return {
      sequence: row.sequence,
      amountCents: row.amountCents,
      dueDate,
      status,
      paidAt: paid ? `${dueDate}T15:00:00.000Z` : null,
      confirmedAt: status === "confirmed" ? `${dueDate}T15:00:00.000Z` : null,
    };
  });
}

/** An instant `days` from today at `hhmm` UTC (São Paulo is UTC-3). */
export function at(todayISO: string, days: number, hhmm: string): string {
  return `${addDays(todayISO, days)}T${hhmm}:00.000Z`;
}

export function account(
  key: DemoAccountKey,
  name: string,
  createdDaysAgo: number,
  pixKey: string | null
): DemoAccount {
  return { key, name, email: `${key}@${DEMO_DOMAIN}`, createdDaysAgo, pixKey };
}

/** A contract's fixed part: the owner holds one slot, an unlinked counterpart the other. */
export function base(
  key: string,
  owner: DemoAccountKey,
  title: string,
  ownerRole: "buyer" | "seller",
  counterpart: string
): Omit<DemoContract, "installments" | "createdDaysAgo"> {
  return {
    key,
    owner,
    title,
    ownerRole,
    requiresConfirmation: false,
    counterpart: {
      account: null,
      displayName: counterpart,
      joinedAt: null,
      pixKey: null,
      role: ownerRole === "buyer" ? "seller" : "buyer",
    },
    createdAt: null,
    events: [],
    invite: null,
    proofs: [],
    receiptShares: [],
    viewers: [],
  };
}

/**
 * The demo invite link of a contract's other-party slot, the same on every
 * seed so the screenshots open each state (planner's decision 16). Local
 * only: the seed refuses to run anywhere else. e2e/scripts/capture.ts
 * computes the same hash.
 */
export function demoInviteToken(contractKey: string): string {
  return createHash("sha256")
    .update(`quitto-demo-invite:${contractKey}`)
    .digest("hex");
}

const REMINDER_TYPES: ReadonlySet<string> = new Set([
  NOTIFICATION_TYPE.installmentDueSoon,
  NOTIFICATION_TYPE.installmentOverdue,
  NOTIFICATION_TYPE.installmentDueSoonReceivable,
  NOTIFICATION_TYPE.installmentOverdueReceivable,
]);

/**
 * The dedupe key the reminder sweep writes (lib/reminders.ts), so a
 * `cron:reminders` after the seed skips the reminders already there instead
 * of writing them twice. Event notices (a proof, a confirmation) have none.
 */
export function reminderDedupeKey(
  type: string,
  installmentId: string | null,
  userId: string
): string | null {
  return REMINDER_TYPES.has(type) && installmentId
    ? `reminder:${type}:${installmentId}:${userId}`
    : null;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * The demo seed wipes and rewrites the demo accounts, uploads proof files
 * and signs people up: never in production, never against a remote database
 * or bucket (the compose service name "postgres" can be a remote one on a
 * docker network), and never with a real e-mail key (sign-up sends a
 * verification e-mail, and a Resend error would stop the seed half-way).
 * The host check can't see a tunnel: a remote database forwarded to
 * localhost (e.g. `fly proxy 5432`) passes it, so never point the local
 * DATABASE_URL at a remote database.
 */
export function assertDemoEnvironment(env: {
  DATABASE_URL: string;
  NODE_ENV: string;
  RESEND_API_KEY?: string | undefined;
  S3_ENDPOINT?: string | undefined;
}): void {
  if (env.NODE_ENV === "production") {
    throw new Error("seed:demo não roda em produção (NODE_ENV=production)");
  }
  const dbHost = new URL(env.DATABASE_URL).hostname;
  if (!LOCAL_HOSTS.has(dbHost)) {
    throw new Error(
      `seed:demo só roda em banco local; o DATABASE_URL aponta para ${dbHost}`
    );
  }
  const s3Host = env.S3_ENDPOINT ? new URL(env.S3_ENDPOINT).hostname : null;
  if (s3Host === null || !LOCAL_HOSTS.has(s3Host)) {
    throw new Error(
      `seed:demo precisa do MinIO local; o S3_ENDPOINT é ${s3Host ?? "vazio"}`
    );
  }
  if (env.RESEND_API_KEY) {
    throw new Error(
      "seed:demo não roda com RESEND_API_KEY: o cadastro mandaria e-mail de verdade. Rode: RESEND_API_KEY= bun run seed:demo"
    );
  }
}

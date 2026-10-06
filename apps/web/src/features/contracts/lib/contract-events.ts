import { APP_TIME_ZONE, isoDateInTimeZone, type Locale } from "@quitto/shared";
import type { IconTileTone } from "@/components/ui/icon-tile";
import { formatFileSize } from "@/features/installments/lib/file-size";
import { capitalize } from "@/lib/format";
import { daysBetween, formatDate } from "@/lib/locale-format";
import { sequencesText } from "@/lib/sequences-label";
import { m } from "@/paraglide/messages.js";
import type { ContractEvent } from "../types";

export type EventIcon =
  | "upload"
  | "seal"
  | "x"
  | "hand"
  | "share"
  | "join"
  | "leave"
  | "created"
  | "link";

export interface EventLine {
  actor: string | null;
  count: number;
  icon: EventIcon;
  key: string;
  meta: string | null;
  text: string;
  time: string;
  tone: IconTileTone;
  when: string;
}

export interface EventDay {
  key: string;
  label: string;
  rows: EventLine[];
}

/** Runs of these, same actor and day, become one line with the count (DIRECAO › Histórico). */
const GROUPABLE: ReadonlySet<string> = new Set([
  "receipt_share_created",
  "installment_received",
]);

const timeFormatters = new Map<Locale, Intl.DateTimeFormat>();
function timeOf(iso: string, locale: Locale): string {
  let formatter = timeFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: APP_TIME_ZONE,
    });
    timeFormatters.set(locale, formatter);
  }
  return formatter.format(new Date(iso));
}

const dayOf = (iso: string) => isoDateInTimeZone(new Date(iso), APP_TIME_ZONE);

function dayLabel(dayIso: string, today: string, locale: Locale): string {
  const options = { locale };
  // A day of another year says the year (it would read as a month ahead otherwise).
  const long = formatDate(
    dayIso,
    locale,
    dayIso.slice(0, 4) === today.slice(0, 4) ? "long" : "longYear"
  );
  const ago = daysBetween(dayIso, today);
  if (ago === 0) {
    return m.history_today({ date: long }, options);
  }
  if (ago === 1) {
    return m.history_yesterday({ date: long }, options);
  }
  return capitalize(long);
}

function whenOf(dayIso: string, today: string, locale: Locale): string {
  const options = { locale };
  const ago = daysBetween(dayIso, today);
  if (ago === 0) {
    return m.history_when_today({}, options);
  }
  if (ago === 1) {
    return m.history_when_yesterday({}, options);
  }
  return formatDate(
    dayIso,
    locale,
    dayIso.slice(0, 4) === today.slice(0, 4) ? "dayMonth" : "short"
  );
}

interface Copy {
  icon: EventIcon;
  meta: string | null;
  mine: string;
  theirs: string;
  tone: IconTileTone;
}

function roleWord(role: unknown, locale: Locale): string {
  if (role === "buyer") {
    return m.history_role_buyer({}, { locale });
  }
  return role === "seller"
    ? m.history_role_seller({}, { locale })
    : m.history_role_viewer({}, { locale });
}

function copyOf(
  e: ContractEvent,
  run: ContractEvent[],
  resent: boolean,
  locale: Locale
): Copy | null {
  const options = { locale };
  const sequence = e.installmentSequence ?? 0;
  const md = (e.metadata ?? {}) as {
    fileName?: unknown;
    participantName?: unknown;
    reason?: unknown;
    role?: unknown;
    sizeBytes?: unknown;
  };
  const sequences = run
    .map((r) => r.installmentSequence)
    .filter((s): s is number => s !== null);
  const list = sequencesText(sequences, locale);
  const runMeta =
    run.length > 1 && list.kind === "list"
      ? m.history_sequences({ list: list.text }, options)
      : null;
  switch (e.type) {
    case "proof_submitted": {
      const file = typeof md.fileName === "string" ? md.fileName : null;
      const size =
        typeof md.sizeBytes === "number"
          ? formatFileSize(md.sizeBytes, locale)
          : null;
      const meta =
        file && size
          ? m.contract_join({ left: file, right: size }, options)
          : file;
      return resent
        ? {
            icon: "upload",
            tone: "warning",
            meta,
            mine: m.history_you_proof_again({ sequence }, options),
            theirs: m.history_proof_again({ sequence }, options),
          }
        : {
            icon: "upload",
            tone: "warning",
            meta,
            mine: m.history_you_proof({ sequence }, options),
            theirs: m.history_proof({ sequence }, options),
          };
    }
    case "payment_confirmed":
      return {
        icon: "seal",
        tone: "brand",
        meta: null,
        mine: m.history_you_confirmed({ sequence }, options),
        theirs: m.history_confirmed({ sequence }, options),
      };
    case "payment_disputed":
      return {
        icon: "x",
        tone: "danger",
        meta:
          typeof md.reason === "string"
            ? m.history_reason({ reason: md.reason }, options)
            : null,
        mine: m.history_you_disputed({ sequence }, options),
        theirs: m.history_disputed({ sequence }, options),
      };
    case "installment_paid":
      return {
        icon: "hand",
        tone: "brand",
        meta: null,
        mine: m.history_you_paid({ sequence }, options),
        theirs: m.history_paid({ sequence }, options),
      };
    case "installment_received":
      return run.length > 1
        ? {
            icon: "hand",
            tone: "brand",
            meta: runMeta,
            mine: m.history_you_received_many({ count: run.length }, options),
            theirs: m.history_received_many({ count: run.length }, options),
          }
        : {
            icon: "hand",
            tone: "brand",
            meta: null,
            mine: m.history_you_received({ sequence }, options),
            theirs: m.history_received({ sequence }, options),
          };
    case "receipt_share_created":
      return run.length > 1
        ? {
            icon: "share",
            tone: "neutral",
            meta: runMeta,
            mine: m.history_you_shared_many({ count: run.length }, options),
            theirs: m.history_shared_many({ count: run.length }, options),
          }
        : {
            icon: "share",
            tone: "neutral",
            meta: null,
            mine: m.history_you_shared({ sequence }, options),
            theirs: m.history_shared({ sequence }, options),
          };
    case "receipt_share_revoked":
      return {
        icon: "link",
        tone: "neutral",
        meta: null,
        mine: m.history_you_revoked({ sequence }, options),
        theirs: m.history_revoked({ sequence }, options),
      };
    case "participant_joined":
      return {
        icon: "join",
        tone: "brand",
        meta: roleWord(md.role, locale),
        mine: m.history_you_joined({}, options),
        theirs: m.history_joined({}, options),
      };
    case "participant_left":
      return {
        icon: "leave",
        tone: "neutral",
        meta: null,
        mine: m.history_you_left({}, options),
        theirs: m.history_left({}, options),
      };
    case "contract_created":
      return {
        icon: "created",
        tone: "neutral",
        meta: null,
        mine: m.history_you_created({}, options),
        theirs: m.history_created({}, options),
      };
    default:
      return null;
  }
}

const sameRun = (a: ContractEvent, b: ContractEvent) =>
  GROUPABLE.has(a.type) &&
  a.type === b.type &&
  a.isMe === b.isMe &&
  a.actorName === b.actorName &&
  dayOf(a.createdAt) === dayOf(b.createdAt);

/** The ids of proofs sent after a dispute of the same installment (they read as sent again). */
function resentProofs(events: ContractEvent[]): Set<string> {
  const resent = new Set<string>();
  const disputed = new Set<string>();
  for (const e of [...events].reverse()) {
    if (e.type === "payment_disputed" && e.installmentId) {
      disputed.add(e.installmentId);
    }
    if (
      e.type === "proof_submitted" &&
      e.installmentId &&
      disputed.has(e.installmentId)
    ) {
      resent.add(e.id);
    }
  }
  return resent;
}

/**
 * The history (mockup 14, F2): newest first, one block per day, the repeated
 * ones in a row as one line (planner's decision 27). A proof sent after a
 * dispute of the same installment reads as sent again. Unknown types are left
 * out. `when` is the short form the side column's "Atividade recente" shows.
 */
export function groupEvents(
  events: ContractEvent[],
  ctx: { locale: Locale; today: string }
): EventDay[] {
  const resent = resentProofs(events);
  const days: EventDay[] = [];
  let i = 0;
  while (i < events.length) {
    const first = events[i] as ContractEvent;
    let j = i + 1;
    while (j < events.length && sameRun(first, events[j] as ContractEvent)) {
      j += 1;
    }
    const run = events.slice(i, j).reverse();
    i = j;
    const copy = copyOf(first, run, resent.has(first.id), ctx.locale);
    if (!copy) {
      continue;
    }
    const dayIso = dayOf(first.createdAt);
    const actorName =
      first.actorName ??
      (typeof first.metadata?.participantName === "string"
        ? first.metadata.participantName
        : null);
    const line: EventLine = {
      key: first.id,
      count: run.length,
      tone: copy.tone,
      icon: copy.icon,
      actor: first.isMe ? null : actorName,
      text: first.isMe ? copy.mine : copy.theirs,
      meta: copy.meta,
      time: timeOf(first.createdAt, ctx.locale),
      when: whenOf(dayIso, ctx.today, ctx.locale),
    };
    const current = days.at(-1);
    if (current?.key === dayIso) {
      current.rows.push(line);
    } else {
      days.push({
        key: dayIso,
        label: dayLabel(dayIso, ctx.today, ctx.locale),
        rows: [line],
      });
    }
  }
  return days;
}

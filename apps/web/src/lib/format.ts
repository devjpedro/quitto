const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Formats integer cents as Brazilian currency (e.g. 200000 -> "R$ 2.000,00"). */
export function formatBRL(cents: number): string {
  return BRL.format(cents / 100).replace(/[\u00a0\u202f]/g, " ");
}

/** Parses a BR currency string (with or without "R$") into integer cents, or null if invalid. */
export function parseBRLToCents(input: string): number | null {
  const cleaned = input.replace(/[R$\s.]/g, "").replace(",", ".");
  if (cleaned === "" || Number.isNaN(Number(cleaned))) {
    return null;
  }
  return Math.round(Number(cleaned) * 100);
}

/** Formats an ISO date (YYYY-MM-DD) as DD/MM/YYYY, splitting the string (no timezone drift). */
export function formatISODateBR(iso: string): string {
  const parts = iso.split("-");
  const y = parts[0] ?? "";
  const m = parts[1] ?? "";
  const d = parts[2] ?? "";
  return `${d}/${m}/${y}`;
}

const BR_DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const NON_DIGITS_RE = /\D/g;

/** Parses a BR date (dd/mm/yyyy) into ISO (yyyy-mm-dd), or null if invalid/impossible. */
export function parseBRDateToISO(br: string): string | null {
  const m = br.match(BR_DATE_RE);
  if (!m) {
    return null;
  }
  const [, d, mo, y] = m;
  const dt = new Date(`${y}-${mo}-${d}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) {
    return null;
  }
  if (dt.getUTCDate() !== Number(d) || dt.getUTCMonth() + 1 !== Number(mo)) {
    return null; // rejects 31/02 etc.
  }
  return `${y}-${mo}-${d}`;
}

/** Today's date as ISO (YYYY-MM-DD), UTC. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Formats a Date as ISO (YYYY-MM-DD) using its LOCAL components, so the day
 * never shifts by ±1 the way `toISOString()` (UTC) can.
 */
export function dateToISO(d: Date): string {
  const y = String(d.getFullYear()).padStart(4, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Parses an ISO date (YYYY-MM-DD) into a LOCAL Date (midnight local time), or
 * undefined if malformed. Avoids `new Date(iso)` which parses as UTC and can
 * shift the day.
 */
export function parseISOToLocalDate(iso: string): Date | undefined {
  const m = iso.match(ISO_DATE_RE);
  if (!m) {
    return;
  }
  const [, y, mo, d] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d));
  if (dt.getMonth() !== Number(mo) - 1 || dt.getDate() !== Number(d)) {
    return; // rejects rolled-over dates like 2026-02-30 → Mar 2
  }
  return Number.isNaN(dt.getTime()) ? undefined : dt;
}

/** Uppercases the first character of a label for display (e.g. "comprador" -> "Comprador"). */
export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Inserts the BR date mask (dd/mm/yyyy) into raw typed digits. */
export function maskBRDate(value: string): string {
  const d = value.replace(NON_DIGITS_RE, "").slice(0, 8);
  const parts = [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean);
  return parts.join("/");
}

const RTF = new Intl.RelativeTimeFormat("pt-BR", { numeric: "always" });
const REL_THRESHOLDS: {
  limit: number;
  div: number;
  unit: Intl.RelativeTimeFormatUnit;
}[] = [
  { limit: 60, div: 1, unit: "second" },
  { limit: 3600, div: 60, unit: "minute" },
  { limit: 86_400, div: 3600, unit: "hour" },
  { limit: 2_592_000, div: 86_400, unit: "day" },
  { limit: 31_536_000, div: 2_592_000, unit: "month" },
  { limit: Number.POSITIVE_INFINITY, div: 31_536_000, unit: "year" },
];

/** Relative time in pt-BR ("há 2 dias"). `now` is injectable for tests. */
export function formatRelativeTimeBR(
  iso: string,
  now: Date = new Date()
): string {
  const diffSec = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  const t = REL_THRESHOLDS.find((x) => abs < x.limit) ?? REL_THRESHOLDS.at(-1);
  if (!t) {
    return "";
  }
  return RTF.format(Math.round(diffSec / t.div), t.unit);
}

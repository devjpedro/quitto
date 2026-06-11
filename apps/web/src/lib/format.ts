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

/** Inserts the BR date mask (dd/mm/yyyy) into raw typed digits. */
export function maskBRDate(value: string): string {
  const d = value.replace(NON_DIGITS_RE, "").slice(0, 8);
  const parts = [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean);
  return parts.join("/");
}

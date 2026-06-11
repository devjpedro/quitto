const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Formats integer cents as Brazilian currency (e.g. 200000 -> "R$ 2.000,00"). */
export function formatBRL(cents: number): string {
  return BRL.format(cents / 100).replace(/ /g, " ");
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

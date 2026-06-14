const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Formats integer cents as Brazilian currency ("R$ 1.234,56"). */
export function formatCentsBRL(cents: number): string {
  // Replace non-breaking space (U+00A0) and narrow no-break space (U+202F) with a regular space
  return BRL.format(cents / 100).replace(/[\u00a0\u202f]/g, " ");
}

/** Splits a total (in cents) into `count` parts; the remainder cents go to the first parts. */
export function splitAmount(totalCents: number, count: number): number[] {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error("count must be a positive integer");
  }
  const base = Math.floor(totalCents / count);
  let remainder = totalCents - base * count;
  return Array.from({ length: count }, () => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return base + extra;
  });
}

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Formats integer cents as Brazilian currency ("R$ 1.234,56"). */
export function formatCentsBRL(cents: number): string {
  // Replace non-breaking space (U+00A0) and narrow no-break space (U+202F) with a regular space
  return BRL.format(cents / 100).replace(/[\u00a0\u202f]/g, " ");
}

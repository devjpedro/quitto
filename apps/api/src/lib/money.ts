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

/** The installments before and after this one, by sequence: what ↑ and ↓ open. */
export function neighborsOf(
  installments: { id: string; sequence: number }[],
  id: string
): { next: string | null; prev: string | null } {
  const sorted = [...installments].sort((a, b) => a.sequence - b.sequence);
  const at = sorted.findIndex((it) => it.id === id);
  if (at === -1) {
    return { prev: null, next: null };
  }
  return { prev: sorted[at - 1]?.id ?? null, next: sorted[at + 1]?.id ?? null };
}

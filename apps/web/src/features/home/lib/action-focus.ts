/**
 * Where the focus goes after an action takes its card out of the list: the
 * card now at the same index, the previous one when the last card left, or
 * none (the list itself) when no card is left.
 */
export function focusIndexAfterRemoval(
  removedIndex: number,
  remaining: number
): number | null {
  if (remaining === 0) {
    return null;
  }
  return Math.min(removedIndex, remaining - 1);
}

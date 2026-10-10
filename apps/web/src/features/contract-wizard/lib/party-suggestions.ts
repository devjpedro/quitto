import type { Person } from "@/features/people/types";
import { normalizeName } from "@/lib/avatar-color";

const LIMIT = 4;

/**
 * The people of other contracts, offered at step 3 (mockup 17, I). Newest
 * first; with nothing typed, the first four; with text, the ones with a word
 * of the name that starts with it (no accent, no case). A name typed whole
 * (it is one of them already) offers nothing.
 */
export function partySuggestions(
  people: Person[],
  typed: string,
  limit = LIMIT
): Person[] {
  const wanted = normalizeName(typed);
  const newest = [...people].sort((a, b) =>
    b.lastContractAt.localeCompare(a.lastContractAt)
  );
  if (wanted === "") {
    return newest.slice(0, limit);
  }
  if (newest.some((person) => normalizeName(person.name) === wanted)) {
    return [];
  }
  return newest
    .filter((person) =>
      normalizeName(person.name)
        .split(" ")
        .some((word) => word.startsWith(wanted))
    )
    .slice(0, limit);
}

const WHITESPACE_RE = /\s+/;

// Combining diacritical marks (U+0300 to U+036F), left over by NFD.
const FIRST_MARK = 768;
const LAST_MARK = 879;
// Invisible and not whitespace to a regex: zero-width space, non-joiner and
// joiner (U+200B to U+200D) and the word joiner (U+2060).
const ZERO_WIDTH = new Set([8203, 8204, 8205, 8288]);

/**
 * "  Marína   Pires " → "marina pires": no accents, lower case, single
 * spaces, and nothing invisible. The avatar color and the people grouping
 * read a name through this, so they agree on who is "the same".
 */
export function normalizeName(name: string): string {
  return [...name.normalize("NFD")]
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      const mark = code >= FIRST_MARK && code <= LAST_MARK;
      return !(mark || ZERO_WIDTH.has(code));
    })
    .join("")
    .toLowerCase()
    .split(WHITESPACE_RE)
    .filter(Boolean)
    .join(" ");
}

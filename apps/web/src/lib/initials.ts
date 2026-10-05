export const WHITESPACE_RE = /\s+/;

/**
 * "João Pedro Souza" → "JS"; empty → "?". Composed first (NFC), so a name
 * pasted decomposed keeps its accented initial.
 */
export function initials(name: string | undefined): string {
  const parts =
    name?.normalize("NFC").trim().split(WHITESPACE_RE).filter(Boolean) ?? [];
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

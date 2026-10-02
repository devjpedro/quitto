const WHITESPACE_RE = /\s+/;

/** "João Pedro Souza" → "JS"; empty → "?". */
export function initials(name: string | undefined): string {
  const parts = name?.trim().split(WHITESPACE_RE).filter(Boolean) ?? [];
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

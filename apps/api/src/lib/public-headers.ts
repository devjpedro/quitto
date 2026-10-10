/** A public page's API answer: never cached, never indexed (receipt and invite preview). */
export const PUBLIC_HEADERS = {
  "cache-control": "no-store",
  "x-robots-tag": "noindex",
} as const;

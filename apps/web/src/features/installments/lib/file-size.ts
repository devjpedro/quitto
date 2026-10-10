import type { Locale } from "@quitto/shared";

const KB = 1024;
const MB = KB * 1024;

/** "184 KB", "1,2 MB" / "1.2 MB": a proof's size, in the meta line and in the upload's errors. */
export function formatFileSize(bytes: number, locale: Locale): string {
  if (bytes >= MB) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / MB)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / KB))} KB`;
}

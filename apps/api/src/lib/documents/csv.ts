import type { Locale } from "@quitto/shared";
import { formatISODate } from "../dates";
import { formatCents } from "../money";
import { docStatusLabel, docText } from "./labels";
import type { StatementModel } from "./model";

const NEEDS_QUOTES = /["\r\n]/;

/** A field with a comma, a quote or a line break is quoted, and inner quotes double (RFC 4180). */
function field(value: string, delimiter: string): string {
  if (value.includes(delimiter) || NEEDS_QUOTES.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** pt-BR: semicolon-delimited (the Brazilian Excel default). en-US: comma-delimited, quoted where needed. */
export function buildStatementCsv(
  model: StatementModel,
  locale: Locale
): string {
  const delimiter = locale === "en-US" ? "," : ";";
  const line = (cells: readonly string[]) =>
    cells.map((c) => field(c, delimiter)).join(delimiter);
  const header = line(docText(locale).tableHeaders);
  const lines = model.rows.map((r) =>
    line([
      String(r.sequence),
      formatISODate(r.dueDate, locale),
      formatCents(r.amountCents, locale),
      docStatusLabel(r.status, locale),
      r.paidAt ? formatISODate(r.paidAt, locale) : "",
    ])
  );
  return [header, ...lines].join("\r\n");
}

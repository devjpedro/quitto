import type { Locale } from "@quitto/shared";
import { formatMoney } from "@/lib/locale-format";
import { m } from "@/paraglide/messages.js";

/** How a schedule reads in one line (mockup 15: "12x de R$ 500,00 · todo dia 10"). */
export type ScheduleSummary =
  | { amountCents: number; count: number; day: number | null; kind: "even" }
  | {
      count: number;
      day: number | null;
      firstCents: number;
      kind: "firstDiffers";
      restCents: number;
    }
  | { count: number; kind: "varied"; totalCents: number };

interface SummaryRow {
  amountCents: number;
  dueDate: string;
}

/** The day every row falls on, or null (a 31st clamped to a 30th is another day). */
function sameDay(rows: readonly SummaryRow[]): number | null {
  const day = rows[0]?.dueDate.slice(8, 10);
  if (!day) {
    return null;
  }
  return rows.every((row) => row.dueDate.slice(8, 10) === day)
    ? Number(day)
    : null;
}

export function scheduleSummary(
  rows: readonly SummaryRow[]
): ScheduleSummary | null {
  const [first, ...rest] = rows;
  if (!first) {
    return null;
  }
  const day = sameDay(rows);
  if (rows.every((row) => row.amountCents === first.amountCents)) {
    return {
      kind: "even",
      amountCents: first.amountCents,
      count: rows.length,
      day,
    };
  }
  const [second] = rest;
  if (second && rest.every((row) => row.amountCents === second.amountCents)) {
    return {
      kind: "firstDiffers",
      firstCents: first.amountCents,
      restCents: second.amountCents,
      count: rest.length,
      day,
    };
  }
  const totalCents = rows.reduce((sum, row) => sum + row.amountCents, 0);
  return { kind: "varied", count: rows.length, totalCents };
}

/** From an invite's terms (the page only has the first 3 rows): one amount, or the total. */
export function summaryFromTerms(terms: {
  amountCents: number | null;
  dayOfMonth: number | null;
  installmentsCount: number;
  totalCents: number;
}): ScheduleSummary {
  if (terms.amountCents === null) {
    return {
      kind: "varied",
      count: terms.installmentsCount,
      totalCents: terms.totalCents,
    };
  }
  return {
    kind: "even",
    amountCents: terms.amountCents,
    count: terms.installmentsCount,
    day: terms.dayOfMonth,
  };
}

/**
 * The line and the part of it in bold: "**12x de R$ 500,00** · todo dia 10"
 * (the preview card), or "· dia 10" (the phone's summary).
 */
export function summaryText(
  summary: ScheduleSummary,
  locale: Locale,
  day: "every" | "short"
): { strong: string; text: string } {
  const options = { locale };
  let strong: string;
  if (summary.kind === "even") {
    strong = m.preview_summary_even(
      {
        count: summary.count,
        amount: formatMoney(summary.amountCents, locale),
      },
      options
    );
  } else if (summary.kind === "firstDiffers") {
    strong = m.preview_summary_first(
      {
        first: formatMoney(summary.firstCents, locale),
        count: summary.count,
        rest: formatMoney(summary.restCents, locale),
      },
      options
    );
  } else {
    strong = m.home_invite_terms_total(
      { count: summary.count, amount: formatMoney(summary.totalCents, locale) },
      options
    );
  }
  const dayOfMonth = summary.kind === "varied" ? null : summary.day;
  if (dayOfMonth === null) {
    return { strong, text: strong };
  }
  const dayText =
    day === "every"
      ? m.preview_every_day({ day: dayOfMonth }, options)
      : m.preview_day({ day: dayOfMonth }, options);
  return {
    strong,
    text: `${strong} ${m.home_dot_after({ text: dayText }, options)}`,
  };
}

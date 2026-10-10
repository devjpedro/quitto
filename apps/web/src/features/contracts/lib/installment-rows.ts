import type { Locale } from "@quitto/shared";
import { sequencesText } from "@/lib/sequences-label";
import { m } from "@/paraglide/messages.js";

/**
 * A group's title, its numbers in order: "Parcelas 1 e 2" for two in a row,
 * "Parcelas 5 a 28" for more. The card's overdue ones can have a gap (one in
 * review, or disputed, in between: review I3), said as the home says it:
 * "Parcelas 3 e 5 a 7", or "4 parcelas entre 3 e 9" past three pieces.
 */
export function groupTitle(
  items: { sequence: number }[],
  locale: Locale
): string {
  const first = items[0]?.sequence ?? 0;
  const last = items.at(-1)?.sequence ?? 0;
  if (last - first === items.length - 1) {
    return items.length === 2
      ? m.contract_group_pair({ first, last }, { locale })
      : m.contract_group_range({ first, last }, { locale });
  }
  const text = sequencesText(
    items.map((it) => it.sequence),
    locale
  );
  return text.kind === "list"
    ? m.contract_group_list({ list: text.text }, { locale })
    : m.contract_group_spread(
        { n: text.n, first: text.first, last: text.last },
        { locale }
      );
}

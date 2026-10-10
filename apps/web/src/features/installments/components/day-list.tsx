import type { Locale } from "@quitto/shared";
import { SectionTitle } from "@/components/ui/section-title";
import { capitalize } from "@/lib/format";
import { formatDate } from "@/lib/locale-format";
import { m } from "@/paraglide/messages.js";
import { installmentLineView } from "../lib/installment-line-view";
import type { InstallmentListItem } from "../types";
import { InstallmentListRow } from "./installment-list-row";

/** The picked day under the grid (below 1440 px): its date as the title, and its installments as list rows. */
export function DayList({
  day,
  items,
  locale,
  onIntent,
  onOpen,
  selectedId,
  today,
}: {
  day: string;
  items: InstallmentListItem[];
  locale: Locale;
  onIntent: (item: InstallmentListItem) => void;
  onOpen: (id: string) => void;
  selectedId: string | null;
  today: string;
}) {
  return (
    <section aria-labelledby="installments-day-title">
      <SectionTitle id="installments-day-title">
        {capitalize(formatDate(day, locale, "long"))}
      </SectionTitle>
      {items.length === 0 ? (
        <p className="rounded-card border-[1.5px] border-line-strong border-dashed p-4 text-ink-muted text-sm">
          {m.installments_day_empty()}
        </p>
      ) : (
        <ul className="divide-y divide-divider overflow-hidden rounded-card bg-surface-card">
          {items.map((item) => (
            <li
              className="first:rounded-t-card last:rounded-b-card"
              key={item.installmentId}
            >
              <InstallmentListRow
                item={item}
                locale={locale}
                onIntent={onIntent}
                onOpen={onOpen}
                selected={selectedId === item.installmentId}
                view={installmentLineView(
                  { id: item.installmentId, items: [item] },
                  "week",
                  today,
                  locale,
                  true
                )}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

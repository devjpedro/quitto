import { cn } from "@/lib/utils";
import { BAR_SEGMENT, type BarStatus } from "./installment-bar";

/**
 * The bar's key (mockup 14): a swatch of each pattern, its count and what it
 * is, and the end of the contract at the right. It is how the stripes read
 * without color (DIRECAO: status never by color alone).
 */
export function InstallmentBarKey({
  end,
  entries,
}: {
  end: string;
  entries: { count: number; label: string; status: BarStatus }[];
}) {
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-ink-muted tabular-nums">
      {entries.map((entry) => (
        <span
          className="inline-flex items-center gap-1.5 whitespace-nowrap"
          key={entry.status}
        >
          <span
            aria-hidden="true"
            className={cn(
              "inline-block h-2 w-3.5 shrink-0 rounded-[2px]",
              BAR_SEGMENT[entry.status]
            )}
          />
          <span>
            <b className="font-semibold text-ink">{entry.count}</b>{" "}
            <span>{entry.label}</span>
          </span>
        </span>
      ))}
      <span className="ml-auto whitespace-nowrap">{end}</span>
    </div>
  );
}

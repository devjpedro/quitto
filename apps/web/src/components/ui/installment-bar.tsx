import { cn } from "@/lib/utils";

export type BarStatus = "paid" | "overdue" | "review" | "today" | "open";

/**
 * The green card's track: on-brand at this %, the `bg-on-brand/16` below (a
 * literal, since Tailwind only builds what it finds; the test ties the two).
 * At 16 the salmon overdue stripe keeps 3:1 on it (tokens-contrast).
 */
export const ON_BRAND_TRACK_MIX = 16;

const SEGMENT: Record<"panel" | "brand", Record<BarStatus, string>> = {
  panel: {
    paid: "bg-brand",
    overdue: "stripes-danger",
    review: "stripes-warning",
    today: "shadow-[inset_0_0_0_1.5px_var(--ink)]",
    open: "bg-track",
  },
  // On the green card (mockup 13): paid in its text color, overdue in salmon,
  // the track at 16% rather than the mockup's 20% (ON_BRAND_TRACK_MIX).
  brand: {
    paid: "bg-on-brand",
    overdue: "stripes-on-brand-alert",
    review: "stripes-on-brand",
    today: "shadow-[inset_0_0_0_1.5px_var(--on-brand)]",
    open: "bg-on-brand/16",
  },
};

const PIECE =
  "min-w-0 rounded-[1.5px] first:rounded-l-[3px] last:rounded-r-[3px]";

/**
 * The whole contract on an action card (DIRECAO › Progresso): one segment
 * per installment up to 24 (`statuses`, from the API), or zones (paid,
 * overdue, the rest) sized by the counts above that. Decorative: the legend
 * beside it says "4 de 12 pagas · falta R$ 14.400,00".
 */
export function InstallmentBar({
  className,
  installmentsCount,
  onBrand = false,
  overdueCount,
  paidCount,
  statuses,
}: {
  className?: string;
  installmentsCount: number;
  onBrand?: boolean;
  overdueCount: number;
  paidCount: number;
  statuses: BarStatus[] | null;
}) {
  const tone = SEGMENT[onBrand ? "brand" : "panel"];
  if (statuses) {
    const segments = statuses.map((status, index) => ({
      status,
      sequence: index + 1,
    }));
    return (
      <div aria-hidden="true" className={cn("flex h-1.5 gap-0.5", className)}>
        {segments.map(({ status, sequence }) => (
          <span
            className={cn(PIECE, "flex-1", tone[status])}
            data-status={status}
            key={sequence}
          />
        ))}
      </div>
    );
  }
  const rest = Math.max(0, installmentsCount - paidCount - overdueCount);
  const zones: [BarStatus, number][] = [
    ["paid", paidCount],
    ["overdue", overdueCount],
    ["open", rest],
  ];
  return (
    <div aria-hidden="true" className={cn("flex h-1.5 gap-0.5", className)}>
      {zones
        .filter(([, size]) => size > 0)
        .map(([status, size]) => (
          <span
            className={cn(PIECE, tone[status])}
            data-status={status}
            key={status}
            style={{ flexBasis: 0, flexGrow: size }}
          />
        ))}
    </div>
  );
}

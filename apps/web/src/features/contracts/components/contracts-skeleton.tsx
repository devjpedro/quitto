import { Skeleton } from "@/components/ui/skeleton";
import { CARD_GRID } from "./contracts-grid";

/**
 * The list's shape while it loads. The toolbar as it will be: two segmented
 * controls (50 px each on a phone, one under the other; 38 px side by side
 * from md) and the totals chips (32 px, at the right from md). Under it six
 * cards of 275 px on the card grid: with the toolbar's height and the cards'
 * start, nothing moves when the list streams in.
 */
export function ContractsSkeleton() {
  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2 md:flex-row md:gap-3">
          <Skeleton className="h-[50px] w-full bg-surface-card md:h-[38px] md:w-[191px]" />
          <Skeleton className="h-[50px] w-full bg-surface-card md:h-[38px] md:w-[202px]" />
        </div>
        <Skeleton className="h-8 w-full rounded-full bg-surface-card md:mt-[3px] md:w-[377px]" />
      </div>
      <div className={CARD_GRID}>
        {[0, 1, 2, 3, 4, 5].map((key) => (
          <Skeleton
            className="h-[275px] rounded-card bg-surface-card"
            key={key}
          />
        ))}
      </div>
    </div>
  );
}

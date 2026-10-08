import { Skeleton } from "@/components/ui/skeleton";
import { CARD_GRID } from "./contracts-grid";

/** Three filled cards in the card's shape (about 273 px), under the bar's two bones. */
export function ContractsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-11 w-full bg-surface-card md:w-72" />
      <div className={CARD_GRID}>
        {[0, 1, 2].map((key) => (
          <Skeleton
            className="h-[273px] rounded-card bg-surface-card"
            key={key}
          />
        ))}
      </div>
    </div>
  );
}

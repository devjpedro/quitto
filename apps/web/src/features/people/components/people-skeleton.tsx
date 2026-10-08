import { Skeleton } from "@/components/ui/skeleton";
import { PEOPLE_GRID } from "./people-grid";

/** The grid's shape while it loads: the totals chips and four filled cards. */
export function PeopleSkeleton() {
  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <Skeleton className="h-8 w-64 bg-surface-card" />
      <div className={PEOPLE_GRID}>
        {[0, 1, 2, 3].map((key) => (
          <Skeleton
            className="h-28 rounded-card bg-surface-card md:h-[177px]"
            key={key}
          />
        ))}
      </div>
    </div>
  );
}

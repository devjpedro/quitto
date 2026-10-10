import { Skeleton } from "@/components/ui/skeleton";
import { PEOPLE_GRID } from "./people-grid";

/**
 * A phone's row (109 px, the loaded one's height): the face, two lines and the
 * state. The bones take the default fill: the row sits in a white card there,
 * where the card fill would not show.
 */
function RowBone() {
  return (
    <div className="flex h-[109px] items-start gap-3 p-4 md:hidden">
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    </div>
  );
}

/** The grid's shape while it loads: the totals' two chips (32 px) and six cards, two rows of the 3-column grid (a row each on a phone). */
export function PeopleSkeleton() {
  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <div className="flex gap-1.5">
        <Skeleton className="h-8 w-[187px] rounded-full bg-surface-card" />
        <Skeleton className="h-8 w-[184px] rounded-full bg-surface-card" />
      </div>
      <div className={PEOPLE_GRID}>
        {[0, 1, 2, 3, 4, 5].map((key) => (
          <div key={key}>
            <RowBone />
            <Skeleton className="hidden h-[193px] rounded-card bg-surface-card md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

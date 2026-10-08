import { Skeleton } from "@/components/ui/skeleton";
import { InstallmentsHeader } from "./installments-header";

/** The page's shape while the month loads: the real title and switch, then the chips and two blocks of rows. */
export function InstallmentsSkeleton() {
  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <InstallmentsHeader />
      <Skeleton className="h-11 w-full bg-surface-card md:h-9" />
      <div className="flex flex-col gap-5">
        <div>
          <Skeleton className="mb-3 h-5 w-32 bg-surface-card" />
          <Skeleton className="h-36 rounded-card bg-surface-card" />
        </div>
        <div>
          <Skeleton className="mb-3 h-5 w-40 bg-surface-card" />
          <Skeleton className="h-48 rounded-card bg-surface-card" />
        </div>
      </div>
    </div>
  );
}

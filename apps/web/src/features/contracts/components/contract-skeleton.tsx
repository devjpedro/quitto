import { Skeleton } from "@/components/ui/skeleton";

const BONE = "bg-surface-card";
const ROWS = ["r1", "r2", "r3", "r4"];

/**
 * The contract's shape while it streams in: "‹ Contratos", the 32 px title,
 * the other party's line, the big number, the 8 px bar with its key, the
 * segmented control and four 64 px rows in one filled block. On the page's
 * grid (the right column from lateral), so nothing shifts when it lands.
 */
export function ContractSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="grid lateral:grid-cols-[minmax(0,1fr)_420px] gap-x-7"
    >
      <div className="min-w-0">
        <Skeleton className={`h-[22px] w-24 max-md:hidden ${BONE}`} />
        <div className="flex items-start justify-between gap-2 md:mt-1.5">
          <Skeleton className={`h-[31px] w-56 md:h-[35px] md:w-72 ${BONE}`} />
          {/* Exportar and the "⋯": from md they sit on the title's line. */}
          <Skeleton
            className={`h-10 w-[108px] rounded-control max-md:hidden ${BONE}`}
          />
          <Skeleton
            className={`size-10 rounded-control max-md:hidden ${BONE}`}
          />
        </div>
        <Skeleton className={`mt-2.5 h-6 w-72 max-w-full md:w-96 ${BONE}`} />
        <div className="mt-5 md:mt-6">
          <Skeleton className={`h-4 w-24 ${BONE}`} />
          <Skeleton className={`mt-1 h-10 w-48 md:h-[45px] md:w-56 ${BONE}`} />
          <Skeleton className={`mt-1 h-4 w-32 ${BONE}`} />
          <Skeleton className={`mt-4 h-2 w-full rounded-full ${BONE}`} />
          <Skeleton className={`mt-2.5 h-4 w-3/4 ${BONE}`} />
        </div>
        <Skeleton
          className={`mt-7 h-[50px] w-full rounded-[12px] md:h-[38px] md:w-72 ${BONE}`}
        />
        <div className="mt-3 divide-y divide-divider overflow-hidden rounded-card bg-surface-card">
          {ROWS.map((row) => (
            <div className="flex h-16 items-center gap-3 px-3" key={row}>
              <Skeleton className="size-11 shrink-0 rounded-control bg-surface-inset" />
              <Skeleton className="h-4 w-40 bg-surface-inset" />
              <Skeleton className="ml-auto h-4 w-20 bg-surface-inset" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

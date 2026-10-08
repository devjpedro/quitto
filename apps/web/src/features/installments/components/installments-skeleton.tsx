import { Skeleton } from "@/components/ui/skeleton";
import { InstallmentsHeader } from "./installments-header";

/** The height of a block of N rows: 98 px each on a phone (two lines), 65 px from md (the class is spelled out, for Tailwind to find it). */
const BLOCK_HEIGHT = {
  1: "h-[98px] md:h-[65px]",
  2: "h-[196px] md:h-[130px]",
  3: "h-[294px] md:h-[195px]",
} as const;

/** A group: its title (23.75 px and 12 below, like a SectionTitle) and a block of rows of 65 px. */
function GroupBone({
  rows,
  title,
}: {
  rows: keyof typeof BLOCK_HEIGHT;
  title: string;
}) {
  return (
    <div>
      <div className="mb-3 flex h-[23.75px] items-center">
        <Skeleton className={`h-5 bg-surface-card ${title}`} />
      </div>
      <Skeleton
        className={`rounded-card bg-surface-card ${BLOCK_HEIGHT[rows]}`}
      />
    </div>
  );
}

/**
 * The page's shape while the month loads: the real title and switch, the
 * toolbar (the month's arrows and the chips: one row from md, two on a phone),
 * three groups of rows and, from lateral, the 420 px column beside them (the
 * urgent card, 258 px). The same grid as the content, so the columns never
 * change width when the month arrives.
 */
export function InstallmentsSkeleton() {
  return (
    <div className="lateral:grid lateral:grid-cols-[minmax(0,1fr)_420px] lateral:gap-x-7">
      <div className="flex min-w-0 flex-col gap-4 md:gap-5">
        <InstallmentsHeader />
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Skeleton className="h-11 w-full bg-surface-card md:h-9 md:w-[232px]" />
          <Skeleton className="h-11 w-full rounded-full bg-surface-card md:h-8 md:w-[334px]" />
        </div>
        <div className="flex flex-col gap-5 md:gap-6">
          <GroupBone rows={1} title="w-32" />
          <GroupBone rows={2} title="w-40" />
          <GroupBone rows={3} title="w-36" />
        </div>
      </div>
      <Skeleton className="lateral:block hidden h-[258px] rounded-card bg-surface-card" />
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

/** Route-level pending state: content-shaped blocks inside <main>, never full-screen. */
export function PagePending() {
  return (
    <div aria-busy="true" className="flex flex-col gap-3 p-4 md:p-6">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-72" />
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <Skeleton className="h-32 rounded-card" />
        <Skeleton className="h-32 rounded-card" />
        <Skeleton className="h-32 rounded-card" />
      </div>
    </div>
  );
}

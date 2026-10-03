import { Skeleton } from "@/components/ui/skeleton";

/** The home's shape while it loads: subtitle, chips, the action cards (carousel below lg, a grid of 3 to 5 from lg) and three upcoming rows. */
export function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-56" />
      <div className="flex gap-1.5">
        <Skeleton className="h-8 w-28 rounded-full" />
        <Skeleton className="h-8 w-36 rounded-full" />
        <Skeleton className="hidden h-8 w-36 rounded-full md:block" />
      </div>
      <div className="flex wide:grid-cols-[minmax(0,1.25fr)_repeat(4,minmax(0,1fr))] gap-2 overflow-hidden lg:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,1.25fr)_repeat(3,minmax(0,1fr))]">
        <Skeleton className="h-44 w-[calc(100%-2.75rem)] shrink-0 rounded-card lg:w-auto" />
        <Skeleton className="h-44 w-[calc(100%-2.75rem)] shrink-0 rounded-card lg:w-auto" />
        <Skeleton className="hidden h-44 rounded-card lg:block" />
        <Skeleton className="hidden h-44 rounded-card 2xl:block" />
        <Skeleton className="wide:block hidden h-44 rounded-card" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-14 rounded-card" />
        <Skeleton className="h-14 rounded-card" />
        <Skeleton className="h-14 rounded-card" />
      </div>
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";
import { NotificationsSkeleton } from "@/features/notifications/components/notifications-list";
import { RECENT_COUNT } from "@/features/notifications/hooks/use-recent-notifications";
import { cn } from "@/lib/utils";
import { LOWER_COLUMN, LOWER_WITH_SIDE } from "./home-grid";

/**
 * The home's shape while it loads: subtitle, chips, the action cards
 * (carousel below lg, a grid of 3 to 5 from lg) and the lower part on the
 * content's grid: three upcoming rows, and from lateral the side column with
 * the milestones and "Notificações recentes".
 */
export function HomeSkeleton() {
  return (
    // The content's gaps, so nothing shifts when the home streams in.
    <div className="flex flex-col gap-4 md:gap-5">
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
      <div className={cn("flex flex-col gap-4 md:gap-5", LOWER_WITH_SIDE)}>
        <div className={LOWER_COLUMN}>
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-14 rounded-card" />
            <Skeleton className="h-14 rounded-card" />
            <Skeleton className="h-14 rounded-card" />
          </div>
        </div>
        <div className={cn(LOWER_COLUMN, "wide:contents")}>
          <div className="lateral:flex hidden flex-col gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-36 rounded-card" />
          </div>
          <div className="lateral:flex hidden flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <NotificationsSkeleton
              className="bg-surface-raised"
              rows={RECENT_COUNT}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

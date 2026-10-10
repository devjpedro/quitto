import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { PanelMode } from "./panel-context";

/**
 * The panel while its installment loads: the amount, the trail and a block,
 * where they will be. In the column the bones are white on the filled column
 * (the default sunken grey would vanish on it).
 */
export function PanelSkeleton({ mode }: { mode: PanelMode }) {
  const docked = mode === "docked";
  const bone = docked ? "bg-surface-inset" : undefined;
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex flex-col",
        docked && "rounded-panel bg-surface-card px-5 pt-4 pb-5"
      )}
    >
      {docked ? <Skeleton className={cn("h-6 w-40", bone)} /> : null}
      <Skeleton className={cn("h-9 w-36", docked && "mt-5", bone)} />
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Skeleton className={cn("h-10", bone)} />
        <Skeleton className={cn("h-10", bone)} />
        <Skeleton className={cn("h-10", bone)} />
      </div>
      <Skeleton className={cn("mt-5 h-40 rounded-card", bone)} />
    </div>
  );
}

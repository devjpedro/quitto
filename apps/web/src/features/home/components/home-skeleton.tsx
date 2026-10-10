import { Skeleton } from "@/components/ui/skeleton";

/** A SectionTitle's bone: its 23.75 px line box and the 12 px below it. */
function TitleBone({ className }: { className: string }) {
  return (
    <div className="mb-3 flex h-[23.75px] flex-col justify-center">
      <Skeleton className={`h-5 bg-surface-card ${className}`} />
    </div>
  );
}

/**
 * The home's shape while it loads (mockup 20, B1), on the content's own grid:
 * the subtitle line, the action in the spotlight with "Na sequência" beside
 * it, "Próximos 30 dias" (title and three rows) and "Marcos" (title and three
 * rows). Every bone is filled like a card, so a phone's page color does not
 * swallow it.
 */
export function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <div className="-mt-2 flex h-5 items-center md:-mt-3">
        <Skeleton className="h-4 w-56 bg-surface-card" />
      </div>
      <div className="flex lateral:grid lateral:grid-cols-2 flex-col lateral:items-start gap-7 lateral:gap-x-7 lateral:gap-y-9 md:gap-8">
        <Skeleton className="h-[320px] rounded-card bg-surface-card" />
        <Skeleton className="h-[340px] rounded-card bg-surface-card" />
        <div>
          <TitleBone className="w-40" />
          <Skeleton className="h-[240px] rounded-card bg-surface-card" />
        </div>
        <div>
          <TitleBone className="w-16" />
          <Skeleton className="h-[240px] rounded-card bg-surface-card" />
        </div>
      </div>
    </div>
  );
}

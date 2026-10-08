import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { LOWER_COLUMN, LOWER_STACK, LOWER_WITH_SIDE } from "./home-grid";

/**
 * A SectionTitle's bone: its 23.75 px line box (19 px, leading-tight) and the
 * 12 px below it, with a 20 px bar inside, so the block under it starts where
 * the loaded section's does.
 */
function TitleBone({
  className,
  withLine = false,
}: {
  className: string;
  /** "Próximos 30 dias" has the totals line under its title: 45 px with it. */
  withLine?: boolean;
}) {
  return (
    <div
      className={cn(
        "mb-3 flex flex-col justify-center gap-1",
        withLine ? "h-[45px]" : "h-[23.75px]"
      )}
    >
      <Skeleton className={cn("h-5 bg-surface-card", className)} />
      {withLine ? <Skeleton className="h-3 w-56 bg-surface-card" /> : null}
    </div>
  );
}

/** A phone's carousel, under it "1 de N" and "Ver todas" (44 px, 12 px below the cards). */
function CarouselPager() {
  return (
    <div className="flex h-11 items-center justify-between lg:hidden">
      <Skeleton className="h-4 w-12 bg-surface-card" />
      <Skeleton className="h-8 w-20 bg-surface-card" />
    </div>
  );
}

/**
 * The home's shape while it loads: subtitle (the chips row is almost never there), the action cards
 * (carousel below lg, a grid of 3 to 5 from lg) and the lower part on the
 * content's grid: "Próximos 30 dias" (its title and one block), and from
 * lateral the side column with the milestones and "Notificações recentes".
 * Every bone is filled like a card: on a phone (page-surfaces) that is the
 * white of the card, since the default sunken bone is the page's own color.
 * A card bone is the card at rest: 267 px with a phone's 44 px buttons, 259
 * from md.
 */
export function HomeSkeleton() {
  return (
    // The content's gaps and rhythm, so nothing shifts when the home streams in.
    <div className="flex flex-col gap-4 md:gap-5">
      {/* The subtitle's row (20 px, pulled up like the content's), so the cards start where the loaded ones do. */}
      <div className="-mt-2 flex h-5 items-center md:-mt-3">
        <Skeleton className="h-4 w-56 bg-surface-card" />
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex wide:grid-cols-[minmax(0,1.25fr)_repeat(4,minmax(0,1fr))] gap-3 overflow-hidden lg:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,1.25fr)_repeat(3,minmax(0,1fr))]">
          <Skeleton className="h-[267px] w-[calc(100%-2.75rem)] shrink-0 rounded-card bg-surface-card md:h-[259px] lg:w-auto" />
          <Skeleton className="h-[267px] w-[calc(100%-2.75rem)] shrink-0 rounded-card bg-surface-card md:h-[259px] lg:w-auto" />
          <Skeleton className="hidden h-[267px] rounded-card bg-surface-card md:h-[259px] lg:block" />
          <Skeleton className="hidden h-[267px] rounded-card bg-surface-card md:h-[259px] 2xl:block" />
          <Skeleton className="wide:block hidden h-[267px] rounded-card bg-surface-card md:h-[259px]" />
        </div>
        <CarouselPager />
      </div>
      <div className={cn(LOWER_STACK, LOWER_WITH_SIDE)}>
        <div className={LOWER_COLUMN}>
          <div>
            <TitleBone className="w-40" withLine />
            {/* Five rows of 65 px: the list's usual height. */}
            <Skeleton className="h-[325px] rounded-card bg-surface-card" />
          </div>
        </div>
        <div className={LOWER_COLUMN}>
          <div className="lateral:flex hidden flex-col">
            <TitleBone className="w-16" />
            <Skeleton className="h-[480px] rounded-card bg-surface-card" />
          </div>
        </div>
      </div>
    </div>
  );
}

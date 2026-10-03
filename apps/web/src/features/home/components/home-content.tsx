import { useSuspenseQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { getLocale } from "@/paraglide/runtime.js";
import { homeQueryOptions } from "../api";
import { useFocusAfterLastAction } from "../hooks/use-focus-after-last-action";
import { homeLayout, homeSubtitle } from "../lib/home-layout";
import { momentMilestone } from "../lib/moment";
import { ActionList } from "./action-list";
import { AllClear } from "./all-clear";
import { HomeEmpty } from "./home-empty";
import { Milestones } from "./milestones";
import { OnboardingGuide } from "./onboarding-guide";
import { TotalsChips } from "./totals-chips";
import { UpcomingList } from "./upcoming-list";

/** A column of the lower part from lateral; below it, `contents` (its blocks join the page's single column). */
const COLUMN =
  "contents lateral:flex lateral:min-w-0 lateral:flex-col lateral:gap-5";

/**
 * The lower part with a side column (mockup 12): 3fr/2fr from lateral; from
 * wide 2fr for the list and 1fr per side block. auto-fit collapses the track
 * of a side block that is not on screen, instead of leaving a 300 px hole.
 */
const WITH_SIDE =
  "lateral:grid lateral:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)] lateral:items-start lateral:gap-x-6 lateral:gap-y-5 wide:grid-cols-[minmax(0,2fr)_repeat(auto-fit,minmax(300px,1fr))]";

/**
 * Everything that comes from GET /api/home (streamed from the SSR on the
 * first load). Below lateral it is one column in the order of mockup 11:
 * list, milestones, guide. From lateral (1440 px) the lower part grows by
 * columns: list and guide on the left, the side column on the right; from
 * wide (1840 px) each side block takes a column of its own.
 */
export function HomeContent() {
  const { data: home } = useSuspenseQuery(homeQueryOptions);
  const summaryRef = useFocusAfterLastAction(home.actions.length);
  const layout = homeLayout(home);
  const lower = layout.hasContract || layout.compactGuide;
  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <p
        // Takes the focus of the last action (useFocusAfterLastAction). The
        // ring keeps 4 px off the text, in the page color; the sticky top bar
        // (~56 px) would cover it on a phone.
        className="-mt-2 scroll-mt-16 rounded-control text-ink-muted text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-4 focus-visible:ring-offset-surface-sunken md:-mt-3 md:scroll-mt-4 md:focus-visible:ring-offset-surface"
        ref={summaryRef}
        tabIndex={-1}
      >
        {homeSubtitle(home, layout, getLocale())}
      </p>
      {layout.heroGuide ? (
        <OnboardingGuide
          onboarding={home.onboarding}
          variant="hero"
          view={layout.guide}
        />
      ) : null}
      {layout.showChips ? (
        <TotalsChips
          pendingCount={home.actions.length}
          toPayCents={home.upcoming.toPayCents}
          toReceiveCents={home.upcoming.toReceiveCents}
        />
      ) : null}
      {home.actions.length > 0 ? (
        <ActionList actions={home.actions} today={home.today} />
      ) : null}
      {layout.allClear ? (
        <AllClear
          hasUpcoming={home.upcoming.items.length > 0}
          nextDue={home.nextDue}
          today={home.today}
        />
      ) : null}
      {layout.empty ? <HomeEmpty /> : null}
      {lower ? (
        <div
          className={cn(
            "flex flex-col gap-4 md:gap-5",
            layout.hasContract && WITH_SIDE
          )}
        >
          <div className={COLUMN}>
            {layout.hasContract ? (
              <UpcomingList upcoming={home.upcoming} />
            ) : null}
            {layout.compactGuide ? (
              // Last below lateral (after the milestones), under the list from lateral.
              <div className="lateral:order-none order-last">
                <OnboardingGuide
                  onboarding={home.onboarding}
                  variant="compact"
                  view={layout.guide}
                />
              </div>
            ) : null}
          </div>
          {layout.hasContract ? (
            <div className={cn(COLUMN, "wide:contents")}>
              {/* The milestone of the moment opens the strip on a phone; from md the sidebar shows it. */}
              <Milestones
                milestones={home.milestones}
                momentId={momentMilestone(home)?.id ?? null}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

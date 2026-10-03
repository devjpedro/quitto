import { useSuspenseQuery } from "@tanstack/react-query";
import { RecentNotifications } from "@/features/notifications/components/recent-notifications";
import { cn } from "@/lib/utils";
import { getLocale } from "@/paraglide/runtime.js";
import { homeQueryOptions } from "../api";
import { useFocusAfterLastAction } from "../hooks/use-focus-after-last-action";
import { homeLayout, homeSubtitle } from "../lib/home-layout";
import { onlyMomentStrip } from "../lib/milestones";
import { momentMilestone } from "../lib/moment";
import { ActionList } from "./action-list";
import { AllClear } from "./all-clear";
import { HomeEmpty } from "./home-empty";
import { LOWER_COLUMN, LOWER_WITH_SIDE } from "./home-grid";
import { Milestones } from "./milestones";
import { OnboardingGuide } from "./onboarding-guide";
import { TotalsChips } from "./totals-chips";
import { UpcomingList } from "./upcoming-list";

/**
 * A column left empty (no milestones for the desktop and "Notificações
 * recentes" gone with a failed list) turns the grid into a block, so no 2fr
 * track stays blank.
 */
const SIDE_COLUMN_EMPTY = "lateral:has-[>:empty]:block";

/**
 * Everything that comes from GET /api/home (streamed from the SSR on the
 * first load). Below lateral it is one column in the order of mockup 11:
 * list, milestones, guide. From lateral (1440 px) the lower part grows by
 * columns: list and guide on the left; milestones and "Notificações
 * recentes" on the right; from wide (1840 px) each takes a column of its own.
 */
export function HomeContent() {
  const { data: home } = useSuspenseQuery(homeQueryOptions);
  const summaryRef = useFocusAfterLastAction(home.actions.length);
  const layout = homeLayout(home);
  const lower = layout.hasContract || layout.compactGuide;
  const momentId = momentMilestone(home)?.id ?? null;
  const milestones = layout.hasContract ? (
    // The milestone of the moment opens the strip on a phone; from md the sidebar shows it.
    <Milestones milestones={home.milestones} momentId={momentId} />
  ) : null;
  // A strip with only that milestone is phone-only (md:hidden): it stays out of
  // the side column, which is then empty when "Notificações recentes" is gone.
  const phoneOnlyMilestones = onlyMomentStrip(home.milestones, momentId);
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
            LOWER_WITH_SIDE,
            SIDE_COLUMN_EMPTY
          )}
        >
          <div className={LOWER_COLUMN}>
            {layout.hasContract ? (
              <UpcomingList
                hasActions={home.actions.length > 0}
                upcoming={home.upcoming}
              />
            ) : null}
            {phoneOnlyMilestones ? milestones : null}
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
          <div className={cn(LOWER_COLUMN, "wide:contents")}>
            {phoneOnlyMilestones ? null : milestones}
            {/* From lateral only: hidden below by CSS, and fetched only on a wide screen. */}
            <RecentNotifications />
          </div>
        </div>
      ) : null}
    </div>
  );
}

import { useSuspenseQuery } from "@tanstack/react-query";
import { capitalize } from "@/lib/format";
import { formatDate } from "@/lib/locale-format";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { homeQueryOptions } from "../api";
import { useFocusAfterLastAction } from "../hooks/use-focus-after-last-action";
import { homeLayout, homeSubtitle } from "../lib/home-layout";
import { momentMilestone } from "../lib/moment";
import { ActionList } from "./action-list";
import { AllClear } from "./all-clear";
import { HomeEmpty } from "./home-empty";
import { Milestones } from "./milestones";
import { NextInLine } from "./next-in-line";
import { OnboardingGuide } from "./onboarding-guide";
import { UpcomingList } from "./upcoming-list";

/**
 * Everything that comes from GET /api/home (streamed from the SSR on the
 * first load). Mockup 20, B1: one action in the spotlight with "Na sequência"
 * beside it, then "Próximos 30 dias" and "Marcos", two columns from lateral
 * and one below. A block that has nothing to say leaves no hole: the grid
 * just flows.
 */
export function HomeContent() {
  const { data: home } = useSuspenseQuery(homeQueryOptions);
  const locale = getLocale();
  const summaryRef = useFocusAfterLastAction(home.actions.length);
  const layout = homeLayout(home);
  const date = capitalize(formatDate(home.today, locale, "long"));
  const momentId = momentMilestone(home)?.id ?? null;
  const rest = home.actions.slice(1);
  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <p
        // Takes the focus of the last action (useFocusAfterLastAction). The
        // ring keeps 4 px off the text, in the page color; the sticky top bar
        // (~56 px) would cover it on a phone.
        className="-mt-2 scroll-mt-16 self-start rounded-control text-ink-muted text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-4 focus-visible:ring-offset-surface-sunken md:-mt-3 md:scroll-mt-4 md:text-[14px] md:focus-visible:ring-offset-surface"
        ref={summaryRef}
        tabIndex={-1}
      >
        {/* On a phone the subtitle is the date; the count is for a screen reader. */}
        <span className="md:hidden">{date}</span>
        <span className="max-md:hidden">{m.home_date_lead({ date })} </span>
        <span className="max-md:sr-only">
          {" "}
          {homeSubtitle(home, layout, locale)}
        </span>
      </p>
      {layout.heroGuide ? (
        <OnboardingGuide
          onboarding={home.onboarding}
          variant="hero"
          view={layout.guide}
        />
      ) : null}
      {layout.allClear ? (
        <AllClear
          hasUpcoming={home.upcoming.items.length > 0}
          nextDue={home.nextDue}
          today={home.today}
        />
      ) : null}
      {layout.empty ? <HomeEmpty /> : null}
      {layout.hasContract || layout.compactGuide || home.actions.length > 0 ? (
        <div className="flex lateral:grid lateral:grid-cols-2 flex-col lateral:items-start gap-7 lateral:gap-x-7 lateral:gap-y-9 md:gap-8">
          {home.actions.length > 0 ? (
            <>
              <ActionList actions={home.actions} today={home.today} />
              {rest.length > 0 ? (
                <NextInLine actions={rest} today={home.today} />
              ) : null}
            </>
          ) : null}
          {layout.hasContract ? (
            <>
              <UpcomingList
                hasInstallmentActions={home.actions.some(
                  (action) => action.kind !== "invite"
                )}
                upcoming={home.upcoming}
              />
              <Milestones
                milestones={home.milestones}
                momentId={momentId}
                today={home.today}
              />
            </>
          ) : null}
          {layout.compactGuide ? (
            <OnboardingGuide
              onboarding={home.onboarding}
              variant="compact"
              view={layout.guide}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

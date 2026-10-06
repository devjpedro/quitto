import { useSuspenseQuery } from "@tanstack/react-query";
import { useId } from "react";
import { capitalize } from "@/lib/format";
import { formatDate } from "@/lib/locale-format";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { homeQueryOptions } from "../api";
import { useFocusAfterLastAction } from "../hooks/use-focus-after-last-action";
import { useSeeAll } from "../hooks/use-see-all";
import { homeLayout, homeSubtitle } from "../lib/home-layout";
import { overdueChips } from "../lib/home-totals";
import { momentMilestone } from "../lib/moment";
import { ActionsRow } from "./actions-row";
import { AllClear } from "./all-clear";
import { HomeEmpty } from "./home-empty";
import { HomeLower } from "./home-lower";
import { Milestones } from "./milestones";
import { OnboardingGuide } from "./onboarding-guide";
import { SeeAllButton } from "./see-all-button";
import { TotalsChips } from "./totals-chips";
import { UpcomingList } from "./upcoming-list";

/**
 * Everything that comes from GET /api/home (streamed from the SSR on the
 * first load): the summary, the overdue chips (only with 2+ overdue cards on
 * a side), the action cards (ActionsRow) and the lower part (HomeLower).
 * With few cards (and a contract) the milestones go up under "Próximos 30
 * dias" and the lower part keeps only the notifications (mockup 16, frame D).
 */
export function HomeContent() {
  const { data: home } = useSuspenseQuery(homeQueryOptions);
  const locale = getLocale();
  const listId = useId();
  const { expanded, toggle } = useSeeAll(home.actions.length);
  const summaryRef = useFocusAfterLastAction(home.actions.length);
  const layout = homeLayout(home);
  const date = capitalize(formatDate(home.today, locale, "long"));
  const chips = overdueChips(home);
  const momentId = momentMilestone(home)?.id ?? null;
  const few = layout.fewActions ? (home.actions.length as 1 | 2) : null;
  const upcoming = layout.hasContract ? (
    <UpcomingList
      hasInstallmentActions={home.actions.some(
        (action) => action.kind !== "invite"
      )}
      upcoming={home.upcoming}
    />
  ) : null;
  const strip = layout.hasContract ? (
    // The milestone of the moment opens the strip on a phone; from md the sidebar shows it.
    <Milestones
      milestones={home.milestones}
      momentId={momentId}
      today={home.today}
    />
  ) : null;
  const guide = layout.compactGuide ? (
    // Last below lateral (after the milestones); in its column from lateral.
    <div className="lateral:order-none order-last">
      <OnboardingGuide
        onboarding={home.onboarding}
        variant="compact"
        view={layout.guide}
      />
    </div>
  ) : null;
  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <div className="-mt-2 flex items-baseline justify-between gap-3 md:-mt-3">
        <p
          // Takes the focus of the last action (useFocusAfterLastAction). The
          // ring keeps 4 px off the text, in the page color; the sticky top bar
          // (~56 px) would cover it on a phone.
          className="scroll-mt-16 rounded-control text-ink-muted text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-4 focus-visible:ring-offset-surface-sunken md:scroll-mt-4 md:text-[14px] md:focus-visible:ring-offset-surface"
          ref={summaryRef}
          tabIndex={-1}
        >
          {/* On a phone the subtitle is the date: the carousel's "1 de N" says the count. */}
          <span className="md:hidden">{date}</span>
          <span className="max-md:hidden">{m.home_date_lead({ date })} </span>
          {/* Said on a phone (the focus lands here after the last card), shown from md. */}
          <span className="max-md:sr-only">
            {" "}
            {homeSubtitle(home, layout, locale)}
          </span>
        </p>
        <SeeAllButton
          count={home.actions.length}
          expanded={expanded}
          listId={listId}
          onToggle={toggle}
        />
      </div>
      {layout.heroGuide ? (
        <OnboardingGuide
          onboarding={home.onboarding}
          variant="hero"
          view={layout.guide}
        />
      ) : null}
      {chips.toPayCents !== null || chips.toReceiveCents !== null ? (
        <TotalsChips
          overdueToPayCents={chips.toPayCents}
          overdueToReceiveCents={chips.toReceiveCents}
        />
      ) : null}
      {home.actions.length > 0 ? (
        <ActionsRow
          actions={home.actions}
          expanded={expanded}
          few={few}
          listId={listId}
          onToggle={toggle}
          today={home.today}
          upcoming={
            // With few cards the milestones go up with the list, under it.
            few ? (
              <div className="flex flex-col gap-7 md:gap-9">
                {upcoming}
                {strip}
              </div>
            ) : (
              upcoming
            )
          }
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
      {layout.hasContract || layout.compactGuide ? (
        <HomeLower
          actions={home.actions}
          few={few !== null}
          guide={guide}
          hasContract={layout.hasContract}
          milestones={home.milestones}
          momentId={momentId}
          today={home.today}
          upcoming={upcoming}
        />
      ) : null}
    </div>
  );
}

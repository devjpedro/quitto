import { ArrowDownLeft, ArrowUpRight } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";
import { ChipStrip, MoneyChip } from "@/components/ui/chip-strip";
import { SectionBoundary } from "@/components/ui/section-boundary";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { todayISO } from "@/lib/format";
import { m } from "@/paraglide/messages.js";
import { peopleQueryOptions } from "../api";
import { usePeopleRoute } from "../hooks/use-people-route";
import { PeopleEmpty } from "./people-empty";
import { PEOPLE_GRID } from "./people-grid";
import { PeopleSkeleton } from "./people-skeleton";
import { PersonCard } from "./person-card";
import { PersonSheet } from "./person-sheet";

/** The sheet's own boundary of absence: a key the list does not know lets go of the search. */
function ClearPerson({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    onClose();
  }, [onClose]);
  return null;
}

function PeopleContent() {
  const { data } = useSuspenseQuery(peopleQueryOptions);
  const { close, open, person } = usePeopleRoute();
  const people = data.people;
  if (people.length === 0) {
    return <PeopleEmpty />;
  }
  const owes = people.reduce((sum, p) => sum + p.owesYouCents, 0);
  const owed = people.reduce((sum, p) => sum + p.youOweCents, 0);
  const chips: ReactNode[] = [];
  if (owes > 0) {
    chips.push(
      <MoneyChip
        cents={owes}
        icon={ArrowDownLeft}
        key="receive"
        label={m.contracts_total_receive()}
        tone="plain"
      />
    );
  }
  if (owed > 0) {
    chips.push(
      <MoneyChip
        cents={owed}
        icon={ArrowUpRight}
        key="pay"
        label={m.contracts_total_pay()}
        tone="plain"
      />
    );
  }
  const selected = person ? people.find((p) => p.key === person) : undefined;
  return (
    <div className="flex flex-col gap-3 md:gap-4">
      {chips.length > 0 ? (
        <ChipStrip label={m.people_page_totals_label()}>{chips}</ChipStrip>
      ) : null}
      <ul className={PEOPLE_GRID}>
        {people.map((p) => (
          <li className="first:rounded-t-card last:rounded-b-card" key={p.key}>
            <PersonCard onOpen={open} person={p} />
          </li>
        ))}
      </ul>
      {selected ? (
        <PersonSheet onClose={close} person={selected} today={todayISO()} />
      ) : null}
      {person && !selected ? <ClearPerson onClose={close} /> : null}
    </div>
  );
}

/**
 * "Pessoas" (mockup 17, E): who you have contracts with and what is owed in
 * each direction. The title draws at once; the grid streams in one section.
 */
export function PeoplePage() {
  useDocumentTitle(m.page_title_people());
  return (
    <div className="lateral:p-8 p-4 md:p-6" data-testid="people-page">
      <div className="mx-auto flex w-full max-w-[1840px] flex-col gap-4 md:gap-5">
        <h1 className="font-bold font-display text-[28px] leading-[1.1] tracking-[-0.035em] md:text-[32px]">
          {m.people_page_title()}
        </h1>
        <SectionBoundary fallback={<PeopleSkeleton />}>
          <PeopleContent />
        </SectionBoundary>
      </div>
    </div>
  );
}

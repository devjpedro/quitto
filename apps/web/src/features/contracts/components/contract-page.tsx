import { useSuspenseQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { SectionBoundary } from "@/components/ui/section-boundary";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { ApiError } from "@/lib/api-client";
import { PAGE_TITLE } from "@/lib/page-title";
import { cn } from "@/lib/utils";
import { contractQueryOptions } from "../api";
import {
  type ContractRoute,
  type ContractTab,
  useContractRoute,
} from "../hooks/use-contract-route";
import { perspectiveOf } from "../lib/contract-view";
import type { ContractDetail } from "../types";
import { ContractHeader } from "./contract-header";
import { ContractHero } from "./contract-hero";
import { ContractNotFound } from "./contract-not-found";
import { ContractSkeleton } from "./contract-skeleton";
import { ContractTabs } from "./contract-tabs";

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.httpStatus === 404;
}

type Slot = (detail: ContractDetail, route: ContractRoute) => ReactNode;

export interface ContractSlots {
  /** Task 7: the next action's card (green, lime when settled), or null. */
  nextAction: Slot;
  /** Task 9: the installment panel's host (docked column from lateral, sheet below). */
  panel: Slot;
  /** Task 8: "Atividade recente" in the side column (not on the History tab). */
  recentActivity: Slot;
  /** Task 8: the action at the end of the tabs' row ("Convidar pessoa"), or null. */
  tabAction: Slot;
  /** Tasks 7 and 8: each tab's body. */
  tabBody: Record<ContractTab, Slot>;
}

export const EMPTY_SLOTS: ContractSlots = {
  nextAction: () => null,
  panel: () => null,
  recentActivity: () => null,
  tabAction: () => null,
  tabBody: {
    installments: () => null,
    people: () => null,
    history: () => null,
  },
};

/**
 * The contract (mockup 14): one tree at every width, laid out by grid areas.
 * Below md: head, hero, card, tabs. From md to 1439: the card beside the
 * hero (400 px). From lateral: a 420 px column on the right (the card and
 * the recent activity, or the docked panel), held while the page scrolls.
 * The aside is `contents` below lateral, so the card is a grid item there.
 */
function ContractContent({ slots }: { slots: ContractSlots }) {
  const route = useContractRoute();
  const { data: detail } = useSuspenseQuery(contractQueryOptions(route.id));
  const card = slots.nextAction(detail, route);
  const panelOpen = route.installmentId !== null;
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-x-7 [grid-template-areas:'head'_'hero'_'card'_'tabs']",
        card
          ? "md:grid-cols-[minmax(0,1fr)_400px] md:[grid-template-areas:'head_head'_'hero_card'_'tabs_tabs']"
          : "md:[grid-template-areas:'head'_'hero'_'tabs']",
        "lateral:grid-cols-[minmax(0,1fr)_420px] lateral:grid-rows-[auto_auto_1fr] lateral:[grid-template-areas:'head_side'_'hero_side'_'tabs_side']"
      )}
      data-perspective={perspectiveOf(detail.role)}
    >
      <div className="[grid-area:head]">
        <ContractHeader detail={detail} />
      </div>
      <div className="mt-5 [grid-area:hero] md:mt-6">
        <ContractHero detail={detail} today={route.today} />
      </div>
      <aside
        className="lateral:sticky lateral:top-8 lateral:flex contents lateral:max-h-[calc(100dvh-5.5rem)] lateral:flex-col lateral:gap-7 lateral:self-start lateral:[grid-area:side]"
        data-testid="contract-side"
      >
        {card ? (
          <div
            className={cn(
              // From lateral the aside is a flex column: stretch, or the
              // card shrinks to its content instead of filling the 420 px.
              "lateral:mt-0 mt-5 lateral:self-stretch [grid-area:card] md:mt-6 md:self-start",
              panelOpen && "lateral:hidden"
            )}
          >
            {card}
          </div>
        ) : null}
        {route.tab === "history" ? null : (
          <div
            className={cn(
              "lateral:block hidden",
              panelOpen && "lateral:hidden"
            )}
          >
            {slots.recentActivity(detail, route)}
          </div>
        )}
        {slots.panel(detail, route)}
      </aside>
      <div className="mt-7 min-w-0 [grid-area:tabs]">
        <ContractTabs
          action={slots.tabAction(detail, route)}
          detail={detail}
          onTabChange={route.setTab}
          tab={route.tab}
        />
        <div className="mt-3">{slots.tabBody[route.tab](detail, route)}</div>
      </div>
    </div>
  );
}

/**
 * The breathing room outside, the 1840 px cap inside (as home-page.tsx does):
 * the content stops at 1840 px, not at 1840 minus the padding (review M16).
 */
export function ContractPage({
  slots = EMPTY_SLOTS,
}: {
  slots?: ContractSlots;
}) {
  useDocumentTitle(PAGE_TITLE.contractDetail);
  return (
    <div className="lateral:p-8 p-4 pt-2 md:p-6">
      <div className="mx-auto w-full max-w-[1840px]">
        <SectionBoundary
          fallback={<ContractSkeleton />}
          renderError={(error) =>
            isNotFound(error) ? <ContractNotFound /> : null
          }
        >
          <ContractContent slots={slots} />
        </SectionBoundary>
      </div>
    </div>
  );
}

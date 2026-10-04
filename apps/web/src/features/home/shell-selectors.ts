import { useQuery } from "@tanstack/react-query";
import { useHydrated } from "@tanstack/react-router";
import type { NavCounts } from "@/components/layout/nav-items";
import type { SidebarContracts } from "@/components/layout/sidebar-contracts";
import { getLocale } from "@/paraglide/runtime.js";
import { homeQueryOptions } from "./api";
import {
  type MomentMilestone,
  type MomentView,
  momentMilestone,
  momentView,
} from "./lib/moment";
import type { Home } from "./types";

// What the shell reads from GET /api/home: the bell's count, the sidebar's
// lime card, the sidebar's counts and the sidebar's active contracts. Each one never throws (the shell must
// not go down with the home) and shows nothing during SSR and the hydration
// pass: the shell renders before the streamed home lands, so anything the
// server HTML does not have would be a hydration mismatch.

// Module level, so each select is stable.
const unreadCount = (home: Home) => home.unreadCount;

/** The sidebar's numbers: what needs you now and the active contracts. */
const navCounts = (home: Home): NavCounts => ({
  contracts: home.activeContractsCount,
  now: home.actions.length,
});

/** The milestone of the moment with the home's today, which tells a late installment from one ahead. */
const momentAndToday = (
  home: Home
): { milestone: MomentMilestone; today: string } | null => {
  const milestone = momentMilestone(home);
  return milestone ? { milestone, today: home.today } : null;
};

const NO_COUNTS: NavCounts = { contracts: 0, now: 0 };

/** The sidebar's active contracts: the 5 newest from the home, and how many there are. */
const activeContracts = (home: Home): SidebarContracts => ({
  items: home.activeContracts,
  total: home.activeContractsCount,
});

const NO_CONTRACTS: SidebarContracts = { items: [], total: 0 };

/** Unread count for the bell's badge; 0 until hydrated. */
export function useUnreadCount(): number {
  const hydrated = useHydrated();
  const { data } = useQuery({
    ...homeQueryOptions,
    select: unreadCount,
    throwOnError: false,
  });
  return hydrated ? (data ?? 0) : 0;
}

/** The milestone of the moment for the sidebar's lime card, already worded; null until hydrated. */
export function useMomentMilestone(): MomentView | null {
  const hydrated = useHydrated();
  const { data } = useQuery({
    ...homeQueryOptions,
    select: momentAndToday,
    throwOnError: false,
  });
  return hydrated && data
    ? momentView(data.milestone, getLocale(), data.today)
    : null;
}

/** The counts next to "Agora" and "Contratos" in the sidebar; zero until hydrated. */
export function useNavCounts(): NavCounts {
  const hydrated = useHydrated();
  const { data } = useQuery({
    ...homeQueryOptions,
    select: navCounts,
    throwOnError: false,
  });
  return hydrated && data ? data : NO_COUNTS;
}

/**
 * The sidebar's "Contratos ativos": null until hydrated (the server HTML has
 * no home) and while the home loads, which the sidebar shows as a skeleton;
 * none when the home fails, so the skeleton never stays for good.
 */
export function useActiveContracts(): SidebarContracts | null {
  const hydrated = useHydrated();
  const { data, isError } = useQuery({
    ...homeQueryOptions,
    select: activeContracts,
    throwOnError: false,
  });
  if (!hydrated) {
    return null;
  }
  if (data) {
    return data;
  }
  return isError ? NO_CONTRACTS : null;
}

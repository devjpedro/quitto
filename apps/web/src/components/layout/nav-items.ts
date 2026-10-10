import {
  CalendarBlank,
  Files,
  type Icon,
  Lightning,
  Users,
} from "@phosphor-icons/react";
import { pluralForm } from "@/lib/plural";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";

export interface NavItem {
  /** Accessible name with the sidebar's count, whose number is aria-hidden. Only for a count above 0. */
  countLabel: (count: number) => string;
  exact: boolean;
  icon: Icon;
  id: "contracts" | "installments" | "now" | "people";
  label: () => string;
  to: "/" | "/contracts" | "/installments" | "/people";
}

/** The numbers next to the sidebar items (mockups 02 and 08); 0 shows none. */
export type NavCounts = Record<NavItem["id"], number>;

const isOne = (count: number) => pluralForm(count, getLocale()) === "one";

export const PRIMARY_NAV: NavItem[] = [
  {
    id: "now",
    to: "/",
    label: m.nav_now,
    countLabel: (count) =>
      isOne(count) ? m.nav_now_count_one() : m.nav_now_count_other({ count }),
    icon: Lightning,
    exact: true,
  },
  {
    id: "contracts",
    to: "/contracts",
    label: m.nav_contracts,
    countLabel: (count) =>
      isOne(count)
        ? m.nav_contracts_count_one()
        : m.nav_contracts_count_other({ count }),
    icon: Files,
    exact: false,
  },
  {
    id: "installments",
    to: "/installments",
    label: m.nav_installments,
    countLabel: (count) =>
      isOne(count)
        ? m.nav_installments_count_one()
        : m.nav_installments_count_other({ count }),
    icon: CalendarBlank,
    exact: false,
  },
  {
    id: "people",
    to: "/people",
    label: m.nav_people,
    countLabel: (count) =>
      isOne(count)
        ? m.nav_people_count_one()
        : m.nav_people_count_other({ count }),
    icon: Users,
    exact: false,
  },
];

import { Files, type Icon, Lightning } from "@phosphor-icons/react";
import { pluralForm } from "@/lib/plural";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";

export interface NavItem {
  /** Accessible name with the sidebar's count, whose number is aria-hidden. Only for a count above 0. */
  countLabel: (count: number) => string;
  exact: boolean;
  icon: Icon;
  id: "contracts" | "now";
  label: () => string;
  to: "/" | "/contracts";
}

/** The numbers next to the sidebar items (mockups 02 and 08); 0 shows none. */
export type NavCounts = Record<NavItem["id"], number>;

const isOne = (count: number) => pluralForm(count, getLocale()) === "one";

// Parcelas (/installments) e Pessoas (/people) entram na Fase 4, quando as rotas existirem.
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
];

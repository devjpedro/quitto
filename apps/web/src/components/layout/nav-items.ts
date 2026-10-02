import { Files, type Icon, Lightning } from "@phosphor-icons/react";
import { m } from "@/paraglide/messages.js";

export interface NavItem {
  exact: boolean;
  icon: Icon;
  label: () => string;
  to: "/" | "/contracts";
}

// Parcelas (/installments) e Pessoas (/people) entram na Fase 4, quando as rotas existirem.
export const PRIMARY_NAV: NavItem[] = [
  { to: "/", label: m.nav_now, icon: Lightning, exact: true },
  { to: "/contracts", label: m.nav_contracts, icon: Files, exact: false },
];

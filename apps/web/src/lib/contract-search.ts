import {
  type InstallmentFilter,
  isInstallmentFilter,
} from "./installments-filter";

/**
 * The contract page's search: the installment to open in the drawer, and the
 * list's filter ("Ver parcelas" on a group of overdue ones opens it on
 * "overdue"). Anything else is dropped.
 */
export function contractSearch(search: Record<string, unknown>): {
  installment?: string;
  status?: InstallmentFilter;
} {
  return {
    installment:
      typeof search.installment === "string" ? search.installment : undefined,
    status: isInstallmentFilter(search.status) ? search.status : undefined,
  };
}

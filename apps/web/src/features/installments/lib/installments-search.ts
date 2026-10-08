export interface InstallmentsSearch {
  contract?: string;
  day?: string;
  filter?: "pay" | "receive" | "overdue" | "awaiting";
  installment?: string;
  month?: string;
  view?: "calendar";
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const FILTERS: readonly string[] = ["pay", "receive", "overdue", "awaiting"];

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Parcelas' search. `installment` and `contract` only count together (the
 * panel needs both); `day` only counts inside the month on screen; anything
 * else invalid is dropped.
 */
export function installmentsSearch(
  search: Record<string, unknown>
): InstallmentsSearch {
  const month =
    typeof search.month === "string" && MONTH.test(search.month)
      ? search.month
      : undefined;
  const rawDay =
    typeof search.day === "string" && DAY.test(search.day)
      ? search.day
      : undefined;
  const day =
    rawDay && (!month || rawDay.startsWith(month)) ? rawDay : undefined;
  const installment = text(search.installment);
  const contract = text(search.contract);
  const both = installment && contract;
  return {
    view: search.view === "calendar" ? "calendar" : undefined,
    month,
    day,
    filter:
      typeof search.filter === "string" && FILTERS.includes(search.filter)
        ? (search.filter as InstallmentsSearch["filter"])
        : undefined,
    installment: both ? installment : undefined,
    contract: both ? contract : undefined,
  };
}

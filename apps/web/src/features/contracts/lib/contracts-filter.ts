import type { ContractListItem } from "../types";
import type { ContractsListSearch } from "./contracts-list-search";

export interface ContractsFiltered {
  cards: ContractListItem[];
  counts: { active: number; done: number };
  totals: { payCents: number; receiveCents: number };
}

function isDone(item: ContractListItem): boolean {
  return item.settled || item.status === "completed";
}

/** Overdue first (the oldest first), then the next due date, then the title. */
function byUrgency(a: ContractListItem, b: ContractListItem): number {
  const overdueA = a.oldestOverdue?.dueDate ?? null;
  const overdueB = b.oldestOverdue?.dueDate ?? null;
  if (overdueA !== overdueB) {
    if (overdueA === null) {
      return 1;
    }
    if (overdueB === null) {
      return -1;
    }
    return overdueA < overdueB ? -1 : 1;
  }
  const nextA = a.next?.dueDate ?? "9999-12-31";
  const nextB = b.next?.dueDate ?? "9999-12-31";
  if (nextA !== nextB) {
    return nextA < nextB ? -1 : 1;
  }
  return a.title.localeCompare(b.title, "pt-BR");
}

function byEnd(a: ContractListItem, b: ContractListItem): number {
  return (b.endDate ?? "").localeCompare(a.endDate ?? "");
}

/**
 * What the list shows: Ativos or Concluídos, by side. A cancelled contract is
 * nowhere; a contract the user only follows shows in "Todos" and is out of
 * the totals. The segment counts respect the side filter.
 */
export function contractsFilter(
  items: ContractListItem[],
  { show, side }: ContractsListSearch
): ContractsFiltered {
  const bySide = items.filter(
    (item) => item.status !== "cancelled" && (!side || item.direction === side)
  );
  const done = bySide.filter(isDone);
  const active = bySide.filter((item) => !isDone(item));
  let payCents = 0;
  let receiveCents = 0;
  for (const item of active) {
    if (item.direction === "pay") {
      payCents += item.remainingCents;
    } else if (item.direction === "receive") {
      receiveCents += item.remainingCents;
    }
  }
  const showingDone = show === "done";
  return {
    cards: showingDone ? [...done].sort(byEnd) : [...active].sort(byUrgency),
    counts: { active: active.length, done: done.length },
    totals: { payCents, receiveCents },
  };
}

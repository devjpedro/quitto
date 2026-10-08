import { ArrowDownLeft, ArrowUpRight } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { ChipStrip, MoneyChip } from "@/components/ui/chip-strip";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { m } from "@/paraglide/messages.js";
import type { ContractsFiltered } from "../lib/contracts-filter";
import type { ContractsListSearch } from "../lib/contracts-list-search";

/**
 * The bar over the cards: Ativos | Concluídos, Todos | Pago | Recebo, and
 * what is left on the active ones, by direction and never summed (mockup 17, A).
 */
export function ContractsToolbar({
  counts,
  onChange,
  search,
  totals,
}: {
  counts: ContractsFiltered["counts"];
  onChange: (next: ContractsListSearch) => void;
  search: ContractsListSearch;
  totals: ContractsFiltered["totals"];
}) {
  const showingDone = search.show === "done";
  const chips: ReactNode[] = [];
  if (!showingDone && totals.receiveCents > 0) {
    chips.push(
      <MoneyChip
        cents={totals.receiveCents}
        icon={ArrowDownLeft}
        key="receive"
        label={m.contracts_total_receive()}
        tone="plain"
      />
    );
  }
  if (!showingDone && totals.payCents > 0) {
    chips.push(
      <MoneyChip
        cents={totals.payCents}
        icon={ArrowUpRight}
        key="pay"
        label={m.contracts_total_pay()}
        tone="plain"
      />
    );
  }
  return (
    <div
      className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center"
      data-testid="contracts-toolbar"
    >
      <div className="flex flex-col gap-2 md:flex-row md:gap-3">
        <div data-testid="contracts-show">
          <SegmentedControl
            block="mobile"
            label={m.contracts_show_label()}
            onValueChange={(show) =>
              onChange({
                ...search,
                show: show === "done" ? "done" : undefined,
              })
            }
            options={[
              {
                value: "active",
                label: m.contracts_show_active(),
                count: counts.active,
              },
              {
                value: "done",
                label: m.contracts_show_done(),
                count: counts.done,
              },
            ]}
            value={showingDone ? "done" : "active"}
          />
        </div>
        <div data-testid="contracts-side">
          <SegmentedControl
            block="mobile"
            label={m.contracts_side_label()}
            onValueChange={(side) =>
              onChange({
                ...search,
                side: side === "all" ? undefined : side,
              })
            }
            options={[
              { value: "all", label: m.contracts_side_all() },
              { value: "pay", label: m.contracts_side_pay() },
              { value: "receive", label: m.contracts_side_receive() },
            ]}
            value={search.side ?? "all"}
          />
        </div>
      </div>
      {chips.length > 0 ? (
        <div className="min-w-0 md:ml-auto" data-testid="contracts-totals">
          <ChipStrip label={m.contracts_totals_label()}>{chips}</ChipStrip>
        </div>
      ) : null}
    </div>
  );
}

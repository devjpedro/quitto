import type { ReactNode } from "react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { m } from "@/paraglide/messages.js";
import type { ContractTab } from "../hooks/use-contract-route";
import type { ContractDetail } from "../types";

/**
 * Parcelas · Pessoas · Histórico (mockup 14): no count on Parcelas, the
 * people's count on Pessoas. One control at every width: content-sized from
 * md, the whole width on a phone (the wrapper stretches the group and its
 * items, as the mockup's phone does). The tab's own action ("Convidar
 * pessoa", Task 8) sits at the end of the same row.
 */
export function ContractTabs({
  action,
  detail,
  onTabChange,
  tab,
}: {
  action?: ReactNode;
  detail: ContractDetail;
  onTabChange: (tab: ContractTab) => void;
  tab: ContractTab;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3"
      data-testid="contract-tabs"
    >
      <div className="max-md:w-full">
        <SegmentedControl
          block="mobile"
          label={m.contract_tabs_label()}
          onValueChange={onTabChange}
          options={[
            { value: "installments", label: m.contract_tab_installments() },
            {
              value: "people",
              label: m.contract_tab_people(),
              count: detail.participants.length,
            },
            { value: "history", label: m.contract_tab_history() },
          ]}
          value={tab}
        />
      </div>
      {action}
    </div>
  );
}

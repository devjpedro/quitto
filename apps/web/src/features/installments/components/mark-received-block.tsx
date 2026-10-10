import { HandCoins } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import type { ContractDetail } from "@/features/contracts/types";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useMarkReceivedMutation } from "../api";
import { PANEL_TONE, type PanelMode, usePanel } from "./panel-context";

/** "Recebeu por fora?" (owner's decision 2): whoever receives marks it at once (optimistic). */
export function MarkReceivedBlock({
  contract,
  mode,
}: {
  contract: ContractDetail;
  mode: PanelMode;
}) {
  const { contractId, installmentId, tryLock } = usePanel();
  const markReceived = useMarkReceivedMutation(
    contractId,
    contract.contract.requiresConfirmation
  );
  return (
    <div>
      <h3 className="mb-2 font-semibold text-[13px] text-ink">
        {m.panel_received_outside()}
      </h3>
      <Button
        className={cn("w-full", PANEL_TONE[mode].button)}
        disabled={markReceived.isPending}
        onClick={() => {
          if (tryLock()) {
            markReceived.mutate(installmentId);
          }
        }}
        variant="inset"
      >
        <HandCoins aria-hidden="true" size={16} />
        {m.home_action_mark_received()}
      </Button>
    </div>
  );
}

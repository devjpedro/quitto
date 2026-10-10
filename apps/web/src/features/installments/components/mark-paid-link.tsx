import { m } from "@/paraglide/messages.js";
import { useMarkPaidMutation } from "../api";
import { usePanel } from "./panel-context";

/**
 * "Marcar como paga sem comprovante" (a contract without confirmation):
 * marks at once, no question asked. Not while a proof is on its way (P7):
 * the proof would then land on a paid installment and fail.
 */
export function MarkPaidLink() {
  const { busy, contractId, installmentId, tryLock } = usePanel();
  const markPaid = useMarkPaidMutation(contractId);
  if (busy) {
    return null;
  }
  return (
    <button
      className="flex h-11 items-center self-start rounded-control text-[13px] text-ink underline decoration-1 underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand md:h-7"
      disabled={markPaid.isPending}
      onClick={() => {
        if (tryLock()) {
          markPaid.mutate(installmentId);
        }
      }}
      type="button"
    >
      {m.panel_mark_paid_link()}
    </button>
  );
}

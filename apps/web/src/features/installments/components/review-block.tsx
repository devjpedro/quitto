import { Check } from "@phosphor-icons/react";
import { useLayoutEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { ContractDetail } from "@/features/contracts/types";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useConfirmMutation } from "../api";
import { ContestForm } from "./contest-form";
import { PANEL_TONE, type PanelMode, usePanel } from "./panel-context";

/** "Confirmar recebimento", the panel's one primary for whoever reviews: optimistic, as "Já paguei". */
export function ConfirmButton({ className }: { className?: string }) {
  const { contractId, installmentId, tryLock } = usePanel();
  const confirm = useConfirmMutation(contractId);
  return (
    <Button
      className={className}
      disabled={confirm.isPending}
      onClick={() => {
        if (tryLock()) {
          confirm.mutate(installmentId);
        }
      }}
    >
      <Check aria-hidden="true" size={16} weight="bold" />
      {m.panel_confirm()}
    </Button>
  );
}

/**
 * P4's decision (mockup 14, frame A): confirm or dispute. "Contestar" opens
 * the reason in place of the two buttons. In the bottom sheet the confirm is
 * pinned in the footer, so only "Contestar" stays here. When the reason
 * closes (Cancelar, or sent) the focus it held goes back to "Contestar".
 */
export function ReviewBlock({
  contract,
  mode,
}: {
  contract: ContractDetail;
  mode: PanelMode;
}) {
  const { contestOpen, setContestOpen } = usePanel();
  const contestButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(contestOpen);
  // In the commit, before a focus scope's observer (the sheet's) moves it.
  useLayoutEffect(() => {
    const active = document.activeElement;
    if (wasOpen.current && !contestOpen && active === document.body) {
      contestButton.current?.focus();
    }
    wasOpen.current = contestOpen;
  }, [contestOpen]);
  if (contestOpen) {
    return <ContestForm contract={contract} mode={mode} />;
  }
  const contest = (
    <Button
      className={cn(PANEL_TONE[mode].button, mode === "bottom" && "w-full")}
      onClick={() => setContestOpen(true)}
      ref={contestButton}
      variant="inset"
    >
      {m.panel_contest()}
    </Button>
  );
  if (mode === "bottom") {
    return contest;
  }
  return (
    <div className="flex gap-2">
      <ConfirmButton className="flex-1" />
      {contest}
    </div>
  );
}

import { ConfirmDialog } from "@/components/ui/dialog";
import { m } from "@/paraglide/messages.js";
import type { ContractWizard } from "../hooks/use-contract-wizard";

/** The ✕ with something filled in (mockup 15 §1.4): the focus opens on "Continuar editando". */
export function DiscardDialog({ wizard }: { wizard: ContractWizard }) {
  return (
    <ConfirmDialog
      cancelLabel={m.wizard_discard_cancel()}
      confirmLabel={m.wizard_discard_confirm()}
      description={m.wizard_discard_description()}
      onConfirm={wizard.discard.confirm}
      onOpenChange={wizard.discard.setOpen}
      open={wizard.discard.open}
      pending={false}
      title={m.wizard_discard_title()}
      tone="danger"
    />
  );
}

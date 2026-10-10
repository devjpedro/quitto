import { CheckCircle } from "@phosphor-icons/react";
import { m } from "@/paraglide/messages.js";

/** "Paga · registrada ao criar o contrato": an installment that came in paid, with no proof asked. */
export function RegisteredNote() {
  return (
    <p
      className="flex items-center gap-2 font-medium text-[13px] text-ink-muted"
      data-testid="registered-note"
    >
      <CheckCircle
        aria-hidden="true"
        className="shrink-0 text-brand"
        size={18}
        weight="fill"
      />
      {m.panel_registered()}
    </p>
  );
}

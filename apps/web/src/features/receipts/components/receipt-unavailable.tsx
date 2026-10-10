import { LinkBreak } from "@phosphor-icons/react";
import { StateHeading } from "@/features/invites/components/state-heading";
import { useApiWarmup } from "@/hooks/use-api-warmup";
import { m } from "@/paraglide/messages.js";
import { ReceiptFrame } from "./receipt-frame";

/** A receipt that does not exist (or is not paid): the sentence, and no way to sign up from here. */
export function ReceiptUnavailable() {
  useApiWarmup();
  return (
    <ReceiptFrame>
      <div className="piece-shadow piece-rise w-full max-w-[440px] rounded-panel bg-surface p-7 text-ink">
        <StateHeading
          icon={LinkBreak}
          title={m.public_receipt_unavailable_title()}
          tone="neutral"
        >
          {m.public_receipt_unavailable_text()}
        </StateHeading>
      </div>
    </ReceiptFrame>
  );
}

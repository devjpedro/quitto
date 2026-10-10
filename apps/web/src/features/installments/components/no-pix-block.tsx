import { Key, Plus, WhatsappLogo } from "@phosphor-icons/react";
import type { MouseEvent } from "react";
import { buttonVariants } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import type { ContractDetail } from "@/features/contracts/types";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { pixRequestMessage, whatsappUrl } from "../lib/whatsapp-message";
import type { InstallmentDetail } from "../types";
import { PANEL_TONE, type PanelMode, usePanel } from "./panel-context";

/**
 * P2 (mockup 14, frame G): neither the contact nor an account has a key.
 * The one sentence says why; the owner may keep the contact's key (only for
 * a contact without an account), and anyone who pays may ask for it.
 */
export function NoPixBlock({
  contract,
  detail,
  mode,
  onSave,
}: {
  contract: ContractDetail;
  detail: InstallmentDetail;
  mode: PanelMode;
  onSave: () => void;
}) {
  const { tryLock } = usePanel();
  const tone = PANEL_TONE[mode];
  const name = detail.receiver.name;
  const first = name?.split(" ")[0] ?? "";
  const canSave = contract.isOwner && detail.receiver.contactParticipantId;
  const button = cn(
    buttonVariants({ variant: "inset" }),
    tone.innerButton,
    "min-w-0 flex-[1_0_auto]"
  );
  const ask = whatsappUrl(
    pixRequestMessage(
      { contractTitle: contract.contract.title, sequence: detail.sequence },
      getLocale()
    )
  );
  return (
    <div
      className={cn("rounded-card p-3.5", tone.block)}
      data-testid="no-pix-block"
    >
      <div className="flex items-start gap-2.5">
        <IconTile className={tone.inner} icon={Key} tone="neutral" />
        <p className="min-w-0 pt-0.5">
          <span className="block font-semibold text-[13.5px] text-ink">
            {name
              ? m.panel_no_pix_title({ name })
              : m.panel_no_pix_title_unknown()}
          </span>{" "}
          <span className="mt-0.5 block text-[12.5px] text-ink-muted leading-[1.45]">
            {detail.receiver.hasAccount
              ? m.panel_no_pix_reason_account()
              : m.panel_no_pix_reason()}
          </span>
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {canSave ? (
          <button className={button} onClick={onSave} type="button">
            <Plus aria-hidden="true" size={16} />
            {m.panel_no_pix_save({ name: first })}
          </button>
        ) : null}
        <a
          className={button}
          href={ask}
          onClick={(event: MouseEvent) => {
            if (!tryLock()) {
              event.preventDefault();
            }
          }}
          rel="noopener noreferrer"
          target="_blank"
        >
          <WhatsappLogo aria-hidden="true" size={16} />
          {m.panel_no_pix_ask()}
        </a>
      </div>
    </div>
  );
}

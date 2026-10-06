import { Copy, QrCode } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { pixKeyTypeLabel } from "../lib/pix-key-type";
import { timeLabel } from "../lib/status-trail";
import { ContactKeyForm } from "./contact-key-form";
import { NoPixBlock } from "./no-pix-block";
import type { PanelBlockProps } from "./panel-blocks";
import { PANEL_TONE, type PanelMode, usePanel } from "./panel-context";
import { CodeLine, FullPix, type Pix, PixQr, useCopyCode } from "./pix-parts";

/**
 * P1 in the bottom sheet (DIRECAO › Contrato): "Copiar código PIX" is the
 * main button (the sheet's first focus) and the QR stays folded until
 * "Mostrar o QR code". The contact's "Editar" is not here (mockup 14, frame E).
 */
function PhonePix({ name, pix }: { name: string; pix: Pix }) {
  const [qr, setQr] = useState(false);
  const copyCode = useCopyCode(pix.copiaECola);
  const tone = PANEL_TONE.bottom;
  const meta = m.contract_join({
    left: pixKeyTypeLabel(pix.keyType),
    right: pix.key,
  });
  return (
    <>
      <div className="flex items-start gap-2.5">
        <IconTile className={tone.inner} icon={QrCode} tone="neutral" />
        <p className="min-w-0 pt-0.5">
          <span className="block font-semibold text-[13.5px] text-ink">
            {m.panel_pix_of_name({ name })}
          </span>{" "}
          <span className="block text-[12.5px] text-ink-muted leading-[1.4] [overflow-wrap:anywhere]">
            {pix.source === "contact"
              ? m.contract_join({
                  left: meta,
                  right: m.panel_pix_from_contact(),
                })
              : meta}
          </span>
        </p>
      </div>
      <CodeLine mode="bottom" pix={pix} />
      {qr ? (
        <PixQr
          className="mx-auto mt-3 size-40 rounded-[10px] p-2"
          code={pix.copiaECola}
          label={m.panel_pix_qr_label({ name })}
        />
      ) : null}
      <Button className="mt-2.5 w-full" onClick={copyCode}>
        <Copy aria-hidden="true" size={16} />
        {m.panel_pix_copy_code()}
      </Button>
      {qr ? null : (
        <button
          className="mx-auto mt-1 flex h-11 items-center px-2 text-[13px] text-ink underline decoration-1 underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          onClick={() => setQr(true)}
          type="button"
        >
          {m.panel_pix_show_qr()}
        </button>
      )}
    </>
  );
}

/** P7: while a proof goes (or failed), the Pix folds to one line; "Ver QR" opens it again. */
function FoldedPix({
  mode,
  name,
  onOpen,
  pix,
}: {
  mode: PanelMode;
  name: string;
  onOpen: () => void;
  pix: Pix;
}) {
  const { copiedAt } = usePanel();
  const tone = PANEL_TONE[mode];
  return (
    <div className="flex items-center gap-3">
      <PixQr className="size-10 rounded-lg p-[3px]" code={pix.copiaECola} />
      <p className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-[13.5px] text-ink">
          {m.panel_pix_of_name({ name })}
        </span>{" "}
        {copiedAt ? (
          <span className="block text-ink-muted text-xs tabular-nums">
            {m.panel_pix_copied_at({ time: timeLabel(copiedAt, getLocale()) })}
          </span>
        ) : null}
      </p>
      <Button
        className={cn("md:h-8", tone.innerButton)}
        onClick={onOpen}
        size="sm"
        variant="inset"
      >
        <QrCode aria-hidden="true" size={15} />
        {m.panel_pix_see_qr()}
      </Button>
    </div>
  );
}

/**
 * P1 (mockup 14, frame G): pay whoever receives, with the key of their
 * account or the one kept on the contact. With no key at all it is P2
 * (NoPixBlock); the owner's "Editar" and "Guardar a chave" open the form in
 * the block's place.
 */
export function PixBlock({ contract, detail, mode }: PanelBlockProps) {
  const { upload } = usePanel();
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const { pix } = detail;
  const contactId = detail.receiver.contactParticipantId;
  const name = detail.receiver.name ?? pix?.payToName ?? "";
  const first = name.split(" ")[0] ?? name;
  const edit = contract.isOwner && contactId ? () => setEditing(true) : null;
  if (editing && contactId) {
    return (
      <ContactKeyForm
        initial={pix?.key ?? ""}
        mode={mode}
        name={first}
        onDone={() => setEditing(false)}
        participantId={contactId}
      />
    );
  }
  if (!pix) {
    return detail.pixMissing ? (
      <NoPixBlock
        contract={contract}
        detail={detail}
        mode={mode}
        onSave={() => setEditing(true)}
      />
    ) : null;
  }
  const folded =
    !open &&
    (upload.state.phase === "uploading" || upload.state.phase === "error");
  let body = <FullPix mode={mode} name={name} onEdit={edit} pix={pix} />;
  if (folded) {
    body = (
      <FoldedPix
        mode={mode}
        name={name}
        onOpen={() => setOpen(true)}
        pix={pix}
      />
    );
  } else if (mode === "bottom") {
    body = <PhonePix name={name} pix={pix} />;
  }
  return (
    <div
      className={cn(
        "rounded-card",
        folded ? "p-2.5 pr-3" : "p-3.5",
        PANEL_TONE[mode].block
      )}
      data-testid="pix-block"
    >
      {body}
    </div>
  );
}

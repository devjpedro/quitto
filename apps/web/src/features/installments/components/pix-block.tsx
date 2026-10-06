import { AddressBook, Copy, QrCode } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { renderSVG } from "uqr";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { useCopy } from "@/hooks/use-copy";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { pixKeyTypeLabel } from "../lib/pix-key-type";
import { timeLabel } from "../lib/status-trail";
import type { InstallmentDetail } from "../types";
import { ContactKeyForm } from "./contact-key-form";
import { NoPixBlock } from "./no-pix-block";
import type { PanelBlockProps } from "./panel-blocks";
import { PANEL_TONE, type PanelMode, usePanel } from "./panel-context";

type Pix = NonNullable<InstallmentDetail["pix"]>;

const DOT = () => ` ${m.home_dot_after({ text: "" }).trim()} `;

/**
 * The code as a QR, always on white (any theme) so a bank's reader gets the
 * contrast; uqr's border keeps the quiet zone. Decorative without a label
 * (the folded line's, beside its name).
 */
function PixQr({
  className,
  code,
  label,
}: {
  className?: string;
  code: string;
  label?: string;
}) {
  const svg = useMemo(() => renderSVG(code, { border: 2 }), [code]);
  const frame = cn(
    "shrink-0 bg-white [&>svg]:block [&>svg]:size-full",
    className
  );
  if (!label) {
    return (
      <div
        aria-hidden="true"
        className={frame}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: svg gerado por uqr a partir de dados nossos, sem HTML de usuário
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }
  return (
    <div
      aria-label={label}
      className={frame}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: svg gerado por uqr a partir de dados nossos, sem HTML de usuário
      dangerouslySetInnerHTML={{ __html: svg }}
      role="img"
    />
  );
}

/** "Copiar" copies the code, says so, and marks when (the collapsed line shows it). */
function useCopyCode(code: string) {
  const { markCopied, tryLock } = usePanel();
  const copy = useCopy();
  return async () => {
    if (!tryLock()) {
      return;
    }
    await copy(code, m.panel_pix_copied());
    markCopied();
  };
}

/** The copy-and-paste code on one line, with "Copiar" beside it on the docked and side panels. */
function CodeLine({ mode, pix }: { mode: PanelMode; pix: Pix }) {
  const copyCode = useCopyCode(pix.copiaECola);
  const tone = PANEL_TONE[mode];
  return (
    <div
      className={cn(
        "mt-3 flex h-11 min-w-0 items-center gap-2 rounded-control pr-1 pl-3 md:h-10",
        mode === "bottom" && "pr-3",
        tone.inner
      )}
    >
      <span className="min-w-0 flex-1 truncate font-mono text-ink-muted text-xs">
        {pix.copiaECola}
      </span>
      {mode === "bottom" ? null : (
        <Button
          aria-label={m.panel_pix_copy_code()}
          className={cn("md:h-8", tone.button)}
          onClick={copyCode}
          size="sm"
          variant="inset"
        >
          <Copy aria-hidden="true" size={15} />
          {m.panel_pix_copy()}
        </Button>
      )}
    </div>
  );
}

/** "guardada no contato · Editar": where a contact's key comes from; only the owner edits it. */
function ContactSource({ onEdit }: { onEdit: (() => void) | null }) {
  return (
    <span className="mt-2.5 flex items-center gap-1.5 text-[12.5px] text-ink-muted">
      <AddressBook aria-hidden="true" className="shrink-0" size={14} />
      <span>
        {m.panel_pix_from_contact()}
        {onEdit ? (
          <>
            {DOT()}
            <EditButton onEdit={onEdit} />
          </>
        ) : null}
      </span>
    </span>
  );
}

function EditButton({ onEdit }: { onEdit: () => void }) {
  return (
    <button
      // The word is small; the target is not (≥ 44 px below md).
      className="relative text-ink underline decoration-1 underline-offset-[3px] after:absolute after:-inset-x-2 after:-inset-y-3 after:rounded-control focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-brand md:after:-inset-y-1"
      onClick={onEdit}
      type="button"
    >
      {m.panel_pix_edit()}
    </button>
  );
}

/** P1 on the docked column and the floating panel: the QR beside whose key it is. */
function FullPix({
  mode,
  name,
  onEdit,
  pix,
}: {
  mode: PanelMode;
  name: string;
  onEdit: (() => void) | null;
  pix: Pix;
}) {
  return (
    <>
      <div className="flex items-start gap-3.5">
        <PixQr
          className="size-28 rounded-[10px] p-1.5"
          code={pix.copiaECola}
          label={m.panel_pix_qr_label({ name })}
        />
        <p className="min-w-0 flex-1 pt-0.5">
          <span className="block text-ink-muted text-xs">
            {m.panel_pix_of()}
          </span>{" "}
          <span className="mt-px block font-semibold text-[15px] text-ink">
            {name}
          </span>{" "}
          <span className="mt-1.5 block text-[12.5px] text-ink-muted leading-[1.4] [overflow-wrap:anywhere]">
            {pixKeyTypeLabel(pix.keyType)}
            <br />
            {pix.key}
          </span>
          {pix.source === "contact" ? <ContactSource onEdit={onEdit} /> : null}
        </p>
      </div>
      <CodeLine mode={mode} pix={pix} />
    </>
  );
}

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

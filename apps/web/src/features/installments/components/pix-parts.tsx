import { AddressBook, Copy } from "@phosphor-icons/react";
import { useMemo } from "react";
import { renderSVG } from "uqr";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/hooks/use-copy";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { pixKeyTypeLabel } from "../lib/pix-key-type";
import type { InstallmentDetail } from "../types";
import { PANEL_TONE, type PanelMode, usePanel } from "./panel-context";

export type Pix = NonNullable<InstallmentDetail["pix"]>;

export const DOT = () => ` ${m.home_dot_after({ text: "" }).trim()} `;

/**
 * The code as a QR, always on white (any theme) so a bank's reader gets the
 * contrast; uqr's border keeps the quiet zone. Decorative without a label
 * (the folded line's, beside its name).
 */
export function PixQr({
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
export function useCopyCode(code: string) {
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
export function CodeLine({ mode, pix }: { mode: PanelMode; pix: Pix }) {
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

export function EditButton({ onEdit }: { onEdit: () => void }) {
  return (
    <button
      // The word is small; the target is not (≥ 44 px below md).
      className="relative text-ink underline decoration-1 underline-offset-[3px] after:absolute after:-inset-x-2 after:-inset-y-3.5 after:rounded-control focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-brand md:after:-inset-y-1"
      onClick={onEdit}
      type="button"
    >
      {m.panel_pix_edit()}
    </button>
  );
}

/** P1 on the docked column and the floating panel: the QR beside whose key it is. */
export function FullPix({
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
          className="size-28 rounded-control p-1.5"
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

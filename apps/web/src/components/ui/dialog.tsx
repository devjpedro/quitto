import { X } from "@phosphor-icons/react";
import { Dialog as RadixDialog } from "radix-ui";
import { type ReactNode, useRef } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { m } from "@/paraglide/messages.js";

/**
 * A centered dialog in the Tátil look: white, 20 px corners, the float
 * shadow, up to 460 px; on a phone it sits at the bottom, full width. Used for
 * short forms and confirmations; the installment itself is a sheet.
 */
export function Dialog({
  children,
  description,
  footer,
  onCloseAutoFocus,
  onOpenAutoFocus,
  onOpenChange,
  open,
  title,
}: {
  children?: ReactNode;
  description?: string;
  footer?: ReactNode;
  onCloseAutoFocus?: (event: Event) => void;
  onOpenAutoFocus?: (event: Event) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}) {
  return (
    <RadixDialog.Root onOpenChange={onOpenChange} open={open}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <RadixDialog.Content
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[91dvh] flex-col rounded-t-panel bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-ink shadow-float focus:outline-none md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[460px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-panel"
          onCloseAutoFocus={onCloseAutoFocus}
          onOpenAutoFocus={onOpenAutoFocus}
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <div className="pr-10">
            <RadixDialog.Title className="font-display font-semibold text-[19px] leading-tight tracking-[-0.02em]">
              {title}
            </RadixDialog.Title>
            {description ? (
              <RadixDialog.Description className="mt-1.5 text-ink-muted text-sm leading-[1.45]">
                {description}
              </RadixDialog.Description>
            ) : null}
          </div>
          {children ? (
            <div className="mt-4 min-h-0 overflow-y-auto">{children}</div>
          ) : null}
          {footer ? (
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              {footer}
            </div>
          ) : null}
          <RadixDialog.Close asChild>
            <IconButton
              className="absolute top-3 right-3"
              icon={X}
              label={m.sheet_close()}
            />
          </RadixDialog.Close>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/** A yes/no question. Opens with the focus on Cancel, never on the destructive action. */
export function ConfirmDialog({
  cancelLabel,
  confirmLabel,
  description,
  onCloseAutoFocus,
  onConfirm,
  onOpenChange,
  open,
  pending,
  title,
  tone,
}: {
  cancelLabel: string;
  confirmLabel: string;
  description: string;
  onCloseAutoFocus?: (event: Event) => void;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pending: boolean;
  title: string;
  tone: "danger" | "primary";
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      description={description}
      footer={
        <>
          <Button
            onClick={() => onOpenChange(false)}
            ref={cancelRef}
            variant="ghost"
          >
            {cancelLabel}
          </Button>
          <Button
            disabled={pending}
            onClick={onConfirm}
            variant={tone === "danger" ? "danger" : "primary"}
          >
            {confirmLabel}
          </Button>
        </>
      }
      onCloseAutoFocus={onCloseAutoFocus}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        cancelRef.current?.focus();
      }}
      onOpenChange={onOpenChange}
      open={open}
      title={title}
    />
  );
}

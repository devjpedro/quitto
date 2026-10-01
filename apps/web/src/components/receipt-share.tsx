import {
  APP_TIME_ZONE,
  type InstallmentStatus,
  isoDateInTimeZone,
  isPaidStatus,
} from "@quitto/shared";
import { Copy, Link2, Mail, MessageCircle, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFocusOnOpen, useFocusRestore } from "@/hooks/use-focus-restore";
import {
  useCreateReceiptShareMutation,
  useReceiptShareQuery,
  useRevokeReceiptShareMutation,
} from "@/hooks/use-receipt-share";
import { FEEDBACK } from "@/lib/feedback";
import { formatISODateBR } from "@/lib/format";
import {
  mailtoShareUrl,
  receiptPublicUrl,
  receiptShareMessage,
  whatsappShareUrl,
} from "@/lib/receipt-share";

interface ReceiptShareProps {
  installmentId: string;
  installmentsCount: number;
  isOwner: boolean;
  sequence: number;
  status: InstallmentStatus;
  title: string;
}

/** Link público do recibo (ADR-0006): só dono, só parcela paga. */
export function ReceiptShare(props: ReceiptShareProps) {
  const { installmentId, isOwner, status } = props;
  const enabled = isOwner && isPaidStatus(status);
  const query = useReceiptShareQuery(installmentId, enabled);
  const create = useCreateReceiptShareMutation(installmentId);
  const revoke = useRevokeReceiptShareMutation(installmentId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { triggerRef, restoreFocus } = useFocusRestore();
  const { focusRef, focusOnOpen } = useFocusOnOpen();

  if (!enabled) {
    return null;
  }
  const active = query.data ?? null;
  const token = active?.token ?? null;

  // O Radix abre o menu no pointerdown; por isso o controle é feito aqui: sem
  // token, cria o link primeiro e só então abre (nunca mostra itens sem URL).
  async function onMenuOpenChange(next: boolean) {
    if (!next || token) {
      setMenuOpen(next);
      return;
    }
    try {
      await create.mutateAsync();
      setMenuOpen(true);
    } catch {
      // Falha (409/rede): o handler global de mutação já exibe o toast.
    }
  }

  async function onRevoke() {
    try {
      await revoke.mutateAsync();
      setConfirmOpen(false);
    } catch {
      // O handler global de mutação já exibe o toast; o diálogo segue aberto.
    }
  }

  const url = token ? receiptPublicUrl(window.location.origin, token) : "";
  const message = receiptShareMessage({
    sequence: props.sequence,
    installmentsCount: props.installmentsCount,
    title: props.title,
    url,
  });
  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        Recibo público
      </h3>
      {active ? (
        <p className="flex items-center gap-1.5 text-muted-foreground text-sm">
          <Link2 aria-hidden="true" className="size-4" />
          Link público ativo · criado em{" "}
          {formatISODateBR(
            isoDateInTimeZone(new Date(active.createdAt), APP_TIME_ZONE)
          )}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <DropdownMenu onOpenChange={onMenuOpenChange} open={menuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              className="min-h-11 gap-2"
              disabled={create.isPending}
              ref={triggerRef}
              type="button"
              variant="outline"
            >
              <Share2 aria-hidden="true" className="size-4" />
              Compartilhar recibo
            </Button>
          </DropdownMenuTrigger>
          {token ? (
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                className="min-h-11"
                onSelect={async () => {
                  try {
                    await navigator.clipboard.writeText(url);
                    toast.success(FEEDBACK.receiptLinkCopied);
                  } catch {
                    toast.error("Não foi possível copiar o link");
                  }
                }}
              >
                <Copy aria-hidden="true" className="size-4" />
                Copiar link
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="min-h-11">
                <a
                  href={whatsappShareUrl(message)}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <MessageCircle aria-hidden="true" className="size-4" />
                  WhatsApp
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="min-h-11">
                <a
                  href={mailtoShareUrl({
                    title: props.title,
                    sequence: props.sequence,
                    installmentsCount: props.installmentsCount,
                    message,
                  })}
                >
                  <Mail aria-hidden="true" className="size-4" />
                  E-mail
                </a>
              </DropdownMenuItem>
              {canNativeShare ? (
                <DropdownMenuItem
                  className="min-h-11"
                  onSelect={() => {
                    navigator
                      .share({ text: message, url })
                      .catch(() => undefined);
                  }}
                >
                  <Share2 aria-hidden="true" className="size-4" />
                  Compartilhar…
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          ) : null}
        </DropdownMenu>
        {active ? (
          <Button
            className="min-h-11"
            onClick={() => setConfirmOpen(true)}
            type="button"
            variant="ghost"
          >
            Revogar link
          </Button>
        ) : null}
      </div>

      <Dialog onOpenChange={setConfirmOpen} open={confirmOpen}>
        <DialogContent
          description="Quem tiver o link não vai mais conseguir ver o recibo."
          onCloseAutoFocus={restoreFocus}
          onOpenAutoFocus={focusOnOpen}
          title="Revogar link do recibo?"
        >
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setConfirmOpen(false)}
              ref={focusRef}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button
              disabled={revoke.isPending}
              onClick={onRevoke}
              type="button"
              variant="destructive"
            >
              Revogar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

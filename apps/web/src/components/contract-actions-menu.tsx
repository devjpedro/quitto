import { useNavigate } from "@tanstack/react-router";
import { LogOut, MoreVertical, Trash2 } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useDeleteContractMutation,
  useLeaveContractMutation,
} from "@/hooks/use-contract-mutations";

/** Owner deletes the contract; a non-owner participant leaves it. Both confirm first. */
export function ContractActionsMenu({
  contractId,
  isOwner,
}: {
  contractId: string;
  isOwner: boolean;
}) {
  const navigate = useNavigate();
  const deleteMutation = useDeleteContractMutation();
  const leaveMutation = useLeaveContractMutation(contractId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pending = deleteMutation.isPending || leaveMutation.isPending;
  // The confirm dialog is opened from a DropdownMenuItem, which unmounts when
  // the dropdown closes — so there is no stable in-DOM trigger to restore focus
  // to. The dropdown hands focus back to its own trigger (the "Ações do
  // contrato" button) as it closes, so by the time the dialog opens that button
  // is the active element. Capture it and restore it in onCloseAutoFocus, or
  // Radix drops focus on <body> (WCAG 2.4.3 Focus Order).
  const triggerRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (confirmOpen) {
      triggerRef.current = document.activeElement as HTMLElement | null;
    }
  }, [confirmOpen]);

  async function onConfirm() {
    if (isOwner) {
      await deleteMutation.mutateAsync(contractId);
    } else {
      await leaveMutation.mutateAsync();
    }
    setConfirmOpen(false);
    navigate({ to: "/contracts" });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Ações do contrato" asChild>
          <Button size="icon" type="button" variant="ghost">
            <MoreVertical aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setConfirmOpen(true)}>
            {isOwner ? (
              <>
                <Trash2 aria-hidden="true" className="size-4" />
                Excluir contrato
              </>
            ) : (
              <>
                <LogOut aria-hidden="true" className="size-4" />
                Sair do contrato
              </>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog onOpenChange={setConfirmOpen} open={confirmOpen}>
        <DialogContent
          description={
            isOwner
              ? "Excluir este contrato é permanente: parcelas, comprovantes e histórico serão apagados."
              : "Você deixará de ter acesso a este contrato."
          }
          onCloseAutoFocus={(e) => {
            if (triggerRef.current?.isConnected) {
              e.preventDefault();
              triggerRef.current.focus();
            }
          }}
          title={isOwner ? "Excluir contrato" : "Sair do contrato"}
        >
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={pending}
              onClick={onConfirm}
              type="button"
              variant="destructive"
            >
              {isOwner ? "Excluir" : "Sair"}
            </Button>
            <Button
              onClick={() => setConfirmOpen(false)}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

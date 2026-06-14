import { useNavigate } from "@tanstack/react-router";
import { LogOut, MoreVertical, Trash2 } from "lucide-react";
import { useState } from "react";
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

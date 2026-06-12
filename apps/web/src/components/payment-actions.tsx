import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useConfirmPaymentMutation,
  useDisputePaymentMutation,
  useMarkPaidMutation,
} from "@/hooks/use-payment-mutations";
import { availableActions } from "@/lib/installment-actions";

export function PaymentActions({
  contractId,
  installmentId,
  contractRole,
  requiresConfirmation,
  status,
}: {
  contractId: string;
  installmentId: string;
  contractRole: string;
  requiresConfirmation: boolean;
  status: string;
}) {
  const actions = availableActions(contractRole, requiresConfirmation, status);
  const confirmMutation = useConfirmPaymentMutation(contractId, installmentId);
  const disputeMutation = useDisputePaymentMutation(contractId, installmentId);
  const markPaidMutation = useMarkPaidMutation(contractId, installmentId);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState("");

  async function onConfirm() {
    await confirmMutation.mutateAsync();
    setConfirmOpen(false);
  }

  async function onDispute() {
    const trimmed = reason.trim();
    await disputeMutation.mutateAsync(trimmed === "" ? undefined : trimmed);
    setDisputeOpen(false);
    setReason("");
  }

  if (!(actions.canConfirm || actions.canDispute || actions.canMarkPaid)) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {actions.canMarkPaid ? (
        <Button
          disabled={markPaidMutation.isPending}
          onClick={() => markPaidMutation.mutateAsync()}
          type="button"
        >
          {markPaidMutation.isPending ? "Marcando…" : "Marcar como paga"}
        </Button>
      ) : null}

      {actions.canConfirm ? (
        <Button onClick={() => setConfirmOpen(true)} type="button">
          Confirmar pagamento
        </Button>
      ) : null}

      {actions.canDispute ? (
        <Button
          onClick={() => setDisputeOpen(true)}
          type="button"
          variant="outline"
        >
          Contestar
        </Button>
      ) : null}

      <Dialog onOpenChange={setConfirmOpen} open={confirmOpen}>
        <DialogContent
          description="Esta ação marca a parcela como confirmada e paga."
          title="Confirmar pagamento"
        >
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={confirmMutation.isPending}
              onClick={onConfirm}
              type="button"
            >
              {confirmMutation.isPending ? "Confirmando…" : "Confirmar"}
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

      <Dialog onOpenChange={setDisputeOpen} open={disputeOpen}>
        <DialogContent
          description="Diga o motivo (opcional). O comprador poderá reenviar o comprovante."
          title="Contestar pagamento"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dispute-reason">Motivo (opcional)</Label>
            <Textarea
              id="dispute-reason"
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: não identifiquei o valor na conta"
              value={reason}
            />
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={disputeMutation.isPending}
              onClick={onDispute}
              type="button"
              variant="destructive"
            >
              {disputeMutation.isPending ? "Enviando…" : "Enviar contestação"}
            </Button>
            <Button
              onClick={() => setDisputeOpen(false)}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

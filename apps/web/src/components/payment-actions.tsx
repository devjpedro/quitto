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
import { availableActions, type Capabilities } from "@/lib/installment-actions";
import { PLACEHOLDER } from "@/lib/labels";

export function PaymentActions({
  contractId,
  installmentId,
  capabilities,
  requiresConfirmation,
  status,
}: {
  contractId: string;
  installmentId: string;
  capabilities: Capabilities;
  requiresConfirmation: boolean;
  status: string;
}) {
  const actions = availableActions(capabilities, requiresConfirmation, status);
  const confirmMutation = useConfirmPaymentMutation(contractId, installmentId);
  const disputeMutation = useDisputePaymentMutation(contractId, installmentId);
  const markPaidMutation = useMarkPaidMutation(contractId, installmentId);

  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState("");

  async function onMarkPaid() {
    await markPaidMutation.mutateAsync();
    setMarkPaidOpen(false);
  }

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
        <Button onClick={() => setMarkPaidOpen(true)} type="button">
          Marcar como paga
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

      <Dialog onOpenChange={setMarkPaidOpen} open={markPaidOpen}>
        <DialogContent
          description="Esta ação marca a parcela como paga e não pode ser desfeita."
          title="Marcar como paga"
        >
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={markPaidMutation.isPending}
              onClick={onMarkPaid}
              type="button"
            >
              {markPaidMutation.isPending ? "Marcando…" : "Marcar como paga"}
            </Button>
            <Button
              onClick={() => setMarkPaidOpen(false)}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
              placeholder={PLACEHOLDER.disputeReason}
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

import { zodResolver } from "@hookform/resolvers/zod";
import {
  INSTALLMENT_STATUS,
  type UpdateInstallmentInput,
  updateInstallmentSchema,
} from "@quitto/shared";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import {
  type AuditEventView,
  AuditTimeline,
} from "@/components/audit-timeline";
import { CurrencyField } from "@/components/currency-field";
import { DateField } from "@/components/date-field";
import { PaymentActions } from "@/components/payment-actions";
import { ProofList, type ProofView } from "@/components/proof-list";
import { ProofUpload } from "@/components/proof-upload";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useUpdateInstallmentMutation } from "@/hooks/use-contract-mutations";
import { useInstallmentQuery } from "@/hooks/use-installment";
import { formatBRL, formatISODateBR } from "@/lib/format";
import { availableActions, type Capabilities } from "@/lib/installment-actions";
import { buildInstallmentPatch } from "@/lib/installment-form";

interface Installment {
  amountCents: number;
  dueDate: string;
  id: string;
  sequence: number;
  status: string;
}

/** Owner-only edit of amount/dueDate. Mounts on demand so defaults pre-fill. */
function InstallmentEditForm({
  contractId,
  installment,
  onDone,
}: {
  contractId: string;
  installment: Installment;
  onDone: () => void;
}) {
  const updateMutation = useUpdateInstallmentMutation(contractId);
  // Pre-fill only the amount; leave dueDate empty so an untouched field is not
  // sent. Typing a date opts into changing it.
  const form = useForm<UpdateInstallmentInput>({
    resolver: zodResolver(updateInstallmentSchema),
    defaultValues: { amountCents: installment.amountCents },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await updateMutation.mutateAsync({
      installmentId: installment.id,
      body: buildInstallmentPatch(values),
    });
    onDone();
  });

  return (
    <FormProvider {...form}>
      <form className="flex flex-1 flex-col gap-5" onSubmit={onSubmit}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="amount">Valor</Label>
          <CurrencyField id="amount" name="amountCents" />
          {form.formState.errors.amountCents ? (
            <p className="text-destructive text-xs">
              {form.formState.errors.amountCents.message}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="due">Vencimento</Label>
          <DateField id="due" name="dueDate" />
          {form.formState.errors.dueDate ? (
            <p className="text-destructive text-xs">
              {form.formState.errors.dueDate.message}
            </p>
          ) : null}
        </div>
        {form.formState.errors.root ? (
          <p className="text-destructive text-xs">
            {form.formState.errors.root.message}
          </p>
        ) : null}
        <div className="mt-auto flex gap-2 border-border/60 border-t pt-4">
          <Button
            className="flex-1"
            disabled={updateMutation.isPending}
            type="submit"
          >
            {updateMutation.isPending ? "Salvando…" : "Salvar"}
          </Button>
          <Button
            disabled={updateMutation.isPending}
            onClick={onDone}
            type="button"
            variant="outline"
          >
            Cancelar
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}

/** Read-only detail + role-aware payment flow (upload, actions, proofs, history). */
function InstallmentDetailView({
  capabilities,
  contractId,
  events,
  installment,
  isOwner,
  onEdit,
  proofs,
  requiresConfirmation,
  status,
}: {
  capabilities: Capabilities;
  contractId: string;
  events: AuditEventView[];
  installment: Installment;
  isOwner: boolean;
  onEdit: () => void;
  proofs: ProofView[];
  requiresConfirmation: boolean;
  status: string;
}) {
  const actions = availableActions(capabilities, requiresConfirmation, status);

  return (
    <div className="flex flex-1 flex-col gap-5 overflow-y-auto">
      <dl className="divide-y divide-border/60 rounded-xl border border-border bg-card shadow-xs">
        <div className="flex items-baseline justify-between p-4">
          <dt className="text-muted-foreground text-sm">Valor</dt>
          <dd className="font-bold font-display text-foreground text-lg tabular-nums">
            {formatBRL(installment.amountCents)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between p-4">
          <dt className="text-muted-foreground text-sm">Vencimento</dt>
          <dd className="font-display font-semibold text-foreground tabular-nums">
            {formatISODateBR(installment.dueDate)}
          </dd>
        </div>
      </dl>

      {isOwner ? (
        <Button
          className="gap-2"
          onClick={onEdit}
          type="button"
          variant="ghost"
        >
          <Pencil className="size-4" />
          Editar parcela
        </Button>
      ) : null}

      {actions.canUpload ? (
        <section className="flex flex-col gap-2">
          <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            {status === INSTALLMENT_STATUS.disputed
              ? "Reenviar comprovante"
              : "Enviar comprovante"}
          </h3>
          <ProofUpload contractId={contractId} installmentId={installment.id} />
        </section>
      ) : null}

      <PaymentActions
        capabilities={capabilities}
        contractId={contractId}
        installmentId={installment.id}
        requiresConfirmation={requiresConfirmation}
        status={status}
      />

      <section className="flex flex-col gap-2">
        <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Comprovantes
        </h3>
        <ProofList proofs={proofs} />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Histórico
        </h3>
        <AuditTimeline events={events} />
      </section>
    </div>
  );
}

export function InstallmentDrawer({
  capabilities,
  contractId,
  installment,
  isOwner,
  onClose,
  open,
  requiresConfirmation,
}: {
  capabilities: Capabilities;
  contractId: string;
  installment: Installment | null;
  isOwner: boolean;
  onClose: () => void;
  open: boolean;
  requiresConfirmation: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const detailQuery = useInstallmentQuery(
    installment?.id ?? "",
    open && !!installment
  );

  if (!installment) {
    return null;
  }

  // Detail (status/proofs/events) is the source of truth; fall back to the
  // list summary while it loads.
  const detail = detailQuery.data;
  const status = detail?.status ?? installment.status;
  const proofs = detail?.proofs ?? [];
  const events = detail?.events ?? [];

  return (
    <Sheet
      onOpenChange={(o) => {
        if (!o) {
          setEditing(false);
          onClose();
        }
      }}
      open={open}
    >
      <SheetContent title={`Parcela ${installment.sequence}`}>
        <div className="flex items-center justify-between">
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            {editing ? "Editando" : "Detalhes"}
          </p>
          <StatusBadge status={status} />
        </div>

        {editing ? (
          <InstallmentEditForm
            contractId={contractId}
            installment={installment}
            onDone={() => setEditing(false)}
          />
        ) : (
          <InstallmentDetailView
            capabilities={capabilities}
            contractId={contractId}
            events={events}
            installment={installment}
            isOwner={isOwner}
            onEdit={() => setEditing(true)}
            proofs={proofs}
            requiresConfirmation={requiresConfirmation}
            status={status}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

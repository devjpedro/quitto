import { zodResolver } from "@hookform/resolvers/zod";
import {
  type UpdateInstallmentInput,
  updateInstallmentSchema,
} from "@quitto/shared";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useUpdateInstallmentMutation } from "@/hooks/use-contract-mutations";
import { formatBRL, formatISODateBR } from "@/lib/format";

interface Installment {
  amountCents: number;
  dueDate: string;
  id: string;
  sequence: number;
  status: string;
}

/**
 * Builds the PATCH body from form values, sending only fields the owner
 * actually filled. Empty/undefined values are dropped so editing one field
 * doesn't overwrite the other (and so the API receives a minimal diff).
 */
function buildBody(values: UpdateInstallmentInput): UpdateInstallmentInput {
  const body: UpdateInstallmentInput = {};
  if (values.amountCents !== undefined && !Number.isNaN(values.amountCents)) {
    body.amountCents = values.amountCents;
  }
  if (values.dueDate) {
    body.dueDate = values.dueDate;
  }
  return body;
}

export function InstallmentDrawer({
  contractId,
  installment,
  role,
  open,
  onClose,
}: {
  contractId: string;
  installment: Installment | null;
  role: string;
  open: boolean;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const updateMutation = useUpdateInstallmentMutation(contractId);
  const form = useForm<UpdateInstallmentInput>({
    resolver: zodResolver(updateInstallmentSchema),
  });

  if (!installment) {
    return null;
  }

  const onSubmit = form.handleSubmit(async (values) => {
    await updateMutation.mutateAsync({
      installmentId: installment.id,
      body: buildBody(values),
    });
    setEditing(false);
    onClose();
  });

  function startEdit() {
    // Pre-fill only the amount; leave dueDate empty so an untouched field is
    // not sent. Typing a date opts into changing it.
    form.reset({ amountCents: installment?.amountCents });
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    form.reset();
  }

  const isOwner = role === "owner";

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
          <StatusBadge status={installment.status} />
        </div>

        {editing ? (
          <form className="flex flex-1 flex-col gap-5" onSubmit={onSubmit}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">Valor (centavos)</Label>
              <Input
                id="amount"
                inputMode="numeric"
                type="number"
                {...form.register("amountCents", { valueAsNumber: true })}
              />
              {form.formState.errors.amountCents ? (
                <p className="text-destructive text-xs">
                  {form.formState.errors.amountCents.message}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="due">Vencimento</Label>
              <Input
                id="due"
                placeholder="AAAA-MM-DD"
                {...form.register("dueDate", {
                  setValueAs: (v) => (v === "" ? undefined : v),
                })}
              />
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
                onClick={cancelEdit}
                type="button"
                variant="outline"
              >
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-1 flex-col gap-4">
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
              <Button className="gap-2" onClick={startEdit} type="button">
                <Pencil className="size-4" />
                Editar parcela
              </Button>
            ) : null}

            <p className="mt-auto border-border border-t border-dashed pt-4 text-muted-foreground text-xs leading-relaxed">
              Comprovantes e marcar como paga{" "}
              <span className="font-medium text-foreground/70">
                em breve (Fase 3)
              </span>
              .
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

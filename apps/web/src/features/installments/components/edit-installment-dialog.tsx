import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/field";
import {
  formatBRL,
  formatISODateBR,
  maskBRDate,
  parseBRDateToISO,
  parseBRLToCents,
} from "@/lib/format";
import { buildInstallmentPatch } from "@/lib/installment-form";
import { m } from "@/paraglide/messages.js";
import { useUpdateInstallmentMutation } from "../api";
import type { InstallmentDetail } from "../types";

const FORM_ID = "edit-installment-form";

interface Errors {
  amount?: string;
  date?: string;
}

function Form({
  detail,
  onDone,
  update,
}: {
  detail: InstallmentDetail;
  onDone: () => void;
  update: ReturnType<typeof useUpdateInstallmentMutation>;
}) {
  const [amount, setAmount] = useState(formatBRL(detail.amountCents));
  const [date, setDate] = useState(formatISODateBR(detail.dueDate));
  const [errors, setErrors] = useState<Errors>({});

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const cents = parseBRLToCents(amount);
    const dueDate = parseBRDateToISO(date);
    const next: Errors = {};
    if (cents === null || cents <= 0) {
      next.amount = m.panel_edit_invalid_amount();
    }
    if (!dueDate) {
      next.date = m.panel_edit_invalid_date();
    }
    setErrors(next);
    if (next.amount || next.date) {
      return;
    }
    // Only what changed, so editing one never rewrites the other.
    const body = buildInstallmentPatch({
      amountCents:
        cents === detail.amountCents ? undefined : (cents ?? undefined),
      dueDate: dueDate === detail.dueDate ? undefined : (dueDate ?? undefined),
    });
    if (Object.keys(body).length === 0) {
      onDone();
      return;
    }
    update.mutate(
      { installmentId: detail.id, body },
      { onSuccess: () => onDone() }
    );
  };

  return (
    <form
      className="flex flex-col gap-4"
      id={FORM_ID}
      noValidate
      onSubmit={submit}
    >
      <TextField
        error={errors.amount}
        id="installment-amount"
        inputMode="decimal"
        label={m.panel_edit_amount()}
        onChange={(event) => setAmount(event.target.value)}
        value={amount}
      />
      <TextField
        error={errors.date}
        id="installment-due"
        inputMode="numeric"
        label={m.panel_edit_date()}
        onChange={(event) => setDate(maskBRDate(event.target.value))}
        value={date}
      />
    </form>
  );
}

/** "Editar valor ou data" (the owner): the amount and the due date, only what changed is sent. */
export function EditInstallmentDialog({
  contractId,
  detail,
  onOpenChange,
  open,
}: {
  contractId: string;
  detail: InstallmentDetail;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const update = useUpdateInstallmentMutation(contractId);
  return (
    <Dialog
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} variant="ghost">
            {m.contract_cancel()}
          </Button>
          <Button disabled={update.isPending} form={FORM_ID} type="submit">
            {m.panel_edit_save()}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={m.panel_edit()}
    >
      {open ? (
        <Form
          detail={detail}
          onDone={() => onOpenChange(false)}
          update={update}
        />
      ) : null}
    </Dialog>
  );
}

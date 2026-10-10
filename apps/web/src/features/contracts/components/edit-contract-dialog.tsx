import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextArea, TextField } from "@/components/ui/field";
import { m } from "@/paraglide/messages.js";
import { useUpdateContractMutation } from "../api";
import type { ContractDetail } from "../types";

const FORM_ID = "contract-edit-form";
const TITLE_MAX = 200;
const DESCRIPTION_MAX = 2000;

interface Values {
  description: string;
  title: string;
}

/**
 * The form lives inside the dialog's content, which unmounts on close, so
 * every opening starts from the contract as it is now.
 */
function EditContractForm({
  detail,
  onSubmit,
}: {
  detail: ContractDetail;
  onSubmit: (values: Values) => void;
}) {
  const {
    formState: { errors },
    handleSubmit,
    register,
    watch,
  } = useForm<Values>({
    defaultValues: {
      title: detail.contract.title,
      description: detail.contract.description ?? "",
    },
  });
  const description = watch("description");
  return (
    <form
      className="flex flex-col gap-4"
      id={FORM_ID}
      noValidate
      onSubmit={handleSubmit(onSubmit)}
    >
      <TextField
        error={errors.title ? m.contract_edit_title_required() : undefined}
        id="contract-title"
        label={m.contract_edit_title()}
        maxLength={TITLE_MAX}
        {...register("title", {
          required: true,
          maxLength: TITLE_MAX,
          // Spaces alone are no name: the API trims and would refuse it.
          validate: (value) => value.trim() !== "",
        })}
      />
      <TextArea
        counter={m.contract_counter({
          count: description.length,
          max: DESCRIPTION_MAX,
        })}
        id="contract-description"
        label={m.contract_edit_description()}
        maxLength={DESCRIPTION_MAX}
        {...register("description")}
      />
    </form>
  );
}

/** "Editar título e descrição" from the owner's "⋯": the page shows the new text at once. */
export function EditContractDialog({
  detail,
  onCloseAutoFocus,
  onOpenChange,
  open,
}: {
  detail: ContractDetail;
  onCloseAutoFocus: (event: Event) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const mutation = useUpdateContractMutation(detail.contract.id);
  const submit = ({ title, description }: Values) => {
    const text = description.trim();
    mutation.mutate(
      { title: title.trim(), description: text === "" ? null : text },
      { onSuccess: () => onOpenChange(false) }
    );
  };
  return (
    <Dialog
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} variant="ghost">
            {m.contract_cancel()}
          </Button>
          <Button disabled={mutation.isPending} form={FORM_ID} type="submit">
            {m.contract_edit_save()}
          </Button>
        </>
      }
      onCloseAutoFocus={onCloseAutoFocus}
      onOpenChange={onOpenChange}
      open={open}
      title={m.contract_edit()}
    >
      <EditContractForm detail={detail} onSubmit={submit} />
    </Dialog>
  );
}

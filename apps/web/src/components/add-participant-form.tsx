import { zodResolver } from "@hookform/resolvers/zod";
import {
  type AddParticipantInput,
  addParticipantSchema,
  INVITABLE_PARTICIPANT_ROLES,
} from "@quitto/shared";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAddParticipantMutation } from "@/hooks/use-participant-mutations";
import { ROLE_LABEL } from "@/lib/labels";

/** Inline form to add a participant slot (name + role). */
export function AddParticipantForm({
  contractId,
  onDone,
}: {
  contractId: string;
  onDone: () => void;
}) {
  const addMutation = useAddParticipantMutation(contractId);
  const form = useForm<AddParticipantInput>({
    resolver: zodResolver(addParticipantSchema),
    defaultValues: { role: INVITABLE_PARTICIPANT_ROLES[0] },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await addMutation.mutateAsync(values);
    form.reset();
    onDone();
  });

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="participant-name">Nome</Label>
        <Input
          id="participant-name"
          placeholder="Ex.: Irmão"
          {...form.register("displayName")}
        />
        {form.formState.errors.displayName ? (
          <p className="text-destructive text-xs">
            {form.formState.errors.displayName.message}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="participant-role">Papel</Label>
        <select
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          id="participant-role"
          {...form.register("role")}
        >
          {INVITABLE_PARTICIPANT_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r] ?? r}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <Button
          className="flex-1"
          disabled={addMutation.isPending}
          type="submit"
        >
          {addMutation.isPending ? "Adicionando…" : "Adicionar"}
        </Button>
        <Button onClick={onDone} type="button" variant="outline">
          Cancelar
        </Button>
      </div>
    </form>
  );
}

import { zodResolver } from "@hookform/resolvers/zod";
import {
  type AddParticipantInput,
  optionalEmail,
  PARTICIPANT_ROLE,
  type ParticipantRole,
} from "@quitto/shared";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAddParticipantMutation,
  useCreateInviteMutation,
} from "@/hooks/use-participant-mutations";
import { PLACEHOLDER, ROLE_LABEL } from "@/lib/labels";

const formSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Informe um nome")
    .max(120, "Máximo 120 caracteres"),
  role: z.string().min(1),
  // E-mail é opcional: string vazia passa; valor preenchido é validado como e-mail.
  email: optionalEmail,
});

type FormValues = z.infer<typeof formSchema>;

/**
 * Inline form to add a participant slot (name + role). When an e-mail is
 * provided, it also generates an invite in the same step and surfaces the
 * token via {@link onCreated}. Empty e-mail only adds the participant.
 */
export function AddParticipantForm({
  contractId,
  availableRoles,
  onDone,
  onCreated,
}: {
  contractId: string;
  availableRoles: readonly ParticipantRole[];
  onDone: () => void;
  onCreated?: (token: string) => void;
}) {
  const addMutation = useAddParticipantMutation(contractId);
  const inviteMutation = useCreateInviteMutation(contractId);
  const defaultRole = availableRoles[0] ?? PARTICIPANT_ROLE.viewer;
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { displayName: "", role: defaultRole, email: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const created = await addMutation.mutateAsync({
      displayName: values.displayName,
      role: values.role as AddParticipantInput["role"],
    });
    const email = values.email;
    if (email) {
      const invite = await inviteMutation.mutateAsync({
        participantId: created.id,
        body: { email },
      });
      onCreated?.(invite.token);
    }
    form.reset();
    onDone();
  });

  const pending = addMutation.isPending || inviteMutation.isPending;

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="participant-name">Nome</Label>
        <Input
          id="participant-name"
          placeholder={PLACEHOLDER.participantName}
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
        <Controller
          control={form.control}
          name="role"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger id="participant-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABEL[r] ?? r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="participant-email">
          E-mail do convidado (opcional)
        </Label>
        <Input
          id="participant-email"
          placeholder="pessoa@exemplo.com"
          type="email"
          {...form.register("email")}
        />
        {form.formState.errors.email ? (
          <p className="text-destructive text-xs">
            {form.formState.errors.email.message}
          </p>
        ) : null}
        <p className="text-muted-foreground text-xs">
          Preenchendo o e-mail, o link do convite é gerado já ao adicionar.
        </p>
      </div>

      <div className="flex gap-2">
        <Button className="flex-1" disabled={pending} type="submit">
          {pending ? "Adicionando…" : "Adicionar"}
        </Button>
        <Button onClick={onDone} type="button" variant="outline">
          Cancelar
        </Button>
      </div>
    </form>
  );
}

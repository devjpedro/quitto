import { zodResolver } from "@hookform/resolvers/zod";
import {
  type CreateInviteInput,
  createInviteSchema,
  PARTICIPANT_ROLE,
} from "@quitto/shared";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AddParticipantForm } from "@/components/add-participant-form";
import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  useCreateInviteMutation,
  useRemoveParticipantMutation,
} from "@/hooks/use-participant-mutations";
import { ROLE_LABEL } from "@/lib/labels";

interface ParticipantView {
  displayName: string;
  id: string;
  linked: boolean;
  role: string;
}

function InvitePanel({
  contractId,
  participantId,
}: {
  contractId: string;
  participantId: string;
}) {
  const createInvite = useCreateInviteMutation(contractId);
  const [token, setToken] = useState<string | null>(null);
  const form = useForm<CreateInviteInput>({
    resolver: zodResolver(createInviteSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const res = await createInvite.mutateAsync({ participantId, body: values });
    setToken(res.token);
  });

  if (token) {
    const link = `${window.location.origin}/invites/${token}`;
    return (
      <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3">
        <Label htmlFor={`link-${participantId}`}>Link do convite</Label>
        <div className="flex gap-2">
          <Input
            className="flex-1"
            id={`link-${participantId}`}
            readOnly
            value={link}
          />
          <CopyButton value={link} />
        </div>
        <p className="text-muted-foreground text-xs">
          Este link expira em 7 dias e só funciona para esse e-mail.
        </p>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3"
      onSubmit={onSubmit}
    >
      <Label htmlFor={`email-${participantId}`}>E-mail do convidado</Label>
      <Input
        id={`email-${participantId}`}
        placeholder="pessoa@exemplo.com"
        type="email"
        {...form.register("email")}
      />
      {form.formState.errors.email ? (
        <p className="text-destructive text-xs">
          {form.formState.errors.email.message}
        </p>
      ) : null}
      <Button disabled={createInvite.isPending} type="submit">
        {createInvite.isPending ? "Gerando…" : "Gerar link"}
      </Button>
    </form>
  );
}

function ParticipantItem({
  contractId,
  participant,
}: {
  contractId: string;
  participant: ParticipantView;
}) {
  const removeMutation = useRemoveParticipantMutation(contractId);
  const [inviting, setInviting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isOwner = participant.role === PARTICIPANT_ROLE.owner;

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-xs">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`size-2 shrink-0 rounded-full ${participant.linked ? "bg-primary" : "bg-muted-foreground/40"}`}
        />
        <span className="font-medium text-foreground text-sm">
          {participant.displayName}
        </span>
        <Badge tone="neutral">
          {ROLE_LABEL[participant.role] ?? participant.role}
        </Badge>
        <div className="ml-auto flex gap-1">
          {participant.linked || isOwner ? null : (
            <Button
              onClick={() => setInviting((v) => !v)}
              size="sm"
              type="button"
              variant="ghost"
            >
              Convidar
            </Button>
          )}
          {isOwner ? null : (
            <Button
              onClick={() => setConfirmOpen(true)}
              size="sm"
              type="button"
              variant="ghost"
            >
              Remover participante
            </Button>
          )}
        </div>
      </div>

      {inviting && !participant.linked ? (
        <InvitePanel contractId={contractId} participantId={participant.id} />
      ) : null}

      <Dialog onOpenChange={setConfirmOpen} open={confirmOpen}>
        <DialogContent
          description={`Remover ${participant.displayName} deste contrato? Convites pendentes serão cancelados.`}
          title="Remover participante"
        >
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={removeMutation.isPending}
              onClick={async () => {
                await removeMutation.mutateAsync(participant.id);
                setConfirmOpen(false);
              }}
              type="button"
              variant="destructive"
            >
              {removeMutation.isPending ? "Removendo…" : "Remover"}
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
    </li>
  );
}

/** Owner-only drawer to manage participants and generate invite links. */
export function ParticipantsDrawer({
  contractId,
  participants,
  open,
  onClose,
}: {
  contractId: string;
  participants: ParticipantView[];
  open: boolean;
  onClose: () => void;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <Sheet onOpenChange={(o) => !o && onClose()} open={open}>
      <SheetContent title="Participantes">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
          <ul className="flex flex-col gap-2">
            {participants.map((p) => (
              <ParticipantItem
                contractId={contractId}
                key={p.id}
                participant={p}
              />
            ))}
          </ul>

          {adding ? (
            <AddParticipantForm
              contractId={contractId}
              onDone={() => setAdding(false)}
            />
          ) : (
            <Button
              onClick={() => setAdding(true)}
              type="button"
              variant="outline"
            >
              + Adicionar participante
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

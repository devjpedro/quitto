import { zodResolver } from "@hookform/resolvers/zod";
import {
  type CreateInviteInput,
  createInviteSchema,
  INVITABLE_PARTICIPANT_ROLES,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  useCreateInviteMutation,
  useRemoveParticipantMutation,
  useUpdateParticipantRoleMutation,
} from "@/hooks/use-participant-mutations";
import { OWNER_BADGE_LABEL, ROLE_LABEL } from "@/lib/labels";

interface ParticipantView {
  displayName: string;
  id: string;
  isOwner: boolean;
  linked: boolean;
  role: string;
}

/** Papéis atribuíveis (owner nunca é selecionável). */
type AssignableRole = (typeof INVITABLE_PARTICIPANT_ROLES)[number];

const UNIQUE_ROLES: AssignableRole[] = [
  PARTICIPANT_ROLE.buyer,
  PARTICIPANT_ROLE.seller,
];

/**
 * Papéis selecionáveis para um participante.
 * - buyer/seller já ocupados por OUTRO participante são removidos.
 * - viewer é ilimitado, mas é proibido para o slot do dono (sempre é parte).
 * - o papel atual está sempre presente (no-op permitido).
 */
function availableRolesFor(
  participant: ParticipantView,
  participants: ParticipantView[]
): AssignableRole[] {
  const taken = new Set(
    participants
      .filter(
        (p) =>
          p.id !== participant.id &&
          (p.role === PARTICIPANT_ROLE.buyer ||
            p.role === PARTICIPANT_ROLE.seller)
      )
      .map((p) => p.role)
  );
  const base: readonly AssignableRole[] = participant.isOwner
    ? UNIQUE_ROLES
    : INVITABLE_PARTICIPANT_ROLES;
  const filtered = base.filter(
    (r) =>
      r === participant.role || r === PARTICIPANT_ROLE.viewer || !taken.has(r)
  );
  // Safety net: always include the participant's current role so the Radix
  // Select trigger is never rendered with an unrecognised value.
  if (!filtered.includes(participant.role as AssignableRole)) {
    filtered.push(participant.role as AssignableRole);
  }
  return filtered;
}

/** Read-only invite link with copy button — shared by InvitePanel and the add flow. */
function InviteLink({ id, token }: { id: string; token: string }) {
  const link = `${window.location.origin}/invites/${token}`;
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3">
      <Label htmlFor={`link-${id}`}>Link do convite</Label>
      <div className="flex gap-2">
        <Input className="flex-1" id={`link-${id}`} readOnly value={link} />
        <CopyButton value={link} />
      </div>
      <p className="text-muted-foreground text-xs">
        Este link expira em 7 dias e só funciona para esse e-mail.
      </p>
    </div>
  );
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
    return <InviteLink id={participantId} token={token} />;
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
  roleOptions,
}: {
  contractId: string;
  participant: ParticipantView;
  roleOptions: AssignableRole[];
}) {
  const removeMutation = useRemoveParticipantMutation(contractId);
  const updateRole = useUpdateParticipantRoleMutation(contractId);
  const [inviting, setInviting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isOwner = participant.isOwner;

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
        <Select
          disabled={updateRole.isPending}
          onValueChange={(role) =>
            updateRole.mutateAsync({
              participantId: participant.id,
              role: role as AssignableRole,
            })
          }
          value={participant.role}
        >
          <SelectTrigger
            aria-label={`Papel de ${participant.displayName}`}
            className="h-7 w-auto gap-1 px-2 text-xs"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roleOptions.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABEL[r] ?? r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isOwner ? <Badge tone="brand">{OWNER_BADGE_LABEL}</Badge> : null}
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
  const [newLinkToken, setNewLinkToken] = useState<string | null>(null);

  const takenUnique = new Set(
    participants
      .filter(
        (p) =>
          p.role === PARTICIPANT_ROLE.buyer ||
          p.role === PARTICIPANT_ROLE.seller
      )
      .map((p) => p.role)
  );
  const availableRoles = INVITABLE_PARTICIPANT_ROLES.filter(
    (r) => r === PARTICIPANT_ROLE.viewer || !takenUnique.has(r)
  );

  return (
    <Sheet
      onOpenChange={(o) => {
        if (!o) {
          setNewLinkToken(null);
          onClose();
        }
      }}
      open={open}
    >
      <SheetContent title="Participantes">
        <div className="-mx-1 flex flex-1 flex-col gap-4 overflow-y-auto px-1">
          <ul className="flex flex-col gap-2">
            {participants.map((p) => (
              <ParticipantItem
                contractId={contractId}
                key={p.id}
                participant={p}
                roleOptions={availableRolesFor(p, participants)}
              />
            ))}
          </ul>

          {newLinkToken ? <InviteLink id="new" token={newLinkToken} /> : null}

          {adding ? (
            <AddParticipantForm
              availableRoles={availableRoles}
              contractId={contractId}
              onCreated={setNewLinkToken}
              onDone={() => setAdding(false)}
            />
          ) : (
            <Button
              onClick={() => {
                setNewLinkToken(null);
                setAdding(true);
              }}
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

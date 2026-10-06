import { UserPlus } from "@phosphor-icons/react";
import { type FormEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Tag } from "@/components/ui/tag";
import { m } from "@/paraglide/messages.js";
import { useInvitePersonMutation } from "../api";
import type { ContractDetail } from "../types";

/** What the API accepts (ASCII, a dot in the domain): a wider net would let an address through only to be refused after the person was already added. */
const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const FORM_ID = "invite-person-form";

type Role = "buyer" | "seller" | "viewer";

/** Only the free roles: one who pays and one who receives per contract, any number who follow. */
function freeRoles(detail: ContractDetail): Role[] {
  const taken = new Set(detail.participants.map((p) => p.role));
  const roles: Role[] = [];
  if (!taken.has("buyer")) {
    roles.push("buyer");
  }
  if (!taken.has("seller")) {
    roles.push("seller");
  }
  roles.push("viewer");
  return roles;
}

const ROLE_LABEL: Record<Role, () => string> = {
  buyer: () => m.people_role_buyer(),
  seller: () => m.people_role_seller(),
  viewer: () => m.people_role_viewer(),
};

type InviteMutation = ReturnType<typeof useInvitePersonMutation>;

function InviteForm({
  detail,
  invite,
  onDone,
}: {
  detail: ContractDetail;
  invite: InviteMutation;
  onDone: () => void;
}) {
  const roles = freeRoles(detail);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(roles[0] ?? "viewer");
  const [errors, setErrors] = useState<{ email?: true; name?: true }>({});

  const emailError = email.trim()
    ? m.people_email_invalid()
    : m.people_email_required();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const displayName = name.trim();
    const address = email.trim();
    const next: typeof errors = {};
    if (!displayName) {
      next.name = true;
    }
    // Quem acompanha só entra por convite: sem e-mail não haveria como chamá-lo depois.
    if ((address || role === "viewer") && !EMAIL_RE.test(address)) {
      next.email = true;
    }
    if (invite.isPending) {
      return;
    }
    setErrors(next);
    if (next.name || next.email) {
      return;
    }
    invite.mutate(
      { displayName, role, email: address || null },
      { onSuccess: onDone }
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
        autoComplete="off"
        error={errors.name ? m.people_name_required() : undefined}
        id="invite-name"
        label={m.people_name()}
        onChange={(event) => setName(event.target.value)}
        value={name}
      />
      <TextField
        autoComplete="off"
        error={errors.email ? emailError : undefined}
        id="invite-person-email"
        label={role === "viewer" ? m.people_email() : m.people_email_optional()}
        onChange={(event) => setEmail(event.target.value)}
        type="email"
        value={email}
      />
      {roles.length > 1 ? (
        <SegmentedControl
          block
          label={m.people_role()}
          onValueChange={setRole}
          options={roles.map((value) => ({
            value,
            label: ROLE_LABEL[value](),
          }))}
          value={role}
        />
      ) : (
        // One free role is no choice: said, not offered.
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold text-[13px] text-ink">
            {m.people_role()}
          </span>
          <Tag tone="brand">{ROLE_LABEL[role]()}</Tag>
        </div>
      )}
    </form>
  );
}

/**
 * "Convidar pessoa": the name, an optional e-mail (without one it is a contact
 * known by name only) and the role among the free ones. The form is the
 * dialog's child, so it starts empty each time it opens.
 */
export function InviteDialog({
  detail,
  onCloseAutoFocus,
  onOpenChange,
  open,
}: {
  detail: ContractDetail;
  onCloseAutoFocus?: (event: Event) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const invite = useInvitePersonMutation(detail.contract.id);
  return (
    <Dialog
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} variant="ghost">
            {m.contract_cancel()}
          </Button>
          <Button disabled={invite.isPending} form={FORM_ID} type="submit">
            {m.contract_invite()}
          </Button>
        </>
      }
      onCloseAutoFocus={onCloseAutoFocus}
      onOpenChange={onOpenChange}
      open={open}
      title={m.contract_invite()}
    >
      <InviteForm
        detail={detail}
        invite={invite}
        onDone={() => onOpenChange(false)}
      />
    </Dialog>
  );
}

/** The tabs row's action (from md): the filled "Convidar pessoa" that opens the dialog. */
export function InviteButton({ detail }: { detail: ContractDetail }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button
        className="bg-surface-card hover:bg-surface-card-hover max-md:hidden"
        onClick={() => setOpen(true)}
        ref={triggerRef}
        size="sm"
        variant="ghost"
      >
        <UserPlus aria-hidden="true" size={16} />
        {m.contract_invite()}
      </Button>
      <InviteDialog
        detail={detail}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
        onOpenChange={setOpen}
        open={open}
      />
    </>
  );
}

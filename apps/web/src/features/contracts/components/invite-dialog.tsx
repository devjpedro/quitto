import { UserPlus } from "@phosphor-icons/react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { m } from "@/paraglide/messages.js";
import { useInvitePersonMutation } from "../api";
import type { ContractDetail } from "../types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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

function InviteForm({
  detail,
  onDone,
}: {
  detail: ContractDetail;
  onDone: () => void;
}) {
  const invite = useInvitePersonMutation(detail.contract.id);
  const roles = freeRoles(detail);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(roles[0] ?? "viewer");
  const [errors, setErrors] = useState<{ email?: true; name?: true }>({});

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const displayName = name.trim();
    const address = email.trim();
    const next: typeof errors = {};
    if (!displayName) {
      next.name = true;
    }
    if (address && !EMAIL_RE.test(address)) {
      next.email = true;
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
        error={errors.email ? m.people_email_invalid() : undefined}
        id="invite-person-email"
        label={m.people_email_optional()}
        onChange={(event) => setEmail(event.target.value)}
        type="email"
        value={email}
      />
      <SegmentedControl
        block
        label={m.people_role()}
        onValueChange={setRole}
        options={roles.map((value) => ({ value, label: ROLE_LABEL[value]() }))}
        value={role}
      />
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
  return (
    <Dialog
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} variant="ghost">
            {m.contract_cancel()}
          </Button>
          <Button form={FORM_ID} type="submit">
            {m.contract_invite()}
          </Button>
        </>
      }
      onCloseAutoFocus={onCloseAutoFocus}
      onOpenChange={onOpenChange}
      open={open}
      title={m.contract_invite()}
    >
      <InviteForm detail={detail} onDone={() => onOpenChange(false)} />
    </Dialog>
  );
}

/** The tabs row's action (from md): the filled "Convidar pessoa" that opens the dialog. */
export function InviteButton({ detail }: { detail: ContractDetail }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        className="bg-surface-card hover:bg-surface-card-hover max-md:hidden"
        onClick={() => setOpen(true)}
        size="sm"
        variant="ghost"
      >
        <UserPlus aria-hidden="true" size={16} />
        {m.contract_invite()}
      </Button>
      <InviteDialog detail={detail} onOpenChange={setOpen} open={open} />
    </>
  );
}

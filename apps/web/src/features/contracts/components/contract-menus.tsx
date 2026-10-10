import {
  DotsThreeVertical,
  PencilSimple,
  SignOut,
  Trash,
  UserPlus,
} from "@phosphor-icons/react";
import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { m } from "@/paraglide/messages.js";
import { useDeleteContractMutation, useLeaveContractMutation } from "../api";
import type { ContractDetail } from "../types";
import { ExportItems, FILLED } from "./contract-export-menu";
import { EditContractDialog } from "./edit-contract-dialog";
import { InviteDialog } from "./invite-dialog";

type OpenDialog = "edit" | "invite" | "delete" | "leave" | null;

/**
 * The contract's "⋯": the owner edits the title and description or deletes
 * the contract; anyone else can only leave it. On a phone the same menu
 * carries Exportar first (the top bar has no room for two buttons). Each
 * item opens its dialog, and closing it gives the focus back to the "⋯".
 */
export function ContractActionsMenu({
  detail,
  variant,
}: {
  detail: ContractDetail;
  variant: "desktop" | "mobile";
}) {
  const contractId = detail.contract.id;
  const navigate = useNavigate();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState<OpenDialog>(null);
  const deleteMutation = useDeleteContractMutation();
  const leaveMutation = useLeaveContractMutation(contractId);
  const label =
    variant === "desktop" ? m.contract_actions() : m.contract_actions_mobile();
  const backToTrigger = (event: Event) => {
    event.preventDefault();
    triggerRef.current?.focus();
  };
  const onOpenChange = (next: boolean) => {
    if (!next) {
      setOpen(null);
    }
  };
  // Deleted or left: the dialog closes and the page goes back to the list.
  const toList = () => {
    setOpen(null);
    navigate({ to: "/contracts" });
  };

  const trigger =
    variant === "desktop" ? (
      <button
        aria-label={label}
        className={`${FILLED} w-10`}
        ref={triggerRef}
        type="button"
      >
        <DotsThreeVertical aria-hidden="true" size={18} />
      </button>
    ) : (
      <IconButton icon={DotsThreeVertical} label={label} ref={triggerRef} />
    );

  return (
    <>
      <Menu label={label} trigger={trigger}>
        {variant === "mobile" ? (
          <>
            <ExportItems contractId={contractId} />
            <MenuSeparator />
          </>
        ) : null}
        {detail.isOwner ? (
          <>
            <MenuItem icon={PencilSimple} onSelect={() => setOpen("edit")}>
              {m.contract_edit()}
            </MenuItem>
            <MenuItem icon={UserPlus} onSelect={() => setOpen("invite")}>
              {m.contract_invite()}
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              icon={Trash}
              onSelect={() => setOpen("delete")}
              tone="danger"
            >
              {m.contract_delete()}
            </MenuItem>
          </>
        ) : (
          <MenuItem
            icon={SignOut}
            onSelect={() => setOpen("leave")}
            tone="danger"
          >
            {m.contract_leave()}
          </MenuItem>
        )}
      </Menu>
      {detail.isOwner ? (
        <>
          <EditContractDialog
            detail={detail}
            onCloseAutoFocus={backToTrigger}
            onOpenChange={onOpenChange}
            open={open === "edit"}
          />
          <InviteDialog
            detail={detail}
            onCloseAutoFocus={backToTrigger}
            onOpenChange={onOpenChange}
            open={open === "invite"}
          />
          <ConfirmDialog
            cancelLabel={m.contract_cancel()}
            confirmLabel={m.contract_delete_confirm()}
            description={m.contract_delete_description()}
            onCloseAutoFocus={backToTrigger}
            onConfirm={() =>
              deleteMutation.mutate(contractId, { onSuccess: toList })
            }
            onOpenChange={onOpenChange}
            open={open === "delete"}
            pending={deleteMutation.isPending}
            title={m.contract_delete()}
            tone="danger"
          />
        </>
      ) : (
        <ConfirmDialog
          cancelLabel={m.contract_cancel()}
          confirmLabel={m.contract_leave_confirm()}
          description={m.contract_leave_description()}
          onCloseAutoFocus={backToTrigger}
          onConfirm={() =>
            leaveMutation.mutate(undefined, { onSuccess: toList })
          }
          onOpenChange={onOpenChange}
          open={open === "leave"}
          pending={leaveMutation.isPending}
          title={m.contract_leave()}
          tone="danger"
        />
      )}
    </>
  );
}

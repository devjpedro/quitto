import {
  DotsThreeVertical,
  DownloadSimple,
  FilePdf,
  PencilSimple,
  SignOut,
  Table,
  Trash,
  UserPlus,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useHydrated, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { m } from "@/paraglide/messages.js";
import {
  contractQueryOptions,
  useDeleteContractMutation,
  useLeaveContractMutation,
} from "../api";
import type { ContractDetail } from "../types";
import { EditContractDialog } from "./edit-contract-dialog";
import { InviteDialog } from "./invite-dialog";

/** Filled, no outline (DIRECAO › Contrato): the card's fill, one step down on hover. */
const FILLED =
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-control bg-surface-card font-medium text-ink text-sm transition-[background-color,transform] duration-150 hover:bg-surface-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[.97] motion-reduce:active:scale-100";

const ICON = "text-ink-muted";

/** The statement as a plain same-origin download (the cookie is first-party: no fetch, no blob). */
function ExportItems({ contractId }: { contractId: string }) {
  return (
    <>
      <MenuItem asChild>
        <a download href={`/api/contracts/${contractId}/statement.pdf`}>
          <FilePdf aria-hidden="true" className={ICON} size={18} />
          {m.contract_export_pdf()}
        </a>
      </MenuItem>
      <MenuItem asChild>
        <a download href={`/api/contracts/${contractId}/statement.csv`}>
          <Table aria-hidden="true" className={ICON} size={18} />
          {m.contract_export_csv()}
        </a>
      </MenuItem>
    </>
  );
}

/** "Exportar" (desktop): Extrato em PDF and Planilha .csv (owner's decision 10). */
export function ExportMenu({ contractId }: { contractId: string }) {
  return (
    <Menu
      label={m.contract_export()}
      trigger={
        <button className={`${FILLED} px-3.5`} type="button">
          <DownloadSimple aria-hidden="true" size={16} />
          {m.contract_export()}
        </button>
      }
    >
      <ExportItems contractId={contractId} />
    </Menu>
  );
}

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

/**
 * The "⋯" in the phone's top bar (decision 35), outside the page: it reads
 * the contract without suspense and without throwing (the page shows the
 * 404), and only after hydration, so the server's HTML (a disabled trigger)
 * and the first client render match even when the streamed contract is
 * already in the cache.
 */
export function ContractMobileMenu({ contractId }: { contractId: string }) {
  const hydrated = useHydrated();
  const { data } = useQuery({
    ...contractQueryOptions(contractId),
    enabled: hydrated,
    throwOnError: false,
  });
  if (!(hydrated && data)) {
    return (
      <IconButton
        disabled
        icon={DotsThreeVertical}
        label={m.contract_actions_mobile()}
      />
    );
  }
  return <ContractActionsMenu detail={data} variant="mobile" />;
}

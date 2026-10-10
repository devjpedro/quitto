import {
  ArrowUpRight,
  ClockCounterClockwise,
  PencilSimple,
} from "@phosphor-icons/react";
import { isPaidStatus } from "@quitto/shared";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Fragment, useEffect, useState } from "react";
import { Money } from "@/components/ui/money";
import { perspectiveOf } from "@/features/contracts/lib/contract-view";
import type { ContractDetail } from "@/features/contracts/types";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { installmentQueryOptions } from "../api";
import type { PanelNavigation } from "../hooks/use-panel-navigation";
import { panelInputOf, panelView } from "../lib/panel-actions";
import { trailSteps } from "../lib/status-trail";
import type { InstallmentDetail, PanelRoute } from "../types";
import { EditInstallmentDialog } from "./edit-installment-dialog";
import { PANEL_BLOCKS } from "./panel-blocks";
import { type PanelMode, usePanel } from "./panel-context";
import { PANEL_TITLE_ID, PanelHeader } from "./panel-header";
import { StatusTrail } from "./status-trail";

const FOOT_LINK =
  "inline-flex h-11 items-center gap-1.5 rounded-control px-1 font-medium text-[13px] text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand md:h-7";

/** "Editar valor ou data" (only the owner) and "Histórico", at the panel's foot. */
function PanelFoot({
  contract,
  detail,
  mode,
  route,
}: {
  contract: ContractDetail;
  detail: InstallmentDetail;
  mode: PanelMode;
  route: PanelRoute;
}) {
  const [editing, setEditing] = useState(false);
  // A paid installment is a record: the API refuses the edit.
  const canEdit = contract.isOwner && !isPaidStatus(detail.status);
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 pt-3",
        // A straight line above (no border-top: the column has a radius).
        mode === "docked"
          ? "mt-3 shadow-[0_-1px_0_color-mix(in_srgb,var(--ink)_9%,transparent)]"
          : "mt-auto shadow-[0_-1px_0_var(--divider)]"
      )}
    >
      {canEdit ? (
        <button
          className={FOOT_LINK}
          onClick={() => setEditing(true)}
          type="button"
        >
          <PencilSimple aria-hidden="true" size={15} />
          {m.panel_edit()}
        </button>
      ) : (
        <span />
      )}
      <button
        className={FOOT_LINK}
        // Below lateral the panel is a modal sheet: the tab would change
        // behind it. It closes with the same navigation; the column stays.
        onClick={() => route.openHistory({ closePanel: mode !== "docked" })}
        type="button"
      >
        <ClockCounterClockwise aria-hidden="true" size={15} />
        {m.panel_history()}
      </button>
      {canEdit ? (
        <EditInstallmentDialog
          contractId={contract.contract.id}
          detail={detail}
          onOpenChange={setEditing}
          open={editing}
        />
      ) : null}
    </div>
  );
}

/** The amount, the trail and the blocks of this role and state, in order. */
function PanelContent({
  contract,
  detail,
  mode,
  route,
}: {
  contract: ContractDetail;
  detail: InstallmentDetail;
  mode: PanelMode;
  route: PanelRoute;
}) {
  const { busy } = usePanel();
  const perspective = perspectiveOf(contract.role);
  const payer = contract.participants.find((p) => p.role === "buyer");
  const receiver = contract.participants.find((p) => p.role === "seller");
  const steps = trailSteps({
    approverName: receiver?.displayName ?? null,
    confirmedAt: detail.confirmedAt,
    dueDate: detail.dueDate,
    events: detail.events,
    isApprover: contract.isApprover,
    locale: getLocale(),
    paidAt: detail.paidAt,
    payerName: payer?.displayName ?? null,
    perspective,
    proofs: detail.proofs,
    registeredOnCreate: detail.registeredOnCreate,
    requiresConfirmation: contract.contract.requiresConfirmation,
    status: detail.status,
    today: route.today,
    uploading: busy,
  });
  const { blocks } = panelView(panelInputOf(contract, detail));
  return (
    <>
      <Money cents={detail.amountCents} className="block" size="card" />
      <StatusTrail steps={steps} />
      {blocks.length > 0 ? (
        <div className="mt-5 flex flex-col gap-4">
          {blocks.map((block) => (
            <Fragment key={block}>
              {PANEL_BLOCKS[block]?.({ contract, detail, mode, route })}
            </Fragment>
          ))}
        </div>
      ) : null}
    </>
  );
}

/**
 * One installment in the panel (mockup 14, enxuto): the amount and the
 * trail, no tag and no long date, then what this role decides now. Keyed by
 * the installment in the host, so a step remounts only this; the keys are
 * heard on the host's wrapper (planner's decision 34). In the column it draws
 * its own header and takes the focus to the title on every mount.
 */
export function InstallmentPanel({
  contract,
  mode,
  nav,
  route,
  showContract = false,
}: {
  contract: ContractDetail;
  mode: PanelMode;
  nav: PanelNavigation;
  route: PanelRoute;
  /** The docked header names the contract (Parcelas: the panel is away from its page). */
  showContract?: boolean;
}) {
  const { installmentId } = usePanel();
  const { data: detail } = useSuspenseQuery(
    installmentQueryOptions(installmentId)
  );
  const docked = mode === "docked";
  useEffect(() => {
    // On open (from a line, a card, a step) the title takes the focus. A page
    // that loads with the panel open has the focus on <body>, where ↑ ↓ Esc
    // are not heard: it goes to the column's wrapper (no ring, nothing moves).
    if (!docked) {
      return;
    }
    const active = document.activeElement;
    if (active && active !== document.body) {
      document.getElementById(PANEL_TITLE_ID)?.focus({ preventScroll: true });
      return;
    }
    document
      .querySelector<HTMLElement>('[data-testid="installment-panel-docked"]')
      ?.focus({ preventScroll: true });
  }, [docked]);
  const sequence =
    detail?.sequence ??
    contract.installments.find((it) => it.id === installmentId)?.sequence ??
    0;
  const header = docked ? (
    <PanelHeader
      nav={nav}
      subtitle={
        showContract ? (
          <Link
            className="mt-0.5 inline-flex max-w-full items-center gap-1 rounded-[4px] text-[13px] text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            params={{ id: contract.contract.id }}
            to="/contracts/$id"
          >
            <span className="truncate">{contract.contract.title}</span>
            <ArrowUpRight aria-hidden="true" className="shrink-0" size={12} />
          </Link>
        ) : null
      }
      title={m.panel_title({ sequence, count: contract.installments.length })}
    />
  ) : null;
  return (
    <section
      aria-labelledby={docked ? PANEL_TITLE_ID : undefined}
      className={cn(
        "flex flex-col",
        docked
          ? "min-h-0 rounded-panel bg-surface-card px-5 pt-4 pb-3.5"
          : "flex-1"
      )}
      data-testid="installment-panel"
    >
      {header}
      {detail ? (
        <>
          <div
            className={
              docked
                ? "-mx-2 min-h-0 flex-1 overflow-y-auto px-2 pt-3.5 pb-1"
                : "pb-5"
            }
          >
            <PanelContent
              contract={contract}
              detail={detail}
              mode={mode}
              route={route}
            />
          </div>
          <PanelFoot
            contract={contract}
            detail={detail}
            mode={mode}
            route={route}
          />
        </>
      ) : (
        <p className={cn("text-ink-muted text-sm", docked && "pt-3.5 pb-2")}>
          {m.panel_not_found()}
        </p>
      )}
    </section>
  );
}

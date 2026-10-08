import { useQuery } from "@tanstack/react-query";
import { SectionBoundary } from "@/components/ui/section-boundary";
import { contractQueryOptions } from "@/features/contracts/api";
import { NextActionCard } from "@/features/contracts/components/next-action-card";
import { nextActionOf } from "@/features/contracts/lib/next-action";
import type { PanelRoute } from "../types";
import { PanelHostForRoute } from "./installments-panel";
import { PanelSkeleton } from "./panel-skeleton";

/** The green card of the most urgent installment's contract, while no installment is open (decision 1). */
function UrgentCard({
  contractId,
  onOpen,
  today,
}: {
  contractId: string;
  onOpen: (installmentId: string, contractId: string) => void;
  today: string;
}) {
  const { data: detail } = useQuery(contractQueryOptions(contractId));
  const action = detail ? nextActionOf(detail, today) : null;
  if (!(detail && action)) {
    return null;
  }
  return (
    <NextActionCard
      action={action}
      detail={detail}
      route={{
        today,
        openInstallment: (installmentId) => onOpen(installmentId, contractId),
      }}
      withContract
    />
  );
}

/**
 * From 1440 px a 420 px column held while the list scrolls (mockup 17, C):
 * the panel of the open installment, or the green card of the most urgent
 * one. Below 1440 it is the sheet, from the same host.
 */
export function InstallmentsAside({
  contractId,
  onOpenWithContract,
  panel,
  urgentContractId,
}: {
  contractId: string | undefined;
  onOpenWithContract: (installmentId: string, contractId: string) => void;
  panel: PanelRoute;
  urgentContractId: string | null;
}) {
  const open = panel.installmentId !== null && contractId !== undefined;
  return (
    <aside
      className="lateral:sticky lateral:top-8 lateral:flex contents lateral:max-h-[calc(100dvh-5.5rem)] lateral:flex-col lateral:self-start"
      data-testid="installments-side"
    >
      {open ? (
        <SectionBoundary fallback={<PanelSkeleton mode="docked" />}>
          <PanelHostForRoute contractId={contractId} route={panel} />
        </SectionBoundary>
      ) : null}
      {!open && urgentContractId ? (
        <div className="lateral:block hidden">
          <UrgentCard
            contractId={urgentContractId}
            onOpen={onOpenWithContract}
            today={panel.today}
          />
        </div>
      ) : null}
    </aside>
  );
}

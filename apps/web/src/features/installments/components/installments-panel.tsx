import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { contractQueryOptions } from "@/features/contracts/api";
import type { PanelRoute } from "../types";
import { InstallmentPanelHost } from "./installment-panel-host";

/** The open installment's contract is gone: the search lets the panel go. */
function ClearPanel({ route }: { route: PanelRoute }) {
  const { closeInstallment } = route;
  useEffect(() => {
    closeInstallment();
  }, [closeInstallment]);
  return null;
}

/**
 * The panel of Parcelas: the contract of the open installment (its own
 * boundary), hosted as everywhere. A contract that is gone or not yours
 * (null) draws nothing: the page clears the search.
 */
export function PanelHostForRoute({
  contractId,
  route,
}: {
  contractId: string;
  route: PanelRoute;
}) {
  const { data: contract } = useSuspenseQuery(contractQueryOptions(contractId));
  if (contract === null) {
    return <ClearPanel route={route} />;
  }
  return (
    <InstallmentPanelHost contract={contract} route={route} showContract />
  );
}

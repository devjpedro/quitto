import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import type { ContractRoute } from "@/features/contracts/hooks/use-contract-route";
import type { ContractDetail } from "@/features/contracts/types";
import { installmentQueryOptions } from "../api";
import { focusInstallmentRow } from "../components/installment-panel-host";
import { usePanel } from "../components/panel-context";
import { neighborsOf } from "../lib/neighbors";

const focusLost = () => {
  const active = document.activeElement;
  return !active || active === document.body;
};

/**
 * The line takes the focus back once the URL let the panel go, when nothing
 * else took it (the sheet gives it back to what opened it, a card's button).
 * A group that was open only for this installment closes with the panel, and
 * its line leaves: then the group's button takes it (focusInstallmentRow),
 * checked again a frame later in case the line left after the first try.
 */
function returnFocus(id: string): void {
  requestAnimationFrame(() => {
    if (focusLost()) {
      focusInstallmentRow(id);
    }
    requestAnimationFrame(() => {
      if (focusLost()) {
        focusInstallmentRow(id);
      }
    });
  });
}

/**
 * ↑ ↓ and close (planner's decision 34). A step first moves the focus to the
 * wrapper that stays mounted (`focusTarget`), so it never falls on <body>
 * while the content remounts or shows its skeleton; then the URL moves (with
 * replace). The neighbours are prefetched: not the screen's data (that is the
 * panel's useSuspenseQuery), so no rule about effects for data is broken.
 */
export function usePanelNavigation(
  contract: ContractDetail,
  route: ContractRoute,
  focusTarget: () => HTMLElement | null
) {
  const { busy, cancelWork, installmentId } = usePanel();
  const queryClient = useQueryClient();
  const { prev, next } = neighborsOf(contract.installments, installmentId);

  useEffect(() => {
    for (const neighbour of [prev, next]) {
      if (neighbour) {
        queryClient.prefetchQuery(installmentQueryOptions(neighbour));
      }
    }
  }, [queryClient, prev, next]);

  const { openInstallment, closeInstallment } = route;
  const go = useCallback(
    (target: string | null) => {
      if (busy || !target) {
        return;
      }
      focusTarget()?.focus({ preventScroll: true });
      openInstallment(target);
    },
    [busy, focusTarget, openInstallment]
  );
  const goPrev = useCallback(() => go(prev), [go, prev]);
  const goNext = useCallback(() => go(next), [go, next]);
  const close = useCallback(() => {
    cancelWork();
    Promise.resolve(closeInstallment()).then(() => returnFocus(installmentId));
  }, [cancelWork, closeInstallment, installmentId]);

  return { busy, close, goNext, goPrev, next, prev };
}

export type PanelNavigation = ReturnType<typeof usePanelNavigation>;

import { useRef } from "react";
import {
  useAcceptInviteFromHome,
  useConfirmFromHome,
  useDeclineInviteFromHome,
  useMarkPaidFromHome,
  useMarkReceivedFromHome,
} from "../api";
import type { ActionButtonKind } from "../lib/action-view";
import type { HomeAction } from "../types";

/**
 * Runs a card's mutation buttons. `busy` disables them while one is in
 * flight; the ref also stops a second tap that lands before the re-render,
 * and `tryLock` (one per list) stops the tap that lands on the next card.
 */
export function useActionHandlers(action: HomeAction, tryLock: () => boolean) {
  const markPaid = useMarkPaidFromHome();
  const markReceived = useMarkReceivedFromHome();
  const confirm = useConfirmFromHome();
  const accept = useAcceptInviteFromHome();
  const decline = useDeclineInviteFromHome();
  const inFlight = useRef(false);
  const busy =
    markPaid.isPending ||
    markReceived.isPending ||
    confirm.isPending ||
    accept.isPending ||
    decline.isPending;
  const release = {
    onSettled: () => {
      inFlight.current = false;
    },
  };

  function start(): boolean {
    if (busy || inFlight.current || !tryLock()) {
      return false;
    }
    inFlight.current = true;
    return true;
  }

  function run(kind: ActionButtonKind) {
    if (action.kind === "invite") {
      if ((kind === "accept" || kind === "decline") && start()) {
        (kind === "accept" ? accept : decline).mutate(action, release);
      }
      return;
    }
    if (
      (kind === "mark_paid" ||
        kind === "mark_received" ||
        kind === "confirm") &&
      start()
    ) {
      const mutation = {
        mark_paid: markPaid,
        mark_received: markReceived,
        confirm,
      }[kind];
      mutation.mutate(action, release);
    }
  }

  return { busy, run };
}

import { type RefObject, useEffect, useRef, useState } from "react";
import {
  ResponsiveSheet,
  useSheetVariant,
} from "@/components/ui/responsive-sheet";
import { SectionBoundary } from "@/components/ui/section-boundary";
import type {
  ContractDetail,
  ContractInstallment,
} from "@/features/contracts/types";
import { LATERAL_UP, useMediaQuery } from "@/hooks/use-media-query";
import { m } from "@/paraglide/messages.js";
import { usePanelKeys } from "../hooks/use-panel-keys";
import {
  type PanelNavigation,
  usePanelNavigation,
} from "../hooks/use-panel-navigation";
import type { PanelRoute } from "../types";
import { InstallmentPanel } from "./installment-panel";
import { PanelProvider, usePanel } from "./panel-context";
import { PANEL_TITLE_ID, PanelArrows } from "./panel-header";
import { PanelSkeleton } from "./panel-skeleton";
import { SheetFooter, useSheetPrimary } from "./sheet-footer";

/** The installment's line, or the button of the closed group that holds it. */
function rowOrGroup(id: string): HTMLElement | null {
  const row = document.querySelector<HTMLElement>(
    `[data-installment-row="${id}"]`
  );
  const group = document.querySelector<HTMLElement>(
    `[data-group-ids~="${id}"]`
  );
  return row ?? group;
}

/** Esc's return (DIRECAO › Contrato): the focus goes back to the installment's line, or to its group's button. */
export function focusInstallmentRow(id: string): void {
  rowOrGroup(id)?.focus();
}

/**
 * The column's focus scope (review I3 of Task 9): an action of the panel takes
 * its own button away ("Confirmar recebimento" swaps the blocks, "Cancelar"
 * and a sent dispute close the reason), and the focus would fall on <body>,
 * where ↑ ↓ Esc are not heard. As Radix's FocusScope does in the sheet, it
 * comes back to the title (the wrapper while the content loads). Only a focus
 * the panel lost: one the user took elsewhere (a click on the page, a Tab out)
 * stays there, and a page that loads with the panel open keeps its own.
 */
function useKeepFocus(wrapper: RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    const el = wrapper.current;
    if (!el) {
      return;
    }
    let held: EventTarget | null = null;
    const onFocusIn = (event: FocusEvent) => {
      held = event.target;
    };
    const onFocusOut = (event: FocusEvent) => {
      const left = event.target;
      // A browser may say focusout for a removed element too: that one stays
      // held, for the observer to bring the focus back.
      queueMicrotask(() => {
        if (
          held === left &&
          left instanceof Node &&
          left.isConnected &&
          !el.contains(document.activeElement)
        ) {
          held = null;
        }
      });
    };
    const observer = new MutationObserver(() => {
      const active = document.activeElement;
      const lost = !active || active === document.body;
      if (held instanceof Node && !held.isConnected && lost) {
        held = null;
        (document.getElementById(PANEL_TITLE_ID) ?? el).focus({
          preventScroll: true,
        });
      }
    });
    el.addEventListener("focusin", onFocusIn);
    el.addEventListener("focusout", onFocusOut);
    observer.observe(el, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("focusin", onFocusIn);
      el.removeEventListener("focusout", onFocusOut);
    };
  }, [wrapper]);
}

function DockedPanel({
  contract,
  route,
  showContract,
}: {
  contract: ContractDetail;
  route: PanelRoute;
  showContract: boolean;
}) {
  const wrapper = useRef<HTMLDivElement>(null);
  const nav = usePanelNavigation(route, () => wrapper.current);
  const onKeyDown = usePanelKeys({
    onClose: nav.close,
    onNext: nav.goNext,
    onPrev: nav.goPrev,
  });
  // Heard on the DOM, not through React's tree: a dialog opened from the
  // panel (a portal) keeps its own keys, Esc included.
  useEffect(() => {
    const el = wrapper.current;
    el?.addEventListener("keydown", onKeyDown);
    return () => el?.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);
  useKeepFocus(wrapper);
  return (
    // The boundary's own wrapper is a flex column too, so the column can
    // shrink to the side's height and scroll inside. It holds the focus
    // while the content remounts or loads.
    <div
      className="lateral:flex hidden min-h-0 lateral:flex-col outline-none [&>div]:flex [&>div]:min-h-0 [&>div]:flex-col"
      data-testid="installment-panel-docked"
      ref={wrapper}
      tabIndex={-1}
    >
      <SectionBoundary fallback={<PanelSkeleton mode="docked" />}>
        <InstallmentPanel
          contract={contract}
          key={route.installmentId}
          mode="docked"
          nav={nav}
          route={route}
          showContract={showContract}
        />
      </SectionBoundary>
    </div>
  );
}

/** The sheet's body: the variant only exists inside the sheet. */
function SheetBody({
  contract,
  nav,
  route,
}: {
  contract: ContractDetail;
  nav: PanelNavigation;
  route: PanelRoute;
}) {
  const mode = useSheetVariant() ?? "side";
  return (
    // As tall as the sheet's body, through the boundary's own wrapper, so the
    // panel's foot sits at the bottom of the floating panel (mockup 14, A at
    // 1280); the bottom sheet is as tall as its content anyway.
    <div className="flex min-h-full flex-col [&>div]:flex [&>div]:flex-1 [&>div]:flex-col">
      <SectionBoundary fallback={<PanelSkeleton mode={mode} />}>
        <InstallmentPanel
          contract={contract}
          key={route.installmentId}
          mode={mode}
          nav={nav}
          route={route}
        />
      </SectionBoundary>
    </div>
  );
}

function SheetPanel({
  contract,
  installment,
  open,
  route,
}: {
  contract: ContractDetail;
  installment: ContractInstallment;
  /** False while the sheet slides out: it still draws the installment it was showing. */
  open: boolean;
  route: PanelRoute;
}) {
  const nav = usePanelNavigation(route, () => null);
  const { cancelWork } = usePanel();
  // Closed by any road, the browser's Back included (not only nav.close): the
  // proof on its way stops while the sheet slides out (M12).
  useEffect(() => {
    if (!open) {
      cancelWork();
    }
  }, [cancelWork, open]);
  // No Esc here: in the sheet, Radix closes it.
  const onKeyDown = usePanelKeys({ onNext: nav.goNext, onPrev: nav.goPrev });
  // A footer only with something to pin: an empty one would still draw its line.
  const pinned = useSheetPrimary(contract);
  return (
    <ResponsiveSheet
      adjustReturnFocus={(opener) =>
        // ↑ ↓ moved on from the line that opened the panel: Esc goes back to
        // the line (or group) it stopped on (DIRECAO: "devolve o foco à linha").
        // A card's button that opened it keeps the focus.
        opener?.closest("[data-installment-row], [data-group-ids]")
          ? rowOrGroup(installment.id)
          : opener
      }
      description={contract.contract.title}
      // "Histórico" closes the sheet and takes the list away: the focus goes
      // to the tab now shown.
      fallbackFocus={() =>
        rowOrGroup(installment.id) ??
        document.querySelector<HTMLElement>(
          '[data-testid="contract-tabs"] [aria-checked="true"]'
        )
      }
      filledControls
      focusFrame
      footer={
        pinned ? (
          <SheetFooter contract={contract} key={installment.id} />
        ) : undefined
      }
      headerActions={<PanelArrows nav={nav} />}
      onKeyDown={onKeyDown}
      onOpenChange={(next) => {
        if (!next) {
          nav.close();
        }
      }}
      open={open}
      title={m.panel_title({
        sequence: installment.sequence,
        count: contract.installments.length,
      })}
    >
      <SheetBody contract={contract} nav={nav} route={route} />
    </ResponsiveSheet>
  );
}

/**
 * The panel's openings: `shown` is the last installment shown (the sheet
 * slides out still drawing it, instead of vanishing the moment the URL lets it
 * go), and `session` goes up each time the panel opens from closed. Kept as
 * state adjusted on the id's change, not a ref written during render.
 */
function useOpening(id: string | null) {
  const [opening, setOpening] = useState({ id, shown: id, session: 0 });
  if (opening.id === id) {
    return opening;
  }
  const next = {
    id,
    shown: id ?? opening.shown,
    session: opening.id === null ? opening.session + 1 : opening.session,
  };
  setOpening(next);
  return next;
}

/**
 * One tree for the panel (planner's decisions 16 and 34): from lateral a
 * docked column, below it the ResponsiveSheet (floating from md, bottom sheet
 * below). Neither remounts when the installment changes: only the content
 * does (keyed by the id), so ↑ ↓ walk without closing, and the keyboard is
 * heard on a wrapper that stays mounted. The server renders the column
 * (hidden by CSS below lateral); after hydration a narrow screen swaps to the
 * sheet.
 */
export function InstallmentPanelHost({
  contract,
  route,
  showContract = false,
}: {
  contract: ContractDetail;
  route: PanelRoute;
  /** The docked header names the contract (Parcelas). */
  showContract?: boolean;
}) {
  const docked = useMediaQuery(LATERAL_UP, true);
  const id = route.installmentId;
  const opening = useOpening(id);
  const shownId = id ?? (docked ? null : opening.shown);
  const installment = shownId
    ? contract.installments.find((it) => it.id === shownId)
    : undefined;
  if (!(shownId && installment)) {
    return null;
  }
  return (
    // A new opening starts clean (no dispute form, refused file or "copiado
    // às" from the last time); ↑ ↓ and the slide-out keep the same provider.
    <PanelProvider
      contractId={contract.contract.id}
      installmentId={shownId}
      key={opening.session}
    >
      {docked ? (
        <DockedPanel
          contract={contract}
          route={route}
          showContract={showContract}
        />
      ) : (
        <SheetPanel
          contract={contract}
          installment={installment}
          open={Boolean(id)}
          route={route}
        />
      )}
    </PanelProvider>
  );
}

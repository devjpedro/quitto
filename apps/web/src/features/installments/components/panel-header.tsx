import { CaretDown, CaretUp, type Icon, X } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { FILLED_SQUARE } from "@/components/ui/responsive-sheet";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import type { PanelNavigation } from "../hooks/use-panel-navigation";

/** The panel's title: the host takes the focus here on open and on every step (planner's decision 34). */
export const PANEL_TITLE_ID = "installment-panel-title";

/** The column's square controls (mockup 14: 32 px, filled, as the blocks under them). */
function SquareButton({
  disabled,
  icon: IconComponent,
  label,
  onClick,
}: {
  disabled?: boolean;
  icon: Icon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-control bg-surface-inset text-ink transition-colors hover:bg-surface-inset-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card active:scale-[.97] disabled:pointer-events-none disabled:opacity-40 motion-reduce:active:scale-100"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <IconComponent aria-hidden="true" size={16} />
    </button>
  );
}

/** ↑ ↓ in the floating sheet's header, beside its close button: the same filled squares as the column's. */
export function PanelArrows({ nav }: { nav: PanelNavigation }) {
  return (
    <>
      <IconButton
        className={FILLED_SQUARE}
        disabled={!nav.prev || nav.busy}
        icon={CaretUp}
        label={m.panel_prev()}
        onClick={nav.goPrev}
      />
      <IconButton
        className={FILLED_SQUARE}
        disabled={!nav.next || nav.busy}
        icon={CaretDown}
        label={m.panel_next()}
        onClick={nav.goNext}
      />
    </>
  );
}

/**
 * The docked column's header (≥1440): "Parcela 4 de 10" in Bricolage 19/600,
 * the arrows and the close. The title takes the focus without a ring unless
 * it came from the keyboard. In the sheets, the ResponsiveSheet draws its own.
 */
export function PanelHeader({
  className,
  nav,
  subtitle,
  title,
}: {
  className?: string;
  nav: PanelNavigation;
  /** Which contract, when the panel is away from its page (Parcelas). */
  subtitle?: ReactNode;
  title: string;
}) {
  return (
    <div className={cn("flex min-h-9 items-center gap-1.5", className)}>
      <div className="mr-auto min-w-0">
        {/* As wide as its words, so the keyboard's ring hugs them. */}
        <h2
          className="max-w-full truncate rounded-[6px] font-display font-semibold text-[19px] leading-[1.2] tracking-[-0.02em] outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card"
          id={PANEL_TITLE_ID}
          tabIndex={-1}
        >
          {title}
        </h2>
        {subtitle}
      </div>
      <SquareButton
        disabled={!nav.prev || nav.busy}
        icon={CaretUp}
        label={m.panel_prev()}
        onClick={nav.goPrev}
      />
      <SquareButton
        disabled={!nav.next || nav.busy}
        icon={CaretDown}
        label={m.panel_next()}
        onClick={nav.goNext}
      />
      <SquareButton icon={X} label={m.panel_close()} onClick={nav.close} />
    </div>
  );
}

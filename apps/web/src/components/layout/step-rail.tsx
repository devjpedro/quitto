import type { Icon } from "@phosphor-icons/react";
import { StepAnchor, type StepState } from "@/components/ui/step-anchor";
import { cn } from "@/lib/utils";
import { SHELL_COLUMN, ShellLogoRow } from "./shell-frame";

export interface RailStep {
  label: string;
  /** "Passo 2 de 4", or the trail's date ("domingo, 04/10"); the invite's middle step has none. */
  meta?: string;
  /** A done step is a button back to it; the others are not. */
  onSelect?: () => void;
  state: StepState;
}

// On the canvas, with the sidebar's link states (DIRECAO › Telas › Wizard):
// done = nav-hover on hover, focus inside; the current one is the white row.
const ROW =
  "flex w-full items-start gap-3 rounded-control px-3 py-2.5 text-left transition-colors";
const DONE =
  "hover:bg-nav-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset";

function RailText({
  order,
  step,
}: {
  order: "meta-first" | "label-first";
  step: RailStep;
}) {
  const current = step.state === "next";
  const meta = step.meta ? (
    <small
      className={cn(
        "block text-xs tabular-nums leading-[1.3]",
        current && order === "meta-first"
          ? "font-medium text-brand"
          : "text-ink-muted",
        order === "label-first" && "mt-0.5"
      )}
    >
      {step.meta}
    </small>
  ) : null;
  const label = (
    <b
      className={cn(
        "block text-sm leading-[1.35]",
        current ? "font-semibold" : "font-medium",
        step.state === "todo" && "text-ink-muted",
        order === "meta-first" && "mt-0.5"
      )}
    >
      {step.label}
    </b>
  );
  return (
    <span className="min-w-0 pt-px">
      {order === "meta-first" ? meta : label}{" "}
      {order === "meta-first" ? label : meta}
    </span>
  );
}

/**
 * The steps where the sidebar is (owner's decision 1): the same 232 px
 * column on the canvas, the logo in the same place, the group label at the
 * height of "Carteira" and the steps where the navigation starts. Anchors
 * from the guide, joined by a track that fills with brand; the foot, where
 * the account is in the app, says what the screen promises. No account here
 * (owner's decision 6).
 */
export function StepRail({
  footer,
  footerIcon: FooterIcon,
  group,
  order,
  steps,
}: {
  footer: string;
  footerIcon: Icon;
  group: string;
  order: "meta-first" | "label-first";
  steps: RailStep[];
}) {
  return (
    <aside
      aria-label={group}
      className={SHELL_COLUMN}
      data-testid="wizard-rail"
    >
      <ShellLogoRow />
      {/* 72 px = the sidebar's search (16 + 40) and the gap before "Carteira" (16). */}
      <p className="mt-[72px] mb-1 px-3 text-ink-muted text-xs">{group}</p>
      <ol className="flex flex-col gap-1">
        {steps.map((step, index) => (
          <li
            aria-current={step.state === "next" ? "step" : undefined}
            className="motion-safe:fade-in relative motion-safe:animate-in motion-safe:duration-150"
            key={step.label}
          >
            {index < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-[38px] -bottom-2.5 left-[23px] w-0.5 rounded-[1px]",
                  step.state === "done" ? "bg-brand" : "bg-track"
                )}
              />
            ) : null}
            {step.onSelect ? (
              <button
                className={cn(ROW, DONE)}
                data-state={step.state}
                onClick={step.onSelect}
                type="button"
              >
                <StepAnchor state={step.state} />
                <RailText order={order} step={step} />
              </button>
            ) : (
              <div
                className={cn(ROW, step.state === "next" && "bg-surface")}
                data-state={step.state}
              >
                <StepAnchor state={step.state} />
                <RailText order={order} step={step} />
              </div>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-auto flex items-start gap-2 px-3 pb-3.5 text-[12.5px] text-ink-muted leading-[1.45]">
        <FooterIcon
          aria-hidden="true"
          className="mt-px shrink-0 text-brand"
          size={16}
        />
        {footer}
      </p>
    </aside>
  );
}

import { Check, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import type { TrailStep } from "../lib/status-trail";

const RING: Record<TrailStep["tone"], string> = {
  brand: "ring-brand",
  warning: "ring-warning",
  danger: "ring-danger",
};
const FILL: Record<TrailStep["tone"], string> = {
  brand: "bg-brand",
  warning: "bg-warning",
  danger: "bg-danger",
};
const SUB: Record<TrailStep["tone"], string> = {
  brand: "text-ink-muted",
  warning: "text-warning",
  danger: "text-danger",
};

function Dot({ step }: { step: TrailStep }) {
  const base =
    "absolute top-0 left-0 z-[1] flex size-5 items-center justify-center rounded-full";
  if (step.state === "done") {
    return (
      <span aria-hidden="true" className={cn(base, "bg-brand text-surface")}>
        <Check size={11} weight="bold" />
      </span>
    );
  }
  if (step.state === "bad") {
    return (
      <span aria-hidden="true" className={cn(base, "bg-danger text-surface")}>
        <X size={11} weight="bold" />
      </span>
    );
  }
  if (step.state === "current") {
    return (
      <span
        aria-hidden="true"
        className={cn(base, "ring-2 ring-inset", RING[step.tone])}
      >
        <span className={cn("size-2 rounded-full", FILL[step.tone])} />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(base, "ring-[1.5px] ring-line-strong ring-inset")}
    />
  );
}

/**
 * The panel's top under the amount (DIRECAO › Contrato): one step per stage,
 * each with its date or who acts. The state is said in words under every
 * step, and the current one is marked for a screen reader.
 */
export function StatusTrail({ steps }: { steps: TrailStep[] }) {
  return (
    <ol
      aria-label={m.panel_trail_label()}
      className="mt-3 grid"
      data-testid="status-trail"
      style={{
        gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
      }}
    >
      {steps.map((step, index) => (
        <li
          aria-current={step.state === "current" ? "step" : undefined}
          className="relative min-w-0 pt-[26px] pr-2"
          key={step.key}
        >
          {index < steps.length - 1 ? (
            <span
              aria-hidden="true"
              className={cn(
                "absolute top-[9px] right-1.5 left-[26px] h-0.5 rounded-full",
                step.state === "done" ? "bg-brand" : "bg-track"
              )}
            />
          ) : null}
          <Dot step={step} />
          <span
            className={cn(
              "block text-[13px] leading-[1.3]",
              step.state === "todo"
                ? "font-medium text-ink-muted"
                : "font-semibold text-ink"
            )}
          >
            {step.name}
          </span>{" "}
          <span
            className={cn(
              "mt-px block truncate text-xs tabular-nums",
              step.state === "current" ? SUB[step.tone] : "text-ink-muted"
            )}
          >
            {step.sub}
          </span>
        </li>
      ))}
    </ol>
  );
}

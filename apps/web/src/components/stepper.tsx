import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

interface Step {
  label: string;
}

/** Numbered step indicator. Completed steps (index < current) are clickable to go back. */
export function Stepper({
  steps,
  current,
  onStepClick,
}: {
  steps: Step[];
  current: number;
  onStepClick: (index: number) => void;
}) {
  return (
    <ol className="flex items-center gap-2">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li className="flex items-center gap-2" key={step.label}>
            <button
              aria-current={active ? "step" : undefined}
              aria-label={step.label}
              className={cn(
                "flex size-7 items-center justify-center rounded-full border-2 font-bold font-display text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 disabled:cursor-default",
                done &&
                  "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700",
                active && "border-primary bg-primary text-primary-foreground",
                !(done || active) &&
                  "border-border bg-background text-muted-foreground"
              )}
              disabled={!done}
              onClick={() => onStepClick(index)}
              type="button"
            >
              {done ? <Check className="size-4" /> : index + 1}
            </button>
            <span
              className={cn(
                "text-sm transition-colors",
                active
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {step.label}
            </span>
            {index < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  "mx-1 h-0.5 w-6 rounded-full transition-colors",
                  done ? "bg-emerald-600" : "bg-border"
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

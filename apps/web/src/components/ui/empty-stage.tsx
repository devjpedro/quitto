import { Check, type Icon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { ProgressRing } from "@/components/ui/progress-ring";

/**
 * The empty state of a list (mockup 20, B8): the wizard's dotted stage with
 * no ghost card. The anchor is the logo's ring: only the track on a new
 * account (with the screen's icon), full with a ✓ when everything is paid or
 * up to date (it is the end, not an error). Title, one sentence, the actions.
 */
export function EmptyStage({
  actions,
  description,
  icon: IconComponent,
  state,
  title,
}: {
  actions?: ReactNode;
  description: string;
  icon: Icon;
  /** "new": nothing yet. "done": all paid or up to date. */
  state: "new" | "done";
  title: string;
}) {
  return (
    <div className="empty-stage relative flex flex-col items-center gap-2 rounded-card bg-surface-card px-6 py-12 text-center md:py-16">
      <span
        aria-hidden="true"
        className="relative mb-2 flex size-14 items-center justify-center rounded-full bg-surface"
      >
        <ProgressRing
          className="absolute inset-0 size-14"
          percent={state === "done" ? 100 : 0}
          size={56}
        />
        {state === "done" ? (
          <Check className="text-brand" size={22} weight="bold" />
        ) : (
          <IconComponent className="text-brand" size={22} />
        )}
      </span>
      <h2 className="font-display font-semibold text-[19px] text-ink leading-tight tracking-[-0.02em]">
        {title}
      </h2>
      <p className="max-w-sm text-ink-muted text-sm leading-relaxed">
        {description}
      </p>
      {actions ? (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

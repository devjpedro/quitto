import type { Icon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONE = {
  brand: "bg-brand-subtle text-brand",
  warning: "bg-warning-subtle text-warning",
  neutral: "bg-surface-card text-ink-muted",
} as const;

/** A state's anchor, title and sentence (mockup 15, H3–H7): the 48 px tile tinted by the state. */
export function StateHeading({
  children,
  icon: StateIcon,
  title,
  tone,
}: {
  children?: ReactNode;
  icon: Icon;
  title: string;
  tone: keyof typeof TONE;
}) {
  return (
    <div className="flex flex-col items-start">
      <span
        aria-hidden="true"
        className={cn(
          "flex size-12 items-center justify-center rounded-card",
          TONE[tone]
        )}
      >
        <StateIcon size={26} />
      </span>
      <h1 className="mt-4 font-display font-semibold text-2xl leading-[1.2] tracking-[-0.03em] md:text-[26px]">
        {title}
      </h1>
      {children ? (
        <p className="mt-2 text-ink-muted text-sm leading-[1.45]">{children}</p>
      ) : null}
    </div>
  );
}

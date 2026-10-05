import { Check } from "@phosphor-icons/react";

export type StepState = "done" | "next" | "todo";

/** The step's state is the row's anchor (mockup 13): filled with a check, a ring with a dot, a dashed circle. */
export function StepAnchor({ state }: { state: StepState }) {
  if (state === "done") {
    // ink-inverse, not on-brand: in dark the brand turns light green and a
    // light check on it would read at 1.73:1.
    return (
      <span
        aria-hidden="true"
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-ink-inverse"
      >
        <Check size={13} weight="bold" />
      </span>
    );
  }
  if (state === "next") {
    return (
      <span
        aria-hidden="true"
        className="flex size-6 shrink-0 items-center justify-center rounded-full ring-2 ring-brand ring-inset"
      >
        <span className="size-2 rounded-full bg-brand" />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="size-6 shrink-0 rounded-full border-[1.5px] border-ink-muted border-dashed"
    />
  );
}

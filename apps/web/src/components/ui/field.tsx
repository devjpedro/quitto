import { Warning, WarningCircle } from "@phosphor-icons/react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface FieldProps {
  className?: string;
  counter?: string;
  error?: string;
  hint?: string;
  id: string;
  label: string;
  warning?: string;
}

// DIRECAO › Forma: field-line at rest, ink-muted on hover; focus, error and
// warning swap the outline for a 2 px ring (brand, danger, warning).
const CONTROL =
  "w-full rounded-control bg-surface text-ink text-sm placeholder:text-ink-muted transition-colors focus-visible:outline-none";

function controlState(error?: string, warning?: string): string {
  if (error) {
    return "border border-transparent ring-2 ring-danger";
  }
  if (warning) {
    return "border border-transparent ring-2 ring-warning";
  }
  return "border border-field-line hover:border-ink-muted focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-brand";
}

function Frame({
  children,
  className,
  counter,
  error,
  hint,
  id,
  label,
  warning,
}: FieldProps & { children: ReactNode }) {
  const note = error ?? warning ?? hint;
  const NoteIcon = error ? WarningCircle : Warning;
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label className="font-semibold text-[13px] text-ink" htmlFor={id}>
          {label}
        </label>
        {counter ? (
          <span className="text-ink-muted text-xs tabular-nums">{counter}</span>
        ) : null}
      </div>
      {children}
      {note ? (
        <p
          className={cn(
            "mt-2 flex items-start gap-1.5 text-[12.5px] leading-[1.45]",
            error && "text-danger",
            !error && warning && "text-warning",
            !(error || warning) && "text-ink-muted"
          )}
          id={`${id}-note`}
        >
          {error || warning ? (
            <NoteIcon aria-hidden="true" className="mt-px shrink-0" size={16} />
          ) : null}
          {note}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  className,
  counter,
  error,
  hint,
  id,
  label,
  warning,
  ...input
}: FieldProps & Omit<ComponentProps<"input">, "id">) {
  const note = error ?? warning ?? hint;
  return (
    <Frame {...{ className, counter, error, hint, id, label, warning }}>
      <input
        aria-describedby={note ? `${id}-note` : undefined}
        aria-invalid={error ? true : undefined}
        className={cn(
          CONTROL,
          "h-11 px-3 md:h-10",
          controlState(error, warning)
        )}
        id={id}
        {...input}
      />
    </Frame>
  );
}

export function TextArea({
  className,
  counter,
  error,
  hint,
  id,
  label,
  warning,
  ...textarea
}: FieldProps & Omit<ComponentProps<"textarea">, "id">) {
  const note = error ?? warning ?? hint;
  return (
    <Frame {...{ className, counter, error, hint, id, label, warning }}>
      <textarea
        aria-describedby={note ? `${id}-note` : undefined}
        aria-invalid={error ? true : undefined}
        className={cn(
          CONTROL,
          "min-h-[84px] resize-y px-3 py-2.5 leading-[1.45]",
          controlState(error, warning)
        )}
        id={id}
        {...textarea}
      />
    </Frame>
  );
}

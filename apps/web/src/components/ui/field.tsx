import { Warning, WarningCircle } from "@phosphor-icons/react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface FieldProps {
  className?: string;
  counter?: string;
  error?: string;
  hint?: string;
  id: string;
  /** A string, or a sentence with a part in bold ("Digite EXCLUIR para confirmar"). */
  label: ReactNode;
  /** On the label's row, at the end: a link that belongs to the field ("Esqueci a senha"). */
  labelAside?: ReactNode;
  /** The label only for the screen reader (the column header says what it is). */
  labelHidden?: boolean;
  /** After the label, in ink-muted, inside the <label>. */
  optionalLabel?: string;
  warning?: string;
}

// DIRECAO › Forma: field-line at rest, ink-muted on hover; focus, error and
// warning swap the outline for a 2 px ring (brand, danger, warning).
const CONTROL =
  "w-full rounded-control bg-surface text-ink text-sm placeholder:text-ink-muted transition-colors focus-visible:outline-none";

function controlState(
  error?: string,
  warning?: string,
  invalid?: boolean
): string {
  if (error || invalid) {
    return "border border-transparent ring-2 ring-danger";
  }
  if (warning) {
    return "border border-transparent ring-2 ring-warning";
  }
  return "border border-field-line hover:border-ink-muted focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-brand";
}

/** The note under a field or an option group: an error or a warning with its icon, or a hint. */
export function FieldNote({
  error,
  hint,
  id,
  warning,
}: {
  error?: string;
  hint?: string;
  id: string;
  warning?: string;
}) {
  const note = error ?? warning ?? hint;
  if (!note) {
    return null;
  }
  const NoteIcon = error ? WarningCircle : Warning;
  return (
    <p
      className={cn(
        "mt-2 flex items-start gap-1.5 text-[12.5px] leading-[1.45]",
        error && "font-medium text-danger",
        !error && warning && "font-medium text-warning",
        !(error || warning) && "text-ink-muted"
      )}
      id={`${id}-note`}
    >
      {error || warning ? (
        <NoteIcon
          aria-hidden="true"
          className="mt-px shrink-0"
          size={16}
          weight="fill"
        />
      ) : null}
      {note}
    </p>
  );
}

function Frame({
  children,
  className,
  counter,
  error,
  hint,
  id,
  label,
  labelAside,
  labelHidden,
  optionalLabel,
  warning,
}: FieldProps & { children: ReactNode }) {
  return (
    <div className={cn("flex flex-col", className)}>
      <div
        className={cn(
          "mb-2 flex items-baseline justify-between gap-3",
          labelHidden && "sr-only"
        )}
      >
        <label className="font-semibold text-[13px] text-ink" htmlFor={id}>
          {label}
          {optionalLabel ? (
            <>
              {" "}
              <span className="font-normal text-ink-muted">
                {optionalLabel}
              </span>
            </>
          ) : null}
        </label>
        {counter ? (
          <span className="text-ink-muted text-xs tabular-nums">{counter}</span>
        ) : null}
        {labelAside}
      </div>
      {children}
      <FieldNote error={error} hint={hint} id={id} warning={warning} />
    </div>
  );
}

export function TextField({
  action,
  className,
  counter,
  error,
  hint,
  id,
  inputClassName,
  label,
  labelAside,
  labelHidden,
  leading,
  optionalLabel,
  tall = false,
  trailing,
  warning,
  ...input
}: FieldProps &
  Omit<ComponentProps<"input">, "id"> & {
    /** Inside the box, on the right, and interactive (the password's eye): a 44 px target. */
    action?: ReactNode;
    /** The class of the <input> itself (the wrapper takes className). */
    inputClassName?: string;
    /** Inside the box, on the left: "R$", an avatar. Decorative: the label names the field. */
    leading?: ReactNode;
    /** The wizard's field: 48 px (16 px text, no zoom on iOS) on a phone, 46 px from md. */
    tall?: boolean;
    /** Inside the box, on the right: "parcelas", the calendar icon. Decorative. */
    trailing?: ReactNode;
  }) {
  const note = error ?? warning ?? hint;
  return (
    <Frame
      {...{
        className,
        counter,
        error,
        hint,
        id,
        label,
        labelAside,
        labelHidden,
        optionalLabel,
        warning,
      }}
    >
      <div className="relative">
        {leading ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-ink-muted text-sm"
          >
            {leading}
          </span>
        ) : null}
        <input
          aria-describedby={note ? `${id}-note` : undefined}
          aria-invalid={error ? true : undefined}
          className={cn(
            CONTROL,
            tall
              ? "h-12 px-3.5 text-base md:h-[46px] md:text-[15px]"
              : "h-11 px-3 md:h-10",
            leading && "pl-11",
            trailing && "pr-24",
            action && "pr-12",
            // The wizard's figures line up; the Phase 2 fields keep their text as it was.
            tall && "tabular-nums",
            controlState(
              error,
              warning,
              input["aria-invalid"] === true || input["aria-invalid"] === "true"
            ),
            inputClassName
          )}
          id={id}
          {...input}
        />
        {action ? (
          <span className="absolute inset-y-0 right-0 flex items-center">
            {action}
          </span>
        ) : null}
        {trailing ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center gap-1 text-[13.5px] text-ink-muted"
          >
            {trailing}
          </span>
        ) : null}
      </div>
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
  labelHidden,
  optionalLabel,
  warning,
  ...textarea
}: FieldProps & Omit<ComponentProps<"textarea">, "id">) {
  const note = error ?? warning ?? hint;
  return (
    <Frame
      {...{
        className,
        counter,
        error,
        hint,
        id,
        label,
        labelHidden,
        optionalLabel,
        warning,
      }}
    >
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

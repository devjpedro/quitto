import { CalendarBlank } from "@phosphor-icons/react";
import { Popover } from "radix-ui";
import { useEffect, useState } from "react";
import { MD_UP, useMediaQuery } from "@/hooks/use-media-query";
import {
  dateInputPlaceholder,
  formatDateInput,
  maskDateInput,
  parseDateInput,
} from "@/lib/date-input";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { Calendar } from "./calendar";
import { TextField } from "./field";
import { ResponsiveSheet } from "./responsive-sheet";

/**
 * A calendar date, typed or picked (mockup 20, B6). The field takes
 * "dd/mm/aaaa" ("mm/dd/yyyy" in English) and the calendar icon opens the
 * month: a popover beside the field from md up, a bottom sheet on a phone.
 * The value is the ISO date, "" while what is typed is not yet a real day.
 */
export function DateField({
  error,
  hint,
  id,
  label,
  labelHidden,
  min,
  name,
  onBlur,
  onValueChange,
  tall,
  value,
  warning,
}: {
  error?: string;
  hint?: string;
  id: string;
  label: string;
  labelHidden?: boolean;
  /** The earliest day the calendar lets through (ISO). */
  min?: string;
  name?: string;
  onBlur?: () => void;
  onValueChange: (iso: string) => void;
  tall?: boolean;
  value: string;
  warning?: string;
}) {
  const locale = getLocale();
  const wide = useMediaQuery(MD_UP);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => formatDateInput(value, locale));
  // A value that arrives from outside (the calendar, "Desfazer") shows up; a half-typed date keeps its digits.
  useEffect(() => {
    if ((parseDateInput(text, locale) ?? "") !== value) {
      setText(formatDateInput(value, locale));
    }
  }, [locale, text, value]);
  const pick = (iso: string) => {
    onValueChange(iso);
    setText(formatDateInput(iso, locale));
    setOpen(false);
  };
  const calendar = (
    <Calendar locale={locale} min={min} onSelect={pick} value={value} />
  );
  const opener = (
    <button
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-label={m.date_field_open()}
      className="mr-1 flex size-11 items-center justify-center rounded-control text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand md:size-9"
      onClick={() => setOpen((current) => !current)}
      type="button"
    >
      <CalendarBlank aria-hidden="true" size={18} />
    </button>
  );
  return (
    <Popover.Root onOpenChange={setOpen} open={wide && open}>
      <Popover.Anchor asChild>
        <div>
          <TextField
            action={
              wide ? (
                <Popover.Trigger asChild>{opener}</Popover.Trigger>
              ) : (
                opener
              )
            }
            autoComplete="off"
            error={error}
            hint={hint}
            id={id}
            inputClassName="tabular-nums"
            inputMode="numeric"
            label={label}
            labelHidden={labelHidden}
            name={name}
            onBlur={onBlur}
            onChange={(event) => {
              const masked = maskDateInput(event.target.value);
              setText(masked);
              onValueChange(parseDateInput(masked, locale) ?? "");
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" && event.altKey) {
                event.preventDefault();
                setOpen(true);
              }
            }}
            placeholder={dateInputPlaceholder(locale)}
            tall={tall}
            value={text}
            warning={warning}
          />
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="end"
          className="z-50 rounded-card bg-surface p-3 text-ink shadow-float ring-1 ring-ink/[.06] focus:outline-none"
          collisionPadding={12}
          onOpenAutoFocus={(event) => {
            // The calendar puts the focus on its own day.
            event.preventDefault();
          }}
          side="left"
          sideOffset={14}
        >
          {calendar}
        </Popover.Content>
      </Popover.Portal>
      {wide ? null : (
        <ResponsiveSheet onOpenChange={setOpen} open={open} title={label}>
          {calendar}
        </ResponsiveSheet>
      )}
    </Popover.Root>
  );
}

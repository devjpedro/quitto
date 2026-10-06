import { CalendarBlank } from "@phosphor-icons/react";
import { TextField } from "./field";

/**
 * A calendar date with the browser's own input (planner's decision 29):
 * the system picker on a phone, no day that does not exist. Clicking the
 * field opens the picker; the icon is the field's mark.
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
  min?: string;
  name?: string;
  onBlur?: () => void;
  onValueChange: (iso: string) => void;
  tall?: boolean;
  value: string;
  warning?: string;
}) {
  return (
    <TextField
      error={error}
      hint={hint}
      id={id}
      // The icon's room only: the cn's tailwind-merge swaps the text suffix's pr-24 for pr-10,
      // so "10/11/2026" fits the narrow date column of "uma a uma".
      inputClassName="pr-10 tabular-nums [&::-webkit-calendar-picker-indicator]:opacity-0"
      label={label}
      labelHidden={labelHidden}
      min={min}
      name={name}
      onBlur={onBlur}
      onChange={(event) => onValueChange(event.target.value)}
      onClick={(event) => event.currentTarget.showPicker?.()}
      tall={tall}
      trailing={<CalendarBlank size={18} />}
      type="date"
      value={value}
      warning={warning}
    />
  );
}

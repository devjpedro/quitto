import { Calendar as CalendarIcon } from "lucide-react";
import { useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  dateToISO,
  formatISODateBR,
  maskBRDate,
  parseBRDateToISO,
  parseISOToLocalDate,
} from "@/lib/format";

function DateInput({
  id,
  value,
  onChange,
  onBlur,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: {
  id: string;
  value: string;
  onChange: (iso: string) => void;
  onBlur: () => void;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const [text, setText] = useState(value ? formatISODateBR(value) : "");
  const [open, setOpen] = useState(false);
  const selected = value ? parseISOToLocalDate(value) : undefined;

  return (
    <div className="relative mt-1.5">
      <Input
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        className="tabular-nums"
        id={id}
        inputMode="numeric"
        onBlur={onBlur}
        onChange={(e) => {
          const masked = maskBRDate(e.target.value);
          setText(masked);
          onChange(parseBRDateToISO(masked) ?? "");
        }}
        placeholder="dd/mm/aaaa"
        value={text}
      />
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger
          aria-label="Escolher data no calendário"
          className="absolute inset-y-0 right-2 my-auto flex h-5 w-5 cursor-pointer items-center justify-center text-muted-foreground opacity-70 transition-opacity hover:opacity-100"
          type="button"
        >
          <CalendarIcon className="size-4" />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto">
          <Calendar
            onSelect={(d) => {
              if (d) {
                const iso = dateToISO(d);
                onChange(iso);
                setText(formatISODateBR(iso));
              }
              setOpen(false);
            }}
            selected={selected}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** RHF-bound date field: types as dd/mm/yyyy (masked) or picks via calendar popover; stores ISO. */
export function DateField({
  name,
  id,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: {
  name: string;
  id: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const { control } = useFormContext();
  return (
    <Controller
      control={control}
      name={name as never}
      render={({ field }) => (
        <DateInput
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          id={id}
          onBlur={field.onBlur}
          onChange={field.onChange}
          value={typeof field.value === "string" ? field.value : ""}
        />
      )}
    />
  );
}

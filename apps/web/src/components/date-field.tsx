import { useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { formatISODateBR, maskBRDate, parseBRDateToISO } from "@/lib/format";

function DateInput({
  id,
  value,
  onChange,
  onBlur,
}: {
  id: string;
  value: string;
  onChange: (iso: string) => void;
  onBlur: () => void;
}) {
  const [text, setText] = useState(value ? formatISODateBR(value) : "");
  return (
    <div className="relative mt-1.5">
      <Input
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
      <input
        aria-label="Escolher data no calendário"
        className="absolute inset-y-0 right-2 my-auto h-5 w-5 cursor-pointer opacity-70"
        onChange={(e) => {
          const iso = e.target.value;
          onChange(iso);
          setText(iso ? formatISODateBR(iso) : "");
        }}
        type="date"
        value={value ?? ""}
      />
    </div>
  );
}

/** RHF-bound date field: types as dd/mm/yyyy (masked) or picks via native calendar; stores ISO. */
export function DateField({ name, id }: { name: string; id: string }) {
  const { control } = useFormContext();
  return (
    <Controller
      control={control}
      name={name as never}
      render={({ field }) => (
        <DateInput
          id={id}
          onBlur={field.onBlur}
          onChange={field.onChange}
          value={typeof field.value === "string" ? field.value : ""}
        />
      )}
    />
  );
}

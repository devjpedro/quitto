import { Controller, useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/format";

const NON_DIGIT = /\D/g;

/** Currency input: shows R$ formatted, stores integer cents. Digits accumulate from the right. */
export function CurrencyField({
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
      render={({ field }) => {
        const cents = typeof field.value === "number" ? field.value : 0;
        return (
          <Input
            aria-describedby={ariaDescribedBy}
            aria-invalid={ariaInvalid}
            className="mt-1.5 tabular-nums"
            id={id}
            inputMode="numeric"
            onBlur={field.onBlur}
            onChange={(e) => {
              const digits = e.target.value.replace(NON_DIGIT, "");
              field.onChange(digits === "" ? 0 : Number.parseInt(digits, 10));
            }}
            placeholder="R$ 0,00"
            value={cents > 0 ? formatBRL(cents) : ""}
          />
        );
      }}
    />
  );
}

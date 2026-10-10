import type { Locale } from "@quitto/shared";
import { type ReactNode, useEffect, useState } from "react";
import { moneyParts } from "@/lib/locale-format";
import { formatMoneyInput, parseMoneyInput } from "@/lib/money-input";
import { TextField } from "./field";

/**
 * An amount in reais: the person types freely ("6000", "6.000,00",
 * "6000.50"), the cents go up on every keystroke, and leaving the field
 * writes it the language's way. A value that changes from outside (a
 * one-tap fix) shows up while the field is not being typed in.
 */
export function MoneyField({
  error,
  hint,
  id,
  label,
  labelAside,
  labelHidden,
  locale,
  name,
  onBlur,
  onValueChange,
  readOnly,
  tall,
  value,
  warning,
  autoFocus,
}: {
  autoFocus?: boolean;
  error?: string;
  hint?: string;
  id: string;
  label: string;
  labelAside?: ReactNode;
  labelHidden?: boolean;
  locale: Locale;
  name?: string;
  onBlur?: () => void;
  onValueChange: (cents: number | null) => void;
  /** A figure the form computes (the adjusted total): shown, focusable, not typed in. */
  readOnly?: boolean;
  tall?: boolean;
  value: number | null;
  warning?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(() =>
    value === null ? "" : formatMoneyInput(value, locale)
  );
  useEffect(() => {
    if (!focused) {
      setText(value === null ? "" : formatMoneyInput(value, locale));
    }
  }, [focused, locale, value]);
  return (
    <TextField
      autoComplete="off"
      autoFocus={autoFocus}
      error={error}
      hint={hint}
      id={id}
      inputClassName="tabular-nums"
      inputMode="decimal"
      label={label}
      labelAside={labelAside}
      labelHidden={labelHidden}
      leading={moneyParts(0, locale).currency}
      name={name}
      onBlur={() => {
        setFocused(false);
        onBlur?.();
      }}
      onChange={(event) => {
        setText(event.target.value);
        onValueChange(parseMoneyInput(event.target.value));
      }}
      onFocus={() => setFocused(true)}
      placeholder={formatMoneyInput(0, locale)}
      readOnly={readOnly}
      tall={tall}
      value={text}
      warning={warning}
    />
  );
}

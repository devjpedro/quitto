import { formatMoney, moneyParts } from "@/lib/locale-format";
import { cn } from "@/lib/utils";
import { getLocale } from "@/paraglide/runtime.js";

/** BRL amount. `display` renders the integer large with "R$" and cents set back. */
export function Money({
  cents,
  size = "inline",
  className,
}: {
  cents: number;
  className?: string;
  size?: "inline" | "display";
}) {
  const locale = getLocale();
  const full = formatMoney(cents, locale);
  if (size === "inline") {
    return (
      <span className={cn("whitespace-nowrap tabular-nums", className)}>
        {full}
      </span>
    );
  }
  const parts = moneyParts(cents, locale);
  return (
    <span
      className={cn(
        "whitespace-nowrap font-display font-medium tabular-nums tracking-[-0.03em]",
        className
      )}
    >
      <span className="sr-only">{full}</span>
      <span aria-hidden="true">
        {parts.sign}
        <span className="mr-0.5 align-top font-sans text-[0.45em] tracking-normal">
          {parts.currency}
        </span>
        {parts.integer}
        <span className="text-[0.55em]">
          {parts.decimal}
          {parts.fraction}
        </span>
      </span>
    </span>
  );
}

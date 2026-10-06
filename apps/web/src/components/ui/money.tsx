import { formatMoney, moneyParts } from "@/lib/locale-format";
import { cn } from "@/lib/utils";
import { getLocale } from "@/paraglide/runtime.js";

// DIRECAO › Tipografia: the contract's hero amount 40, the card's 34, the
// milestone's 24, a list's 17, always tabular, with "R$" and the cents set back.
const DISPLAY = {
  // The contract's top (mockup 14): one step above the card's 34.
  hero: {
    root: "text-[36px] leading-[1.12] tracking-[-0.035em] md:text-[40px]",
    currency: "relative top-[0.5em] mr-1 align-top text-[14px]",
    cents: "text-[0.55em] tracking-[-0.01em]",
  },
  card: {
    root: "text-[34px] leading-[1.15] tracking-[-0.035em]",
    currency: "relative top-[0.42em] mr-[3px] align-top text-[13px]",
    cents: "text-[0.56em] tracking-[-0.01em]",
  },
  milestone: {
    root: "text-2xl leading-[1.2] tracking-[-0.03em]",
    currency: "relative top-[0.38em] mr-0.5 align-top text-[11px]",
    cents: "text-sm",
  },
  list: {
    root: "text-[17px] tracking-[-0.02em]",
    currency: "mr-[3px] text-xs",
    cents: "text-[13px]",
  },
} as const;

/**
 * BRL amount. `inline` is plain text; the other sizes set "R$" and the cents
 * back. `sign` ("+" money in, "−" money out) sits in the small "R$"; with it,
 * `cents` is read as a size, so a negative amount never shows two signs.
 */
export function Money({
  cents,
  className,
  sign,
  size = "inline",
}: {
  cents: number;
  className?: string;
  sign?: "+" | "−";
  size?: "inline" | keyof typeof DISPLAY;
}) {
  const locale = getLocale();
  const amount = sign ? Math.abs(cents) : cents;
  const full = formatMoney(amount, locale);
  const spoken = sign ? `${sign} ${full}` : full;
  if (size === "inline") {
    return (
      <span className={cn("whitespace-nowrap tabular-nums", className)}>
        {spoken}
      </span>
    );
  }
  const parts = moneyParts(amount, locale);
  const look = DISPLAY[size];
  return (
    <span
      className={cn(
        "whitespace-nowrap font-display font-medium tabular-nums",
        look.root,
        className
      )}
    >
      <span className="sr-only">{spoken}</span>
      <span aria-hidden="true">
        {parts.sign}
        <span
          className={cn("font-medium font-sans tracking-normal", look.currency)}
        >
          {sign ? `${sign} ` : ""}
          {parts.currency}
        </span>
        {parts.integer}
        <span className={look.cents}>
          {parts.decimal}
          {parts.fraction}
        </span>
      </span>
    </span>
  );
}

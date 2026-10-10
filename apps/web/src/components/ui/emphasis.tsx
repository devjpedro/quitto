import { cn } from "@/lib/utils";

/**
 * A message with one part in bold, where the part is already inside it
 * ("Você entra como **quem paga**.", "**Renata Campos** te paga"): the
 * translation keeps the whole sentence, and no text sits in the JSX.
 */
export function Emphasis({
  className,
  strong,
  strongClassName,
  text,
}: {
  className?: string;
  strong: string;
  strongClassName?: string;
  text: string;
}) {
  const at = strong ? text.indexOf(strong) : -1;
  if (at < 0) {
    return <span className={className}>{text}</span>;
  }
  return (
    <span className={className}>
      {text.slice(0, at)}
      <b className={cn("font-medium text-ink", strongClassName)}>{strong}</b>
      {text.slice(at + strong.length)}
    </span>
  );
}

import type { CSSProperties, ReactNode } from "react";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

/**
 * The showcase's panel (DIRECAO › Autenticação: vitrine): Floresta, the white
 * wordmark and a field of dots. The panel's children are positioned (the dots
 * sit under them), and a phone gets it as a header. Only the screens without
 * an account and the public receipt use it.
 */
export function StagePanel({
  children,
  className,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  "data-testid"?: string;
}) {
  return (
    <section
      aria-label="Quitto"
      className={cn(
        "stage-dots relative isolate overflow-hidden bg-brand-surface text-on-brand",
        className
      )}
      {...rest}
    >
      <span className="absolute top-5 left-5 z-[2] lg:hidden print:hidden">
        <Logo size={22} variant="inverted" />
      </span>
      <span className="absolute top-[34px] left-9 z-[2] hidden lg:block print:hidden">
        <Logo size={28} variant="inverted" />
      </span>
      {children}
    </section>
  );
}

/** The delay of a piece's rise, in sequence with the others (mockup 19, decision 9). */
export function rise(delay: number): CSSProperties {
  return { "--rise-delay": `${delay}s` } as CSSProperties;
}

/** A message with several parts in bold ("Rafael pagou João"): the parts as they appear in it, in order. */
export function BoldParts({
  className,
  parts,
  text,
}: {
  className?: string;
  parts: string[];
  text: string;
}) {
  const nodes: ReactNode[] = [];
  let rest = text;
  for (const part of parts) {
    const at = rest.indexOf(part);
    if (at < 0) {
      continue;
    }
    nodes.push(rest.slice(0, at), <b key={part}>{part}</b>);
    rest = rest.slice(at + part.length);
  }
  nodes.push(rest);
  return <span className={className}>{nodes}</span>;
}

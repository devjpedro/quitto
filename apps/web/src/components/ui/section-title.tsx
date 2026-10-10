import type { ReactNode } from "react";

/**
 * A section's title (DIRECAO › Tipografia, the first of three levels):
 * Bricolage 19/600 in ink, above the rows' 14/500 and the 12–13 px meta.
 * Never in ink-muted. `aux` sits on the right (a count, a link, a ring).
 */
export function SectionTitle({
  aux,
  children,
  id,
}: {
  aux?: ReactNode;
  children: ReactNode;
  id: string;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
      <h2
        className="flex items-center gap-2 font-display font-semibold text-[19px] text-ink leading-tight tracking-[-0.02em]"
        id={id}
      >
        {children}
      </h2>
      {aux ? (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-ink-muted tabular-nums">
          {aux}
        </span>
      ) : null}
    </div>
  );
}

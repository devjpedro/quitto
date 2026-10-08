import type { RefObject } from "react";

/** The step's question (Bricolage 26, 24 on a phone) and the line under it; focused when the step changes. */
export function StepHeading({
  headingRef,
  lead,
  title,
}: {
  headingRef: RefObject<HTMLHeadingElement | null>;
  lead?: string;
  title: string;
}) {
  return (
    <>
      <h1
        className="font-display font-semibold text-2xl leading-[1.2] tracking-[-0.03em] focus:outline-none md:text-[26px]"
        ref={headingRef}
        tabIndex={-1}
      >
        {title}
      </h1>
      {lead ? (
        <p className="mt-1.5 text-ink-muted text-sm leading-[1.45] md:mt-2">
          {lead}
        </p>
      ) : null}
    </>
  );
}

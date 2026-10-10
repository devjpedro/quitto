import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A section of Ajustes: its title (Bricolage; 19 on a desktop, a screen's
 * title on a phone, where the list is the page before it) and what it holds.
 * The `id` is the section's name.
 */
export function SettingsSectionShell({
  children,
  id,
  title,
}: {
  children: ReactNode;
  id: string;
  title: string;
}) {
  return (
    <section aria-labelledby={`${id}-title`} id={id}>
      <h2
        className="mb-3 font-display font-semibold text-[28px] text-ink leading-tight tracking-[-0.03em] md:text-[19px] md:tracking-[-0.02em]"
        id={`${id}-title`}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

/** The filled block of a section: rows split by straight dividers, never a box per row. */
export function SettingsBlock({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "divide-y divide-divider overflow-hidden rounded-card bg-surface-card",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * A row of a block: the anchor and the text, and the controls at the end
 * (on a phone, under the text, as wide as the row).
 */
export function SettingsRow({
  anchor,
  controls,
  text,
  textId,
  title,
  titleId,
}: {
  anchor: ReactNode;
  controls?: ReactNode;
  text?: ReactNode;
  textId?: string;
  title: ReactNode;
  titleId?: string;
}) {
  return (
    <div className="flex min-h-[60px] flex-col gap-3 px-4 py-3 md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        {anchor}
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm leading-[1.3]" id={titleId}>
            {title}
          </p>
          {text ? (
            <p
              className="mt-0.5 text-[13px] text-ink-muted leading-[1.4]"
              id={textId}
            >
              {text}
            </p>
          ) : null}
        </div>
      </div>
      {controls ? (
        <div className="flex shrink-0 items-center gap-2 max-md:[&>*]:flex-1">
          {controls}
        </div>
      ) : null}
    </div>
  );
}

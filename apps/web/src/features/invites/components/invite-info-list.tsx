import type { Icon } from "@phosphor-icons/react";
import { IconTile } from "@/components/ui/icon-tile";

export interface InfoRow {
  hint: string;
  icon: Icon;
  line: string;
}

/** "Ao aceitar" and "Como o Quitto funciona" (mockup 15, G and H1): a tinted tile, a line, a hint. */
export function InviteInfoList({
  rows,
  title,
}: {
  rows: InfoRow[];
  title: string;
}) {
  return (
    <>
      <h2 className="mt-6 font-semibold text-sm">{title}</h2>
      <ul className="mt-2.5 divide-y divide-divider overflow-hidden rounded-card bg-surface-card">
        {rows.map((row) => (
          <li
            className="flex min-h-[60px] items-center gap-3.5 py-2.5 pr-4 pl-2.5"
            key={row.line}
          >
            <IconTile icon={row.icon} tone="brand" />
            <span className="min-w-0">
              <b className="block font-medium text-sm leading-[1.3]">
                {row.line}
              </b>
              <small className="mt-0.5 block text-[12.5px] text-ink-muted">
                {row.hint}
              </small>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

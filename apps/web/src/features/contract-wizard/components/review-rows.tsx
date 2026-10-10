import type { Icon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

/** A review row: the anchor, a small label, the line, the detail and "Editar" (below 1140). */
export function ReviewRow({
  anchor,
  detail,
  label,
  line,
  onEdit,
}: {
  anchor: ReactNode;
  detail?: string;
  label?: string;
  line: string;
  onEdit?: () => void;
}) {
  return (
    // A row with one line only (the invite, who confirms) centres the tile on
    // it; one with a label and a detail keeps the tile at the top.
    <li
      className={cn(
        "flex gap-3 py-3.5 pr-3.5 pl-3",
        label || detail ? "items-start" : "items-center"
      )}
    >
      {anchor}
      <span className="min-w-0 flex-1">
        {label ? (
          <span className="mb-0.5 block text-ink-muted text-xs">{label}</span>
        ) : null}
        <b
          className="block font-medium text-sm leading-[1.35] [overflow-wrap:anywhere]"
          title={line}
        >
          {line}
        </b>
        {detail ? (
          <small className="mt-0.5 block text-[12.5px] text-ink-muted tabular-nums leading-[1.4]">
            {detail}
          </small>
        ) : null}
      </span>
      {onEdit && label ? (
        <Button
          aria-label={m.wizard_review_edit_label({ section: label })}
          className="mt-1"
          onClick={onEdit}
          size="sm"
          variant="inset"
        >
          {m.wizard_review_edit()}
        </Button>
      ) : null}
    </li>
  );
}

export function TileAnchor({ icon }: { icon: Icon }) {
  return <IconTile icon={icon} tone="brand" />;
}

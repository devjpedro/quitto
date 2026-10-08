import type { Icon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
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
    <li className="flex items-start gap-3 py-3.5 pr-3.5 pl-3">
      {anchor}
      <span className="min-w-0 flex-1">
        {label ? (
          <span className="mb-0.5 block text-ink-muted text-xs">{label}</span>
        ) : null}
        <b className="block font-medium text-sm leading-[1.35]">{line}</b>
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

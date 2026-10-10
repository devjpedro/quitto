import type { Icon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const SHAPE = {
  pill: "inline-flex h-[22px] self-start rounded-full px-2.5 text-[11.5px]",
  title: "mt-3 h-[30px] w-[72%] px-3",
  money: "mt-2.5 h-[42px] w-[58%] px-3",
  dot: "size-6 shrink-0 rounded-full p-0",
  line: "h-6 max-w-[210px] flex-1 rounded-full px-3 text-xs",
  rows: "mt-4 h-[150px] flex-col justify-center gap-1.5 rounded-card text-center",
} as const;

/**
 * The dashed outline of what is not filled in yet, labeled with the step
 * that fills it (mockup 15, D1): never lorem, never an empty box.
 */
export function PlaceholderBlock({
  children,
  hint,
  icon: BlockIcon,
  shape,
}: {
  children?: ReactNode;
  hint?: string;
  icon?: Icon;
  shape: keyof typeof SHAPE;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 rounded-control border-[1.5px] border-line-strong border-dashed text-[12.5px] text-ink-muted",
        SHAPE[shape]
      )}
    >
      {BlockIcon ? (
        <BlockIcon aria-hidden="true" size={shape === "rows" ? 22 : 16} />
      ) : null}
      {children}
      {/* ink-muted from the block, at full strength: 6.13:1 (light) and 4.76:1 (dark), AA at 12 px. */}
      {hint ? <small className="text-xs">{hint}</small> : null}
    </span>
  );
}

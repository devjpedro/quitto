import {
  FileArrowUp,
  FilePlus,
  HandCoins,
  type Icon,
  LinkBreak,
  SealCheck,
  ShareNetwork,
  SignOut,
  UserPlus,
  XCircle,
} from "@phosphor-icons/react";
import { IconTile } from "@/components/ui/icon-tile";
import { cn } from "@/lib/utils";
import type { EventIcon, EventLine } from "../lib/contract-events";

const ICON: Record<EventIcon, Icon> = {
  upload: FileArrowUp,
  seal: SealCheck,
  x: XCircle,
  hand: HandCoins,
  share: ShareNetwork,
  join: UserPlus,
  leave: SignOut,
  created: FilePlus,
  link: LinkBreak,
};

/**
 * One line of the history (and of the recent activity): the tile tinted by the
 * kind, who did what with the file or reason under it, and on the right the
 * time of the day (or, in the side column, when it was).
 */
export function EventRow({
  line,
  showWhen = false,
}: {
  line: EventLine;
  showWhen?: boolean;
}) {
  return (
    <li className="group/row flex min-h-[58px] items-center gap-3.5 py-2 pr-4 pl-3">
      <IconTile count={line.count} icon={ICON[line.icon]} tone={line.tone} />
      <div className="min-w-0 flex-1 text-sm leading-[1.4]">
        <p>
          {line.actor ? (
            <>
              <strong className="font-semibold">{line.actor}</strong>{" "}
            </>
          ) : null}
          {line.text}
        </p>
        {line.meta ? (
          <p
            className={cn(
              "text-[12.5px] text-ink-muted",
              // A file name is cut at the end; what a person wrote (the reason) wraps.
              line.icon === "upload" ? "truncate" : "line-clamp-2"
            )}
          >
            {line.meta}
          </p>
        ) : null}
      </div>
      <span className="shrink-0 text-[12.5px] text-ink-muted tabular-nums">
        {showWhen ? line.when : line.time}
      </span>
    </li>
  );
}

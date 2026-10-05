import type { ReactNode } from "react";
import type { HomeAction } from "../types";
import { ActionList } from "./action-list";
import { FEW_ROW, FEW_SPANS } from "./home-grid";

/**
 * The action cards, always at the same place in the tree: going from 3 cards
 * to 2 (an optimistic "Já paguei") only changes classes, so the list keeps the
 * keyboard's focus hand-off, the double-tap lock and the carousel's index.
 * With few cards, from lateral the wrapper is the row's grid and "Próximos 30
 * dias" takes the free tracks (mockup 13, frame E); otherwise the wrapper is
 * `contents` and the list sits in the page's column.
 */
export function ActionsRow({
  actions,
  expanded,
  few,
  listId,
  onToggle,
  today,
  upcoming,
}: {
  actions: HomeAction[];
  expanded: boolean;
  few: 1 | 2 | null;
  listId: string;
  onToggle: () => void;
  today: string;
  /** "Próximos 30 dias": shown here only with few cards (HomeLower shows it otherwise). */
  upcoming: ReactNode;
}) {
  return (
    <div className={few ? FEW_ROW : "contents"}>
      <ActionList
        actions={actions}
        expanded={expanded}
        few={few}
        listId={listId}
        onToggle={onToggle}
        today={today}
      />
      {few ? <div className={FEW_SPANS[few].upcoming}>{upcoming}</div> : null}
    </div>
  );
}

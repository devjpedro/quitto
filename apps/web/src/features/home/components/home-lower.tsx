import type { ReactNode } from "react";
import { RecentNotifications } from "@/features/notifications/components/recent-notifications";
import { useRecentNotifications } from "@/features/notifications/hooks/use-recent-notifications";
import { cn } from "@/lib/utils";
import { onlyMomentStrip, stripHasCells } from "../lib/milestones";
import type { HomeMilestones } from "../types";
import {
  LOWER_COLUMN,
  LOWER_FEW,
  LOWER_STACK,
  LOWER_WITH_SIDE,
} from "./home-grid";
import { Milestones } from "./milestones";

/**
 * The home below the actions. Below lateral it is one column in the order of
 * mockup 11: list, milestones, guide. From lateral it grows by columns: list
 * and guide on the left; milestones and "Notificações recentes" on the right;
 * from wide each takes a column of its own. With few cards the list went up
 * (ActionsRow): notifications and the guide left, milestones right (mockup
 * 13, frame E). The side column exists only with something in it, decided by
 * the data (`data-lower`): a block that fails leaves no 2fr track behind.
 */
export function HomeLower({
  few,
  guide,
  hasContract,
  milestones,
  momentId,
  today,
  upcoming,
}: {
  few: boolean;
  /** The compact guide, or null. */
  guide: ReactNode;
  hasContract: boolean;
  milestones: HomeMilestones;
  momentId: string | null;
  /** The home's: it tells a late installment from one still ahead (Milestones). */
  today: string;
  /** "Próximos 30 dias"; with few cards it is in the actions' row instead. */
  upcoming: ReactNode;
}) {
  const recent = useRecentNotifications();
  const notificationsGone = recent.isError && !recent.items;
  const strip = hasContract ? (
    // The milestone of the moment opens the strip on a phone; from md the sidebar shows it.
    <Milestones milestones={milestones} momentId={momentId} today={today} />
  ) : null;
  // A strip with only that milestone is phone-only (md:hidden): it stays out of the side column.
  const phoneOnly = onlyMomentStrip(milestones, momentId);
  const sideMilestones = hasContract && stripHasCells(milestones, momentId);
  if (few) {
    const columns = sideMilestones && (!notificationsGone || guide !== null);
    return (
      <div
        className={cn(LOWER_STACK, columns && LOWER_FEW)}
        data-lower={columns ? "columns" : "stack"}
      >
        <div className={LOWER_COLUMN}>
          {/* From lateral only: hidden below by CSS, and fetched only on a wide screen. */}
          <RecentNotifications />
          {guide}
        </div>
        <div className={LOWER_COLUMN}>{strip}</div>
      </div>
    );
  }
  const columns = sideMilestones || !notificationsGone;
  return (
    <div
      className={cn(LOWER_STACK, columns && LOWER_WITH_SIDE)}
      data-lower={columns ? "columns" : "stack"}
    >
      <div className={LOWER_COLUMN}>
        {upcoming}
        {phoneOnly ? strip : null}
        {guide}
      </div>
      <div className={cn(LOWER_COLUMN, "wide:contents")}>
        {phoneOnly ? null : strip}
        {/* From lateral only: hidden below by CSS, and fetched only on a wide screen. */}
        <RecentNotifications />
      </div>
    </div>
  );
}

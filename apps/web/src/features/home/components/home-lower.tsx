import type { ReactNode } from "react";
import { RecentNotifications } from "@/features/notifications/components/recent-notifications";
import { useRecentNotifications } from "@/features/notifications/hooks/use-recent-notifications";
import { cn } from "@/lib/utils";
import { fewLowerColumns } from "../lib/home-layout";
import { onlyMomentStrip, stripHasCells } from "../lib/milestones";
import type { HomeAction, HomeMilestones } from "../types";
import {
  LOWER_COLUMN,
  LOWER_STACK,
  LOWER_WITH_SIDE,
  lowerColumn,
  lowerFew,
} from "./home-grid";
import { Milestones } from "./milestones";

/**
 * The home below the actions. Below lateral it is one column in the order of
 * mockup 11: list, milestones, guide. From lateral it grows by columns, 3fr
 * and 2fr at every width: list and guide on the left; milestones and
 * "Notificações recentes" on the right. With few cards the list and the
 * milestones went up (ActionsRow): notifications on the left and the guide
 * on the right (mockup 16, frame D); a block alone keeps its 3fr track. A
 * column shows only with something in it, decided by the data
 * (`data-lower`): a block that fails or has nothing to say leaves no track
 * behind.
 */
export function HomeLower({
  actions,
  few,
  guide,
  hasContract,
  milestones,
  momentId,
  today,
  upcoming,
}: {
  /** The cards on screen: "Notificações recentes" leaves out what they already say. */
  actions: HomeAction[];
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
  const recent = useRecentNotifications(actions);
  // The block counts only with a row on screen: not while loading, not failed, not empty.
  const notificationsShown = (recent.items?.length ?? 0) > 0;
  if (few) {
    const { guideRight, left, right } = fewLowerColumns({
      guide: guide !== null,
      notifications: notificationsShown,
    });
    return (
      <div
        className={lowerFew(left || right)}
        data-lower={left && right ? "columns" : "stack"}
      >
        <div className={lowerColumn(left)}>
          {/* From lateral only: hidden below by CSS, and fetched only on a wide screen. */}
          <RecentNotifications actions={actions} />
          {guideRight ? null : guide}
        </div>
        <div className={lowerColumn(right)}>{guideRight ? guide : null}</div>
      </div>
    );
  }
  const strip = hasContract ? (
    // The milestone of the moment opens the strip on a phone; from md the sidebar shows it.
    <Milestones milestones={milestones} momentId={momentId} today={today} />
  ) : null;
  // A strip with only that milestone is phone-only (md:hidden): it stays out of the side column.
  const phoneOnly = onlyMomentStrip(milestones, momentId);
  const sideMilestones = hasContract && stripHasCells(milestones, momentId);
  const columns = sideMilestones || notificationsShown;
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
      <div className={lowerColumn(columns)}>
        {phoneOnly ? null : strip}
        {/* From lateral only: hidden below by CSS, and fetched only on a wide screen. */}
        <RecentNotifications actions={actions} />
      </div>
    </div>
  );
}

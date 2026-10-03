import { useQuery } from "@tanstack/react-query";
import { useHydrated } from "@tanstack/react-router";
import { LATERAL_UP, useMediaQuery } from "@/hooks/use-media-query";
import { notificationsQueryOptions } from "../api";
import type { NotificationItem } from "../types";

export const RECENT_COUNT = 4;

/** The list comes newest first. Module level, so the select is stable. */
const latest = (items: NotificationItem[]) => items.slice(0, RECENT_COUNT);

/**
 * The 4 latest notifications for the home's side column. The same query as
 * the bell panel, so reading one in either place updates both. It only runs
 * after hydration and on a wide screen: the SSR HTML stays the same at any
 * width, and a phone never asks for what it does not show. Never throws.
 */
export function useRecentNotifications(): {
  isError: boolean;
  items: NotificationItem[] | undefined;
} {
  const hydrated = useHydrated();
  // serverValue false: no fetch during SSR and the hydration pass.
  const wide = useMediaQuery(LATERAL_UP, false);
  const { data, isError } = useQuery({
    ...notificationsQueryOptions,
    enabled: hydrated && wide,
    select: latest,
    throwOnError: false,
  });
  return { items: data, isError };
}

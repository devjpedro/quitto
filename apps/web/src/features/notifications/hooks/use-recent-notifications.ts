import { useQuery } from "@tanstack/react-query";
import { useHydrated } from "@tanstack/react-router";
import { useCallback } from "react";
import { withoutCards } from "@/features/home/lib/recent-filter";
import type { HomeAction } from "@/features/home/types";
import { LATERAL_UP, useMediaQuery } from "@/hooks/use-media-query";
import { notificationsQueryOptions } from "../api";
import type { NotificationItem } from "../types";

export const RECENT_COUNT = 4;

/**
 * The 4 latest notifications for the home's side column, leaving out what an
 * action card already says (withoutCards), and cutting after that. The same query as
 * the bell panel, so reading one in either place updates both. It only runs
 * after hydration and on a wide screen: the SSR HTML stays the same at any
 * width, and a phone never asks for what it does not show. Never throws.
 */
export function useRecentNotifications(actions: HomeAction[]): {
  isError: boolean;
  items: NotificationItem[] | undefined;
} {
  const hydrated = useHydrated();
  // The list comes newest first. Stable while the cards stay the same.
  const select = useCallback(
    (items: NotificationItem[]) =>
      withoutCards(items, actions).slice(0, RECENT_COUNT),
    [actions]
  );
  // serverValue false: no fetch during SSR and the hydration pass.
  const wide = useMediaQuery(LATERAL_UP, false);
  const { data, isError } = useQuery({
    ...notificationsQueryOptions,
    enabled: hydrated && wide,
    select,
    throwOnError: false,
  });
  return { items: data, isError };
}

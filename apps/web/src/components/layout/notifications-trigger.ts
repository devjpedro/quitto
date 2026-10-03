import { MD_UP } from "@/hooks/use-media-query";

type TriggerPlace = "sidebar" | "top-bar";

/** Marks a bell button: the top bar's (below md) or the sidebar row's (from md). */
export function notificationsTrigger(place: TriggerPlace) {
  return { "data-notifications-trigger": place };
}

/**
 * The bell on screen now. The focus goes back there when the panel closes and
 * what opened it left the page (the ⌘K palette closes as it opens the panel).
 * Picked by the same md cut as the CSS that shows one bell or the other.
 */
export function visibleNotificationsTrigger(): HTMLElement | null {
  const place: TriggerPlace = window.matchMedia(MD_UP).matches
    ? "sidebar"
    : "top-bar";
  return document.querySelector<HTMLElement>(
    `[data-notifications-trigger="${place}"]`
  );
}

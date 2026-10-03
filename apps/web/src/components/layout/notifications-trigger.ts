type TriggerPlace = "sidebar" | "top-bar";

/** Marks a bell button: the top bar's (below md) or the sidebar row's (from md). */
export function notificationsTrigger(place: TriggerPlace) {
  return { "data-notifications-trigger": place };
}

/**
 * The bell on screen now. The focus goes back there when the panel closes and
 * what opened it left the page (the ⌘K palette closes as it opens the panel).
 * Picked by what the CSS renders, not by a media query of its own: md is in
 * rem, so a px cut would part from it with a browser font other than 16 px.
 */
export function visibleNotificationsTrigger(): HTMLElement | null {
  const triggers = document.querySelectorAll<HTMLElement>(
    "[data-notifications-trigger]"
  );
  return Array.from(triggers).find(isRendered) ?? null;
}

/** Safari before 17.4 has no checkVisibility: no client rects is the same "no box". */
function isRendered(el: HTMLElement): boolean {
  return el.checkVisibility?.() ?? el.getClientRects().length > 0;
}

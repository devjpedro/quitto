export const INSTALL_DISMISS_KEY = "quitto:install-dismissed-at";
export const INSTALL_DISMISS_DAYS = 30;
const DAY_MS = 86_400_000;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** Whether the ✕ was tapped less than 30 days ago. Storage may throw or be empty. */
export function isDismissed(
  storage: StorageLike | null,
  now: number = Date.now()
): boolean {
  try {
    const raw = storage?.getItem(INSTALL_DISMISS_KEY);
    const at = raw ? Number(raw) : Number.NaN;
    return Number.isFinite(at) && now - at < INSTALL_DISMISS_DAYS * DAY_MS;
  } catch {
    return false;
  }
}

export function recordDismissal(
  storage: StorageLike | null,
  now: number = Date.now()
): void {
  try {
    storage?.setItem(INSTALL_DISMISS_KEY, String(now));
  } catch {
    // Private mode or blocked storage: the card just comes back next visit.
  }
}

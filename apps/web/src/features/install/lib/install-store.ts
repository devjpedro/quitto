import { useSyncExternalStore } from "react";
import { isDismissed, recordDismissal } from "./dismissal";
import {
  detectPlatform,
  type InstallPlatform,
  isInAppBrowser,
  platformCanInstall,
} from "./platform";

/**
 * Chrome fires `beforeinstallprompt` once, possibly before React mounts: this
 * module is imported by the root route, so the listeners exist as soon as the
 * bundle runs, and the hook reads what was captured.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface Snapshot {
  canInstall: boolean;
  dismissed: boolean;
  installed: boolean;
  platform: InstallPlatform;
  sheetOpen: boolean;
  standalone: boolean;
}

const SERVER_SNAPSHOT: Snapshot = {
  canInstall: false,
  dismissed: true,
  installed: false,
  platform: { kind: "other" },
  sheetOpen: false,
  standalone: false,
};

const listeners = new Set<() => void>();
let deferred: BeforeInstallPromptEvent | null = null;
let installedEvent = false;
let sheetOpen = false;
let cached: Snapshot | null = null;

function notify() {
  cached = null;
  for (const l of listeners) {
    l();
  }
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    nav.standalone === true
  );
}

function compute(): Snapshot {
  const platform = detectPlatform({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
  });
  const standalone = isStandalone();
  const supported = platformCanInstall(
    platform,
    isInAppBrowser(navigator.userAgent)
  );
  // Android needs the browser's event; iOS has no event, only the steps.
  const hasWay = platform.kind === "android" ? deferred !== null : true;
  return {
    platform,
    standalone,
    installed: installedEvent,
    dismissed: isDismissed(storage()),
    canInstall: supported && hasWay && !standalone && !installedEvent,
    sheetOpen,
  };
}

function getSnapshot(): Snapshot {
  cached ??= compute();
  return cached;
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installedEvent = true;
    notify();
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useInstallState(): Snapshot {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);
}

export function setInstallSheetOpen(open: boolean) {
  sheetOpen = open;
  notify();
}

/** The ✕ of the card: hides it for 30 days. */
export function dismissInstallCard() {
  recordDismissal(storage());
  notify();
}

/** Android: the browser's dialog. iPhone: the steps sheet. */
export async function startInstall(platform: InstallPlatform) {
  if (platform.kind === "ios") {
    setInstallSheetOpen(true);
    return;
  }
  const event = deferred;
  if (!event) {
    return;
  }
  // The event is single-use: after prompt() it can't be reused.
  deferred = null;
  notify();
  await event.prompt();
}

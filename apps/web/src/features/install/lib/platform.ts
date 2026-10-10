export interface PlatformInput {
  maxTouchPoints?: number;
  platform?: string;
  userAgent: string;
}

export type InstallPlatform =
  | { kind: "android" }
  | { kind: "ios"; device: "iphone" | "ipad" }
  | { kind: "other" };

/** In-app browsers (WhatsApp, Instagram, Facebook...) never install a PWA. */
const IN_APP_RE =
  /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|Twitter|MicroMessenger|Snapchat|TikTok|; wv\)/i;

const IOS_RE = /iPhone|iPad|iPod/;
const SAFARI_RE = /Safari/;
const IPHONE_RE = /iPhone|iPod/;
const IPAD_RE = /iPad/;
const ANDROID_RE = /Android/;

export function isInAppBrowser(
  userAgent: string,
  platform?: InstallPlatform
): boolean {
  if (IN_APP_RE.test(userAgent)) {
    return true;
  }
  // iPadOS in desktop mode says "Macintosh": the detected platform says it is iOS.
  if (platform?.kind === "ios" && !SAFARI_RE.test(userAgent)) {
    return true;
  }
  // A WKWebView on iOS has no "Safari" token; Safari, CriOS and FxiOS all do.
  const onIos = IOS_RE.test(userAgent);
  return onIos && !SAFARI_RE.test(userAgent);
}

/**
 * iPadOS 13+ reports itself as a Mac: a "MacIntel" with touch points is an iPad.
 */
export function detectPlatform(input: PlatformInput): InstallPlatform {
  const { userAgent } = input;
  if (IPHONE_RE.test(userAgent)) {
    return { kind: "ios", device: "iphone" };
  }
  if (
    IPAD_RE.test(userAgent) ||
    (input.platform === "MacIntel" && (input.maxTouchPoints ?? 0) > 1)
  ) {
    return { kind: "ios", device: "ipad" };
  }
  if (ANDROID_RE.test(userAgent)) {
    return { kind: "android" };
  }
  return { kind: "other" };
}

/**
 * Whether this browser can install the app at all (the Android one still needs
 * the `beforeinstallprompt` event; the iOS one is the "Add to Home Screen" steps).
 */
export function platformCanInstall(
  platform: InstallPlatform,
  inApp: boolean
): boolean {
  return !inApp && platform.kind !== "other";
}

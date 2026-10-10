import { describe, expect, it } from "vitest";
import {
  INSTALL_DISMISS_KEY,
  isDismissed,
  recordDismissal,
} from "@/features/install/lib/dismissal";
import {
  detectPlatform,
  isInAppBrowser,
  platformCanInstall,
} from "@/features/install/lib/platform";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1";
const IPHONE_WHATSAPP =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const IPHONE_INSTAGRAM = `${IPHONE_SAFARI} Instagram 350.0`;
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
const ANDROID_WEBVIEW =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0 Mobile Safari/537.36";
const ANDROID_FACEBOOK = `${ANDROID_CHROME} [FB_IAB/FB4A;FBAV/450.0]`;
const DESKTOP =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

describe("detectPlatform", () => {
  it("iPhone", () => {
    expect(detectPlatform({ userAgent: IPHONE_SAFARI })).toEqual({
      kind: "ios",
      device: "iphone",
    });
  });
  it("iPad antigo (UA de iPad)", () => {
    expect(
      detectPlatform({
        userAgent: "Mozilla/5.0 (iPad; CPU OS 12_0 like Mac OS X)",
      })
    ).toEqual({ kind: "ios", device: "ipad" });
  });
  it("iPadOS 13+ se diz Mac: MacIntel com toque é iPad", () => {
    expect(
      detectPlatform({
        userAgent: DESKTOP,
        platform: "MacIntel",
        maxTouchPoints: 5,
      })
    ).toEqual({ kind: "ios", device: "ipad" });
  });
  it("Mac de verdade (sem toque) é outro", () => {
    expect(
      detectPlatform({
        userAgent: DESKTOP,
        platform: "MacIntel",
        maxTouchPoints: 0,
      })
    ).toEqual({ kind: "other" });
  });
  it("Android", () => {
    expect(detectPlatform({ userAgent: ANDROID_CHROME })).toEqual({
      kind: "android",
    });
  });
});

describe("isInAppBrowser", () => {
  it("Safari e Chrome do iPhone instalam", () => {
    expect(isInAppBrowser(IPHONE_SAFARI)).toBe(false);
    expect(isInAppBrowser(IPHONE_CHROME)).toBe(false);
  });
  it("WKWebView (sem token Safari) é navegador interno", () => {
    expect(isInAppBrowser(IPHONE_WHATSAPP)).toBe(true);
  });
  it("Instagram, Facebook e WebView do Android", () => {
    expect(isInAppBrowser(IPHONE_INSTAGRAM)).toBe(true);
    expect(isInAppBrowser(ANDROID_FACEBOOK)).toBe(true);
    expect(isInAppBrowser(ANDROID_WEBVIEW)).toBe(true);
  });
  it("Chrome do Android instala", () => {
    expect(isInAppBrowser(ANDROID_CHROME)).toBe(false);
  });
});

describe("platformCanInstall", () => {
  it("só iOS e Android fora de navegador interno", () => {
    expect(platformCanInstall({ kind: "android" }, false)).toBe(true);
    expect(platformCanInstall({ kind: "ios", device: "iphone" }, false)).toBe(
      true
    );
    expect(platformCanInstall({ kind: "ios", device: "iphone" }, true)).toBe(
      false
    );
    expect(platformCanInstall({ kind: "other" }, false)).toBe(false);
  });
});

describe("dispensa do card (30 dias)", () => {
  const memory = () => {
    const data = new Map<string, string>();
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => {
        data.set(k, v);
      },
    };
  };
  const DAY = 86_400_000;

  it("sem registro não está dispensado", () => {
    expect(isDismissed(memory(), 1000)).toBe(false);
  });
  it("some por 30 dias e volta depois", () => {
    const s = memory();
    recordDismissal(s, 0);
    expect(isDismissed(s, 29 * DAY)).toBe(true);
    expect(isDismissed(s, 30 * DAY)).toBe(false);
  });
  it("valor inválido não dispensa", () => {
    const s = memory();
    s.setItem(INSTALL_DISMISS_KEY, "lixo");
    expect(isDismissed(s, 1000)).toBe(false);
  });
  it("storage que lança não quebra", () => {
    const boom = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(isDismissed(boom)).toBe(false);
    expect(() => recordDismissal(boom)).not.toThrow();
    expect(isDismissed(null)).toBe(false);
  });
});

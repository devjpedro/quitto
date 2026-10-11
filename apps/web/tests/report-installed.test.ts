import { describe, expect, test } from "vitest";
import { shouldReportInstalled } from "@/features/install/hooks/use-report-installed";
import type { InstallPlatform } from "@/features/install/lib/platform";

const base = { alreadyMarked: false, installed: false, standalone: false };
const run = (platform: InstallPlatform, over = {}) =>
  shouldReportInstalled({ ...base, platform, ...over });

describe("shouldReportInstalled", () => {
  test("a phone in standalone or after appinstalled marks the account", () => {
    expect(run({ kind: "android" }, { standalone: true })).toBe(true);
    expect(run({ kind: "android" }, { installed: true })).toBe(true);
    expect(run({ kind: "ios", device: "iphone" }, { standalone: true })).toBe(
      true
    );
  });

  test("a desktop never marks it, standalone or appinstalled", () => {
    expect(run({ kind: "other" }, { standalone: true })).toBe(false);
    expect(run({ kind: "other" }, { installed: true })).toBe(false);
  });

  test("nothing to report in the browser, or when already marked", () => {
    expect(run({ kind: "android" })).toBe(false);
    expect(
      run({ kind: "android" }, { standalone: true, alreadyMarked: true })
    ).toBe(false);
  });
});

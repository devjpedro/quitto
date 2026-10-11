import { useEffect } from "react";
import { useMeQuery } from "@/hooks/use-me";
import { useReportAppInstalled } from "../api";
import { useInstallState } from "../lib/install-store";
import type { InstallPlatform } from "../lib/platform";

/**
 * Only a phone marks the account: the mark exists to hide the home card on the
 * phone, and a desktop install (or a browser simulating a phone's screen, with
 * the real platform still "other") says nothing about the phone.
 */
export function shouldReportInstalled(input: {
  alreadyMarked: boolean;
  installed: boolean;
  platform: InstallPlatform;
  standalone: boolean;
}): boolean {
  const onPhone =
    input.platform.kind === "android" || input.platform.kind === "ios";
  return (
    onPhone && (input.standalone || input.installed) && !input.alreadyMarked
  );
}

/**
 * The app opened in standalone (or the browser said "appinstalled") on a phone,
 * signed in, and the account does not know yet: tell it once, so the home card
 * goes away in every browser of the account (iOS can't tell Safari the app is
 * installed, and its home screen app has its own storage). The account menu
 * item ignores the mark: it only follows the browser.
 */
export function useReportInstalled() {
  const { standalone, installed, platform } = useInstallState();
  const { data: me } = useMeQuery();
  const needed =
    me !== undefined &&
    shouldReportInstalled({
      alreadyMarked: Boolean(me.appInstalledAt),
      installed,
      platform,
      standalone,
    });
  const { mutate, isPending, isError } = useReportAppInstalled();
  useEffect(() => {
    if (needed && !isPending && !isError) {
      mutate();
    }
  }, [needed, isPending, isError, mutate]);
}

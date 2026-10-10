import { useEffect } from "react";
import { useMeQuery } from "@/hooks/use-me";
import { useReportAppInstalled } from "../api";
import { useInstallState } from "../lib/install-store";

/**
 * The app opened in standalone (or the browser said "appinstalled"), signed
 * in, and the account does not know yet: tell it once, so the card and the menu
 * item go away in every browser of the account (iOS can't tell Safari the app
 * is installed, and its home screen app has its own storage).
 */
export function useReportInstalled() {
  const { standalone, installed } = useInstallState();
  const { data: me } = useMeQuery();
  const { mutate, isPending, isError } = useReportAppInstalled();
  const needed = (standalone || installed) && me && !me.appInstalledAt;
  useEffect(() => {
    if (needed && !isPending && !isError) {
      mutate();
    }
  }, [needed, isPending, isError, mutate]);
}

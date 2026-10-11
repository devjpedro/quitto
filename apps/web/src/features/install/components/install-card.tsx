import { X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useMeQuery } from "@/hooks/use-me";
import { m } from "@/paraglide/messages.js";
import {
  dismissInstallCard,
  startInstall,
  useInstallState,
} from "../lib/install-store";

/**
 * Mockup 21, M1-A: the invitation to install, in the flow of the home just
 * under the date. Phone only, signed in, outside the installed app; the account
 * remembers an app installed on a phone (appInstalledAt), so no browser shows
 * the card again. Only the card: the account menu item stays available.
 */
export function InstallCard() {
  const { canInstall, dismissed, platform } = useInstallState();
  const { data: me } = useMeQuery();
  if (!(canInstall && me) || dismissed || me.appInstalledAt) {
    return null;
  }
  const ios = platform.kind === "ios";
  return (
    <section
      aria-label={m.install_card_title()}
      className="flex items-center gap-3 rounded-card bg-surface-card py-2.5 pr-0 pl-3 md:hidden"
      data-testid="install-card"
    >
      <img
        alt=""
        className="size-10 shrink-0"
        height={40}
        src="/icon-192.png"
        width={40}
      />
      <div className="min-w-0 flex-1">
        <p className="whitespace-nowrap font-semibold text-sm leading-[1.3]">
          {m.install_card_title()}
        </p>
        <p className="mt-0.5 text-ink-muted text-xs leading-snug">
          {m.install_card_hint()}
        </p>
      </div>
      <Button onClick={() => startInstall(platform)} size="sm" variant="inset">
        {ios ? m.install_card_how() : m.install_card_action()}
      </Button>
      <button
        aria-label={m.install_card_dismiss()}
        className="-ml-2 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-control text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        onClick={dismissInstallCard}
        type="button"
      >
        <X aria-hidden="true" size={18} />
      </button>
    </section>
  );
}

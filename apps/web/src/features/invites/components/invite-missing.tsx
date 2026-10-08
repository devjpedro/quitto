import { type Icon, LinkBreak } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages.js";
import { StateHeading } from "./state-heading";

/** A sentence on its own (no invite to show): the brand, the state, optionally one way out. */
export function InviteNotice({
  children,
  icon,
  title,
  tone,
  withExit = true,
}: {
  children: string;
  icon: Icon;
  title: string;
  tone: "brand" | "warning" | "neutral";
  withExit?: boolean;
}) {
  return (
    <main className="flex min-h-dvh flex-col bg-surface-sunken px-4 pt-[calc(1rem+env(safe-area-inset-top))] md:items-center md:justify-center md:bg-canvas">
      <div className="w-full max-w-[476px] md:rounded-panel md:bg-surface md:p-9">
        <Logo size={22} />
        <div className="mt-8">
          <StateHeading icon={icon} title={title} tone={tone}>
            {children}
          </StateHeading>
        </div>
        {withExit ? (
          <Button asChild block className="mt-7" size="lg">
            <Link to="/">{m.invite_go_now()}</Link>
          </Button>
        ) : null}
      </div>
    </main>
  );
}

/** A link that does not exist (404): the brand, the sentence, one way out. */
export function InviteMissing() {
  return (
    <InviteNotice
      icon={LinkBreak}
      title={m.invite_missing_title()}
      tone="neutral"
    >
      {m.invite_missing_text()}
    </InviteNotice>
  );
}

import { LinkBreak } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { StateHeading } from "@/features/invites/components/state-heading";
import { m } from "@/paraglide/messages.js";

/** The frame of a page that cannot show its content: the canvas, the wordmark and one white card (no shell, no session needed). */
export function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center bg-surface-sunken px-4 pt-10 pb-10 text-ink md:bg-canvas">
      <div className="w-full max-w-[476px]">
        <Logo size={24} />
        <div className="mt-6 rounded-panel bg-surface p-6 md:p-7">
          {children}
        </div>
      </div>
    </div>
  );
}

export function NotFound() {
  return (
    <CenteredCard>
      <StateHeading icon={LinkBreak} title={m.not_found_title()} tone="neutral">
        {m.not_found_text()}
      </StateHeading>
      <Button asChild className="mt-6" size="lg">
        <Link to="/">{m.not_found_home()}</Link>
      </Button>
    </CenteredCard>
  );
}

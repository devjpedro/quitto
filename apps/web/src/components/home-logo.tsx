import { Link } from "@tanstack/react-router";
import type { MouseEvent } from "react";
import { Logo } from "@/components/logo";
import { useSignedIn } from "@/hooks/use-signed-in";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

/**
 * Every Quitto wordmark in the app goes through here: with a session it is a
 * link home ("Quitto, início"); without one there is no home to go to, so it
 * is only the picture. `className` styles the link or, without a session,
 * the box that stands in for it, so the layout is the same either way.
 * `onNavigate` runs on the click and may `preventDefault` (the wizard asks
 * before leaving with a form filled in).
 */
export function HomeLogo({
  className,
  onNavigate,
  size,
  variant,
}: {
  className?: string;
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
  size?: number;
  variant?: "brand" | "inverted";
}) {
  const signedIn = useSignedIn();
  const logo = <Logo size={size} variant={variant} />;
  if (!signedIn) {
    return className ? <span className={className}>{logo}</span> : logo;
  }
  return (
    <Link
      aria-label={m.logo_home_link()}
      className={cn(
        "rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        // Floresta's ring would vanish on the brand panel: the white logo gets a white one.
        variant === "inverted"
          ? "focus-visible:ring-white focus-visible:ring-offset-brand-surface"
          : "focus-visible:ring-brand focus-visible:ring-offset-surface",
        className
      )}
      onClick={onNavigate}
      to="/"
    >
      {logo}
    </Link>
  );
}

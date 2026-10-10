import { CaretLeft } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { m } from "@/paraglide/messages.js";

/** "‹ Entrar" on top of the screens that leave the form (mockup 18, decision 6): a back link, not a link floating at the end. */
export function BackToSignin() {
  return (
    <Link
      className="mb-[18px] -ml-2.5 inline-flex h-11 items-center gap-1 rounded-control px-2.5 font-medium text-ink text-sm transition-colors hover:bg-surface-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand md:h-9"
      to="/login"
    >
      <CaretLeft aria-hidden="true" size={16} />
      {m.auth_to_signin()}
    </Link>
  );
}

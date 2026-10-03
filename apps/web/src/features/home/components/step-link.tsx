import { Link } from "@tanstack/react-router";
import type { ComponentProps, ReactNode } from "react";
import type { StepTarget } from "../lib/onboarding";

/**
 * A typed link per guide step. Accepts the props a Slot (Button asChild)
 * forwards; the anchor's own `target` is left out, since the prop names the
 * step's destination.
 */
export function StepLink({
  children,
  target,
  ...rest
}: { children: ReactNode; target: StepTarget } & Omit<
  ComponentProps<"a">,
  "children" | "href" | "target"
>) {
  if (target.kind === "contract") {
    return (
      <Link
        {...rest}
        params={{ id: target.contractId }}
        search={{ installment: undefined }}
        to="/contracts/$id"
      >
        {children}
      </Link>
    );
  }
  if (target.kind === "settings") {
    return (
      <Link {...rest} to="/settings">
        {children}
      </Link>
    );
  }
  return (
    <Link {...rest} to="/contracts/new">
      {children}
    </Link>
  );
}

import type { ReactNode } from "react";
import { ACTION_BAR } from "@/components/layout/step-frame";
import { cn } from "@/lib/utils";

/**
 * The invite's actions: the wizard's action bar (6A), sticky at the bottom
 * on a phone (mockup 15, G2/H), after the content from md. No keyboard
 * lift: the invite has no field.
 */
export function InviteBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(ACTION_BAR, className)} data-testid="invite-bar">
      {children}
    </div>
  );
}

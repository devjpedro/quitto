import { Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMyInvitesQuery } from "@/hooks/use-my-invites";
import { ROLE_LABEL } from "@/lib/labels";

/** Self-contained banner: surfaces pending invites for the session email. */
export function PendingInvitesBanner() {
  const { data } = useMyInvitesQuery();
  const invites = data ?? [];

  if (invites.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <p className="flex items-center gap-2 font-semibold text-foreground text-sm">
        <Mail aria-hidden="true" className="size-4 text-primary" />
        Você tem {invites.length} convite
        {invites.length > 1 ? "s" : ""} pendente
        {invites.length > 1 ? "s" : ""}
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {invites.map((inv) => (
          <li
            className="flex items-center gap-3 rounded-lg border border-transparent bg-card p-2.5 shadow-xs transition-colors hover:border-primary/40"
            key={inv.token}
          >
            <span className="min-w-0 flex-1 truncate font-medium text-foreground text-sm">
              {inv.contractTitle}
            </span>
            <Badge tone="brand">{ROLE_LABEL[inv.role] ?? inv.role}</Badge>
            <Button asChild size="sm" variant="outline">
              <Link params={{ token: inv.token }} to="/invites/$token">
                Ver convite
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

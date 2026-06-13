import { Link } from "@tanstack/react-router";
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
      <p className="font-display font-semibold text-foreground text-sm">
        Você tem {invites.length} convite
        {invites.length > 1 ? "s" : ""} pendente
        {invites.length > 1 ? "s" : ""}
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {invites.map((inv) => (
          <li className="flex items-center gap-2 text-sm" key={inv.token}>
            <span className="font-medium text-foreground">
              {inv.contractTitle}
            </span>
            <span className="text-muted-foreground text-xs">
              {ROLE_LABEL[inv.role] ?? inv.role}
            </span>
            <Link
              className="ml-auto text-primary text-sm underline"
              params={{ token: inv.token }}
              to="/invites/$token"
            >
              Ver convite
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

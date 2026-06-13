import { useNavigate, useParams } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAcceptInviteMutation, useInviteQuery } from "@/hooks/use-invite";
import { authClient } from "@/lib/auth-client";
import { errorMessage } from "@/lib/error-message";
import { ROLE_LABEL } from "@/lib/labels";

export function AcceptInvitePage() {
  const { token } = useParams({ from: "/protected/invites/$token" });
  const navigate = useNavigate();
  const { data, isPending, error } = useInviteQuery(token);
  const acceptMutation = useAcceptInviteMutation(token);

  if (isPending) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Skeleton className="mb-3 h-8 w-2/3" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-md p-6">
        <h1 className="font-bold font-display text-foreground text-xl">
          Convite indisponível
        </h1>
        <p className="mt-2 text-muted-foreground text-sm">
          {errorMessage(error)}
        </p>
      </div>
    );
  }

  async function onAccept() {
    const res = await acceptMutation.mutateAsync();
    navigate({ to: "/contracts/$id", params: { id: res.contractId } });
  }

  async function onSwitchAccount() {
    await authClient.signOut();
    window.location.href = `/login?redirect=${encodeURIComponent(
      `/invites/${token}`
    )}`;
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="font-bold font-display text-2xl text-foreground tracking-tight">
        Convite para um contrato
      </h1>
      <div className="mt-4 rounded-xl border border-border bg-card p-4 shadow-xs">
        <p className="text-foreground">
          Você foi convidado para <strong>{data.contractTitle}</strong> como{" "}
          <strong>{ROLE_LABEL[data.role] ?? data.role}</strong>.
        </p>

        {data.emailMatches ? (
          <Button
            className="mt-4 w-full"
            disabled={acceptMutation.isPending}
            onClick={onAccept}
            type="button"
          >
            {acceptMutation.isPending ? "Aceitando…" : "Aceitar convite"}
          </Button>
        ) : (
          <div className="mt-4">
            <p className="text-muted-foreground text-sm">
              Este convite é para outro e-mail ({data.email}). Entre com a conta
              correta para aceitar.
            </p>
            <Button
              className="mt-3 w-full"
              onClick={onSwitchAccount}
              type="button"
              variant="outline"
            >
              Entrar com outra conta
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

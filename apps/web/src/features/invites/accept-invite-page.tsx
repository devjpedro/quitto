import { useNavigate, useParams } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/legacy-ui/button";
import { Skeleton } from "@/components/legacy-ui/skeleton";
import { Money } from "@/components/money";
import { PageContainer } from "@/components/page-container";
import { useApiWarmup } from "@/hooks/use-api-warmup";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { clearIdentityCookie } from "@/hooks/use-identity-cookie";
import {
  useAcceptInviteMutation,
  useDeclineInviteMutation,
  useInviteQuery,
} from "@/hooks/use-invite";
import { authClient } from "@/lib/auth-client";
import { errorMessage } from "@/lib/error-message";
import { ROLE_LABEL } from "@/lib/labels";
import { PAGE_TITLE } from "@/lib/page-title";

// The old page reads the phase-3 view until Task 9B replaces it.
const UNAVAILABLE: Record<"accepted" | "declined" | "expired", string> = {
  accepted: "Convite já utilizado",
  declined: "Convite já recusado",
  expired: "Convite expirado",
};

export function AcceptInvitePage() {
  useDocumentTitle(PAGE_TITLE.acceptInvite);
  useApiWarmup();
  const { token } = useParams({ from: "/_app/invites/$token" });
  const navigate = useNavigate();
  const { data, isPending, error } = useInviteQuery(token);
  const acceptMutation = useAcceptInviteMutation(token);
  const declineMutation = useDeclineInviteMutation(token);

  if (isPending) {
    return (
      <PageContainer width="narrow">
        <Skeleton className="mb-3 h-8 w-2/3" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </PageContainer>
    );
  }

  // A pending invite always has its terms (null only for another account
  // once it ended, which the status already sends here).
  if (error || !data || data.status !== "pending" || !data.terms) {
    return (
      <PageContainer width="narrow">
        <h1 className="font-bold text-foreground text-xl">
          Convite indisponível
        </h1>
        <p className="mt-2 text-muted-foreground text-sm">
          {data && data.status !== "pending"
            ? UNAVAILABLE[data.status]
            : errorMessage(error)}
        </p>
      </PageContainer>
    );
  }

  async function onAccept() {
    const res = await acceptMutation.mutateAsync();
    navigate({
      to: "/contracts/$id",
      params: { id: res.contractId },
      search: { installment: undefined },
    });
  }

  async function onDecline() {
    await declineMutation.mutateAsync();
    navigate({ to: "/contracts" });
  }

  async function onSwitchAccount() {
    await authClient.signOut();
    clearIdentityCookie();
    window.location.href = `/login?redirect=${encodeURIComponent(
      `/invites/${token}`
    )}`;
  }

  let action: ReactNode;
  if (data.viewer === "owner" || data.viewer === "alreadyParticipant") {
    action = (
      <div className="mt-4">
        <p className="text-muted-foreground text-sm">
          Você já participa deste contrato.
        </p>
        <Button
          className="mt-3 w-full"
          onClick={() => navigate({ to: "/contracts" })}
          type="button"
          variant="outline"
        >
          Ir para meus contratos
        </Button>
      </div>
    );
  } else if (data.viewer === "invitee") {
    action = (
      <div className="mt-4 flex flex-col gap-2">
        <Button
          className="w-full"
          disabled={acceptMutation.isPending}
          onClick={onAccept}
          type="button"
        >
          {acceptMutation.isPending ? "Aceitando…" : "Aceitar convite"}
        </Button>
        <Button
          className="w-full"
          disabled={declineMutation.isPending}
          onClick={onDecline}
          type="button"
          variant="outline"
        >
          {declineMutation.isPending ? "Recusando…" : "Recusar"}
        </Button>
      </div>
    );
  } else {
    action = (
      <div className="mt-4">
        <p className="text-muted-foreground text-sm">
          Este convite é para outro e-mail ({data.emailMasked}). Entre com a
          conta correta para aceitar.
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
    );
  }

  return (
    <PageContainer width="narrow">
      <h1 className="font-bold text-2xl text-foreground tracking-tight">
        Convite para um contrato
      </h1>
      <div className="mt-4 rounded-xl border border-border bg-card p-4 shadow-xs">
        <p className="text-foreground">
          <strong>{data.inviterName}</strong> convidou você para{" "}
          <strong>{data.contract.title}</strong> como{" "}
          <strong>{ROLE_LABEL[data.role] ?? data.role}</strong>.
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-muted-foreground">Total</dt>
            <dd>
              <Money cents={data.terms.totalCents} size="sm" />
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Parcelas</dt>
            <dd className="tabular-nums">{data.terms.installmentsCount}</dd>
          </div>
        </dl>
        {action}
      </div>
    </PageContainer>
  );
}

import { isPaidStatus } from "@quitto/shared";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { ContractActionsMenu } from "@/components/contract-actions-menu";
import { ContractStatusBadge } from "@/components/contract-status-badge";
import { ExportMenu } from "@/components/export-menu";
import { InstallmentDrawer } from "@/components/installment-drawer";
import { InstallmentsSection } from "@/components/installments-section";
import { Money } from "@/components/money";
import { PageContainer } from "@/components/page-container";
import { ParticipantsDrawer } from "@/components/participants-drawer";
import { StatLabel } from "@/components/stat-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useContractQuery } from "@/hooks/use-contracts";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { formatBRL } from "@/lib/format";
import { OWNER_BADGE_LABEL, ROLE_LABEL } from "@/lib/labels";
import { PAGE_TITLE } from "@/lib/page-title";

const STAT_TONE_CLASS: Record<"danger" | "default" | "success", string> = {
  success: "text-success-foreground",
  danger: "text-destructive",
  default: "text-foreground",
};

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  tone?: "danger" | "default" | "success";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3.5 shadow-[var(--shadow-sm)]">
      <StatLabel>{label}</StatLabel>
      <p
        className={`mt-1 font-bold text-lg tabular-nums ${STAT_TONE_CLASS[tone]}`}
      >
        {value}
      </p>
    </div>
  );
}

export function ContractDetailPage() {
  useDocumentTitle(PAGE_TITLE.contractDetail);
  const { id } = useParams({ from: "/_app/contracts/$id" });
  const { installment } = useSearch({ from: "/_app/contracts/$id" });
  const navigate = useNavigate();
  const { data, isPending } = useContractQuery(id);
  const [openId, setOpenId] = useState<string | null>(installment ?? null);
  const [managing, setManaging] = useState(false);

  useEffect(() => {
    if (installment) {
      setOpenId(installment);
    }
  }, [installment]);

  function closeInstallment() {
    setOpenId(null);
    if (installment) {
      navigate({
        to: "/contracts/$id",
        params: { id },
        search: { installment: undefined },
        replace: true,
      });
    }
  }

  if (isPending || !data) {
    return (
      <PageContainer>
        <Skeleton className="mb-3 h-9 w-1/2" />
        <Skeleton className="mb-6 h-4 w-32" />
        <Skeleton className="mb-6 h-44 w-full rounded-xl" />
        <div className="mb-6 grid grid-cols-3 gap-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
        <Skeleton className="mb-6 h-28 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </PageContainer>
    );
  }

  const { contract, progress, installments, participants } = data;
  const isOwner = data.isOwner;
  const overdue = progress.overdueCount > 0;
  const selected = installments.find((it) => it.id === openId) ?? null;
  const paidCount = installments.filter((it) => isPaidStatus(it.status)).length;
  const totalCount = installments.length;

  return (
    <PageContainer>
      <header className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 font-bold text-2xl text-foreground tracking-tight">
            {contract.title}
          </h1>
          <div className="flex shrink-0 items-center gap-1">
            <ExportMenu contractId={id} />
            <ContractActionsMenu contractId={id} isOwner={isOwner} />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{ROLE_LABEL[data.role] ?? data.role}</Badge>
          {isOwner ? <Badge tone="brand">{OWNER_BADGE_LABEL}</Badge> : null}
          <ContractStatusBadge status={contract.status} />
          {contract.monthlyAmountCents == null ? null : (
            <Badge className="tabular-nums" tone="neutral">
              {formatBRL(contract.monthlyAmountCents)}/mês ·{" "}
              {installments.length}{" "}
              {installments.length === 1 ? "mês" : "meses"}
            </Badge>
          )}
          {overdue ? (
            <Badge tone="danger">{progress.overdueCount} em atraso</Badge>
          ) : (
            <Badge tone="success">em dia</Badge>
          )}
        </div>
        {contract.description ? (
          <p className="mt-3 text-muted-foreground text-sm">
            {contract.description}
          </p>
        ) : null}
      </header>

      <section className="mb-6 rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-hero)]">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <StatLabel>Restante</StatLabel>
            <Money cents={progress.remainingCents} size="hero" />
          </div>
          <div className="min-w-0 text-right">
            <StatLabel>Quitado</StatLabel>
            <p className="font-bold text-[clamp(2.4rem,6vw,3.35rem)] text-foreground tabular-nums leading-[0.98] tracking-[-0.036em]">
              {progress.percent}
              <span className="font-semibold text-[0.56em] text-muted-foreground">
                %
              </span>
            </p>
          </div>
        </div>
        <p className="mt-3 text-muted-foreground text-sm tabular-nums">
          de {formatBRL(progress.totalCents)} no total · {paidCount} de{" "}
          {totalCount} {totalCount === 1 ? "parcela" : "parcelas"}
        </p>
        <div className="mt-4">
          <Progress
            aria-label="Progresso de quitação"
            value={progress.percent}
          />
        </div>
      </section>

      <section className="mb-6 grid grid-cols-3 gap-3">
        <Stat
          label="Total"
          value={<Money cents={progress.totalCents} size="md" />}
        />
        <Stat
          label="Pago"
          tone="success"
          value={<Money cents={progress.paidCents} size="md" />}
        />
        <Stat
          label="Atrasadas"
          tone={overdue ? "danger" : "default"}
          value={String(progress.overdueCount)}
        />
      </section>

      <section className="mb-6 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Participantes
          </h2>
          {isOwner ? (
            <Button
              onClick={() => setManaging(true)}
              size="sm"
              type="button"
              variant="ghost"
            >
              Gerenciar
            </Button>
          ) : null}
        </div>
        <ul className="flex flex-col gap-2">
          {participants.map((p) => (
            <li
              className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
              key={p.id}
            >
              <span
                aria-hidden="true"
                className={`size-2 shrink-0 rounded-full ${p.linked ? "bg-primary" : "bg-muted-foreground/40"}`}
              />
              <span className="min-w-0 font-medium text-foreground">
                {p.displayName}
              </span>
              <Badge tone="neutral">{ROLE_LABEL[p.role] ?? p.role}</Badge>
              {p.isOwner ? (
                <Badge tone="brand">{OWNER_BADGE_LABEL}</Badge>
              ) : null}
              {p.linked ? null : (
                <span className="text-muted-foreground text-xs">
                  não vinculado
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <InstallmentsSection installments={installments} onSelect={setOpenId} />

      <InstallmentDrawer
        capabilities={{ isPayer: data.isPayer, isApprover: data.isApprover }}
        contractId={contract.id}
        installment={selected}
        isOwner={data.isOwner}
        onClose={closeInstallment}
        open={openId !== null}
        requiresConfirmation={contract.requiresConfirmation}
      />

      {isOwner ? (
        <ParticipantsDrawer
          contractId={contract.id}
          onClose={() => setManaging(false)}
          open={managing}
          participants={participants}
        />
      ) : null}
    </PageContainer>
  );
}
